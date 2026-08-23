import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FileStatus,
  ResourceStatus,
  ResourceType,
  ShareRole,
  type Share,
} from '../../generated/prisma/client';
import { AccessService } from '../common/authorization/access.service';
import {
  clipBreadcrumbsToRoot,
  redactParentIdOutsideClip,
} from '../common/utils/access-redaction';
import {
  decodeCreatedAtCursor,
  encodeCreatedAtCursor,
} from '../common/utils/cursor';
import {
  createPublicShareToken,
  hashPublicShareToken,
} from '../common/utils/share-token';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import type { CreateShareDto } from './dto/create-share.dto';
import type { ListSharesDto } from './dto/list-shares.dto';
import type { ResolvePublicShareQueryDto } from './dto/resolve-public-share.dto';

export interface ShareResponse {
  id: string;
  resourceType: ResourceType;
  dataRoomId: string | null;
  folderId: string | null;
  fileId: string | null;
  role: ShareRole;
  userEmail: string | null;
  isPublic: boolean;
  publicToken?: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly accessService: AccessService,
    private readonly storage: StorageService,
  ) {}

  async create(
    clerkUserId: string,
    dto: CreateShareDto,
  ): Promise<ShareResponse> {
    const actor = await this.usersService.ensureLocalUser(clerkUserId);
    const target = await this.resolveShareTarget(
      dto.resourceType,
      dto.resourceId,
    );
    await this.assertCanManageShares(actor.id, target);

    if (dto.audience === 'USER') {
      if (!dto.email?.trim()) {
        throw new BadRequestException('email is required for user shares');
      }
      const recipient = await this.usersService.findByEmail(dto.email.trim());
      if (!recipient) {
        throw new NotFoundException(
          'Unable to share with that email. The person must sign in to Vault once first.',
        );
      }
      if (recipient.id === actor.id) {
        throw new BadRequestException(
          'You cannot share a resource with yourself',
        );
      }
      if (target.ownerId === recipient.id) {
        throw new BadRequestException('The owner already has full access');
      }

      const existing = await this.prisma.share.findFirst({
        where: {
          resourceType: dto.resourceType,
          dataRoomId: target.dataRoomId,
          folderId: target.folderId,
          fileId: target.fileId,
          userId: recipient.id,
          revokedAt: null,
        },
      });
      if (existing) {
        throw new BadRequestException(
          'An active share already exists for this user',
        );
      }

      const share = await this.prisma.share.create({
        data: {
          resourceType: dto.resourceType,
          dataRoomId: target.dataRoomId,
          folderId: target.folderId,
          fileId: target.fileId,
          userId: recipient.id,
          role: ShareRole.VIEWER,
          createdById: actor.id,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
        include: { user: { select: { email: true } } },
      });

      return this.toResponse(share, share.user?.email ?? null);
    }

    const { rawToken, tokenHash } = createPublicShareToken();
    const share = await this.prisma.share.create({
      data: {
        resourceType: dto.resourceType,
        dataRoomId: target.dataRoomId,
        folderId: target.folderId,
        fileId: target.fileId,
        publicToken: tokenHash,
        role: ShareRole.VIEWER,
        createdById: actor.id,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return this.toResponse(share, null, rawToken);
  }

  async list(
    clerkUserId: string,
    query: ListSharesDto,
  ): Promise<{ items: ShareResponse[] }> {
    const actor = await this.usersService.ensureLocalUser(clerkUserId);
    const target = await this.resolveShareTarget(
      query.resourceType,
      query.resourceId,
    );
    await this.assertCanManageShares(actor.id, target);

    const shares = await this.prisma.share.findMany({
      where: {
        resourceType: query.resourceType,
        dataRoomId: target.dataRoomId,
        folderId: target.folderId,
        fileId: target.fileId,
        revokedAt: null,
      },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: shares.map((share) =>
        this.toResponse(share, share.user?.email ?? null),
      ),
    };
  }

  async revoke(clerkUserId: string, shareId: string): Promise<void> {
    const actor = await this.usersService.ensureLocalUser(clerkUserId);
    const share = await this.prisma.share.findUnique({
      where: { id: shareId },
    });
    if (!share || share.revokedAt) {
      throw new NotFoundException('Share not found');
    }

    const resourceType = share.resourceType;
    const resourceId = share.dataRoomId ?? share.folderId ?? share.fileId;
    if (!resourceId) {
      throw new NotFoundException('Share not found');
    }

    const target = await this.resolveShareTarget(resourceType, resourceId);
    await this.assertCanManageShares(actor.id, target);

    await this.prisma.share.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });
  }

  async resolvePublicToken(
    rawToken: string,
    query: ResolvePublicShareQueryDto = {},
  ) {
    const folderId = query.folderId;
    const limit = query.limit ?? 50;
    const tokenHash = hashPublicShareToken(rawToken);
    const share = await this.prisma.share.findFirst({
      where: {
        publicToken: tokenHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!share) {
      throw new NotFoundException('Shared resource not found');
    }

    if (share.resourceType === ResourceType.DATA_ROOM && share.dataRoomId) {
      const dataRoom = await this.prisma.dataRoom.findUnique({
        where: { id: share.dataRoomId },
        include: {
          folders: {
            where: { parentId: null, status: ResourceStatus.ACTIVE },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { id: true, name: true },
          },
        },
      });
      if (!dataRoom || dataRoom.status !== ResourceStatus.ACTIVE) {
        throw new NotFoundException('Shared resource not found');
      }
      const rootFolderId = dataRoom.folders[0]?.id ?? null;
      const scopedFolderId = folderId ?? rootFolderId;
      if (scopedFolderId) {
        await this.assertFolderCoveredByShare(share, scopedFolderId);
      }
      const contents = scopedFolderId
        ? await this.getPublicFolderContents(scopedFolderId, undefined, {
            limit,
            foldersCursor: query.foldersCursor,
            filesCursor: query.filesCursor,
          })
        : null;
      return {
        resourceType: share.resourceType,
        role: 'VIEWER' as const,
        dataRoom: {
          id: dataRoom.id,
          name: dataRoom.name,
          rootFolderId,
        },
        folder: contents?.folder ?? null,
        breadcrumbs: contents?.breadcrumbs ?? [],
        folders: contents?.folders ?? { items: [], nextCursor: null, hasNextPage: false },
        files: contents?.files ?? { items: [], nextCursor: null, hasNextPage: false },
        file: null,
        viewUrl: null,
      };
    }

    if (share.resourceType === ResourceType.FOLDER && share.folderId) {
      const scopedFolderId = folderId ?? share.folderId;
      await this.assertFolderCoveredByShare(share, scopedFolderId);
      const contents = await this.getPublicFolderContents(
        scopedFolderId,
        share.folderId,
        {
          limit,
          foldersCursor: query.foldersCursor,
          filesCursor: query.filesCursor,
        },
      );
      return {
        resourceType: share.resourceType,
        role: 'VIEWER' as const,
        dataRoom: {
          id: contents.folder.dataRoomId,
          name: contents.dataRoomName,
          rootFolderId: null,
        },
        folder: contents.folder,
        breadcrumbs: contents.breadcrumbs,
        folders: contents.folders,
        files: contents.files,
        file: null,
        viewUrl: null,
      };
    }

    if (share.resourceType === ResourceType.FILE && share.fileId) {
      const file = await this.prisma.file.findUnique({
        where: { id: share.fileId },
        include: {
          folder: {
            select: {
              dataRoomId: true,
              status: true,
              name: true,
              dataRoom: { select: { status: true, name: true } },
            },
          },
        },
      });
      if (
        !file ||
        file.status !== FileStatus.AVAILABLE ||
        file.folder.status !== ResourceStatus.ACTIVE ||
        file.folder.dataRoom.status !== ResourceStatus.ACTIVE
      ) {
        throw new NotFoundException('Shared resource not found');
      }
      const view = await this.storage.createDownloadUrl(file.storageKey);
      return {
        resourceType: share.resourceType,
        role: 'VIEWER' as const,
        dataRoom: {
          id: file.folder.dataRoomId,
          name: file.folder.dataRoom.name,
          rootFolderId: null,
        },
        folder: null,
        breadcrumbs: [],
        folders: { items: [], nextCursor: null, hasNextPage: false },
        files: { items: [], nextCursor: null, hasNextPage: false },
        file: {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size.toString(),
          folderId: file.folderId,
          status: file.status,
          currentVersion: file.currentVersion,
        },
        viewUrl: view.url,
        expiresInSeconds: view.expiresInSeconds,
      };
    }

    throw new NotFoundException('Shared resource not found');
  }

  async createPublicFileViewUrl(rawToken: string, fileId: string) {
    const share = await this.findActivePublicShare(rawToken);
    await this.assertFileCoveredByShare(share, fileId);

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        folder: {
          include: { dataRoom: { select: { status: true } } },
        },
      },
    });
    if (
      !file ||
      file.status !== FileStatus.AVAILABLE ||
      file.folder.status !== ResourceStatus.ACTIVE ||
      file.folder.dataRoom.status !== ResourceStatus.ACTIVE
    ) {
      throw new NotFoundException('Shared resource not found');
    }

    const view = await this.storage.createDownloadUrl(file.storageKey);
    return {
      url: view.url,
      expiresInSeconds: view.expiresInSeconds,
      file: {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size.toString(),
        folderId: file.folderId,
        status: file.status,
      },
    };
  }

  private async findActivePublicShare(rawToken: string): Promise<Share> {
    const tokenHash = hashPublicShareToken(rawToken);
    const share = await this.prisma.share.findFirst({
      where: {
        publicToken: tokenHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!share) {
      throw new NotFoundException('Shared resource not found');
    }
    return share;
  }

  private async assertFileCoveredByShare(
    share: Share,
    fileId: string,
  ): Promise<void> {
    if (share.resourceType === ResourceType.FILE && share.fileId === fileId) {
      return;
    }

    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: { folder: true },
    });
    if (!file || file.status !== FileStatus.AVAILABLE || !file.folder) {
      throw new NotFoundException('Shared resource not found');
    }

    if (
      share.resourceType === ResourceType.DATA_ROOM &&
      share.dataRoomId &&
      file.folder.dataRoomId === share.dataRoomId
    ) {
      return;
    }

    if (share.resourceType === ResourceType.FOLDER && share.folderId) {
      await this.assertFolderCoveredByShare(share, file.folderId);
      return;
    }

    throw new NotFoundException('Shared resource not found');
  }

  private async assertFolderCoveredByShare(
    share: Share,
    folderId: string,
  ): Promise<void> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });
    if (!folder || folder.status !== ResourceStatus.ACTIVE) {
      throw new NotFoundException('Shared resource not found');
    }

    if (
      share.resourceType === ResourceType.DATA_ROOM &&
      share.dataRoomId &&
      folder.dataRoomId === share.dataRoomId
    ) {
      return;
    }

    if (share.resourceType === ResourceType.FOLDER && share.folderId) {
      const ancestorIds =
        await this.accessService.collectAncestorFolderIds(folder);
      if (ancestorIds.includes(share.folderId)) {
        return;
      }
    }

    throw new NotFoundException('Shared resource not found');
  }

  private async getPublicFolderContents(
    folderId: string,
    clipRootId?: string,
    pagination: {
      limit: number;
      foldersCursor?: string;
      filesCursor?: string;
    } = { limit: 50 },
  ) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      include: { dataRoom: { select: { name: true, status: true } } },
    });
    if (
      !folder ||
      folder.status !== ResourceStatus.ACTIVE ||
      folder.dataRoom.status !== ResourceStatus.ACTIVE
    ) {
      throw new NotFoundException('Shared resource not found');
    }

    const foldersDecoded = pagination.foldersCursor
      ? decodeCreatedAtCursor(pagination.foldersCursor)
      : undefined;
    const filesDecoded = pagination.filesCursor
      ? decodeCreatedAtCursor(pagination.filesCursor)
      : undefined;

    const [folderRows, fileRows, rawBreadcrumbs] = await Promise.all([
      this.prisma.folder.findMany({
        where: {
          parentId: folderId,
          status: ResourceStatus.ACTIVE,
          ...(foldersDecoded
            ? {
                OR: [
                  { createdAt: { lt: foldersDecoded.createdAt } },
                  {
                    createdAt: foldersDecoded.createdAt,
                    id: { lt: foldersDecoded.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: pagination.limit + 1,
      }),
      this.prisma.file.findMany({
        where: {
          folderId,
          status: FileStatus.AVAILABLE,
          ...(filesDecoded
            ? {
                OR: [
                  { createdAt: { lt: filesDecoded.createdAt } },
                  {
                    createdAt: filesDecoded.createdAt,
                    id: { lt: filesDecoded.id },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: pagination.limit + 1,
      }),
      this.buildBreadcrumbs(folderId),
    ]);

    const foldersHasNext = folderRows.length > pagination.limit;
    const foldersPage = foldersHasNext
      ? folderRows.slice(0, pagination.limit)
      : folderRows;
    const filesHasNext = fileRows.length > pagination.limit;
    const filesPage = filesHasNext
      ? fileRows.slice(0, pagination.limit)
      : fileRows;

    const breadcrumbs = clipBreadcrumbsToRoot(rawBreadcrumbs, clipRootId);

    return {
      dataRoomName: folder.dataRoom.name,
      folder: {
        id: folder.id,
        name: folder.name,
        dataRoomId: folder.dataRoomId,
        parentId: redactParentIdOutsideClip(
          folder.id,
          folder.parentId,
          clipRootId,
        ),
      },
      breadcrumbs,
      folders: {
        items: foldersPage.map((row) => ({
          id: row.id,
          name: row.name,
          dataRoomId: row.dataRoomId,
          parentId: row.parentId,
        })),
        nextCursor: foldersHasNext
          ? encodeCreatedAtCursor(
              foldersPage[foldersPage.length - 1].createdAt,
              foldersPage[foldersPage.length - 1].id,
            )
          : null,
        hasNextPage: foldersHasNext,
      },
      files: {
        items: filesPage.map((row) => ({
          id: row.id,
          name: row.name,
          mimeType: row.mimeType,
          size: row.size.toString(),
          folderId: row.folderId,
          status: row.status,
          currentVersion: row.currentVersion,
        })),
        nextCursor: filesHasNext
          ? encodeCreatedAtCursor(
              filesPage[filesPage.length - 1].createdAt,
              filesPage[filesPage.length - 1].id,
            )
          : null,
        hasNextPage: filesHasNext,
      },
    };
  }

  private async buildBreadcrumbs(
    folderId: string,
  ): Promise<Array<{ id: string; name: string }>> {
    const crumbs: Array<{ id: string; name: string }> = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const current: {
        id: string;
        name: string;
        parentId: string | null;
        status: ResourceStatus;
      } | null = await this.prisma.folder.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true, status: true },
      });
      if (!current || current.status !== ResourceStatus.ACTIVE) {
        break;
      }
      crumbs.push({ id: current.id, name: current.name });
      currentId = current.parentId;
    }

    return crumbs.reverse();
  }

  private async resolveShareTarget(
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<{
    ownerId: string;
    dataRoomId: string | null;
    folderId: string | null;
    fileId: string | null;
    manageViaFolderId?: string;
    manageViaDataRoomId: string;
  }> {
    if (resourceType === ResourceType.DATA_ROOM) {
      const dataRoom = await this.prisma.dataRoom.findUnique({
        where: { id: resourceId },
      });
      if (!dataRoom || dataRoom.status !== ResourceStatus.ACTIVE) {
        throw new NotFoundException('Resource not found');
      }
      return {
        ownerId: dataRoom.ownerId,
        dataRoomId: dataRoom.id,
        folderId: null,
        fileId: null,
        manageViaDataRoomId: dataRoom.id,
      };
    }

    if (resourceType === ResourceType.FOLDER) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: resourceId },
        include: { dataRoom: true },
      });
      if (
        !folder ||
        folder.status !== ResourceStatus.ACTIVE ||
        folder.dataRoom.status !== ResourceStatus.ACTIVE
      ) {
        throw new NotFoundException('Resource not found');
      }
      return {
        ownerId: folder.dataRoom.ownerId,
        dataRoomId: null,
        folderId: folder.id,
        fileId: null,
        manageViaFolderId: folder.id,
        manageViaDataRoomId: folder.dataRoomId,
      };
    }

    const file = await this.prisma.file.findUnique({
      where: { id: resourceId },
      include: {
        folder: { include: { dataRoom: true } },
      },
    });
    if (
      !file ||
      file.status === FileStatus.DELETED ||
      file.folder.status !== ResourceStatus.ACTIVE ||
      file.folder.dataRoom.status !== ResourceStatus.ACTIVE
    ) {
      throw new NotFoundException('Resource not found');
    }

    return {
      ownerId: file.folder.dataRoom.ownerId,
      dataRoomId: null,
      folderId: null,
      fileId: file.id,
      manageViaFolderId: file.folderId,
      manageViaDataRoomId: file.folder.dataRoomId,
    };
  }

  private async assertCanManageShares(
    userId: string,
    target: {
      ownerId: string;
      manageViaFolderId?: string;
      manageViaDataRoomId: string;
    },
  ): Promise<void> {
    if (target.ownerId === userId) {
      return;
    }

    if (target.manageViaFolderId) {
      const access = await this.accessService.getFolderAccess(
        userId,
        target.manageViaFolderId,
      );
      if (
        access.allowed &&
        (access.role === 'OWNER' || access.role === 'EDITOR')
      ) {
        return;
      }
    } else {
      const access = await this.accessService.getDataRoomAccess(
        userId,
        target.manageViaDataRoomId,
      );
      if (
        access.allowed &&
        (access.role === 'OWNER' || access.role === 'EDITOR')
      ) {
        return;
      }
    }

    throw new ForbiddenException('Only owners can manage shares');
  }

  private toResponse(
    share: Share & { user?: { email: string } | null },
    userEmail: string | null,
    publicToken?: string,
  ): ShareResponse {
    return {
      id: share.id,
      resourceType: share.resourceType,
      dataRoomId: share.dataRoomId,
      folderId: share.folderId,
      fileId: share.fileId,
      role: share.role,
      userEmail,
      isPublic: Boolean(share.publicToken),
      ...(publicToken ? { publicToken } : {}),
      createdAt: share.createdAt.toISOString(),
      expiresAt: share.expiresAt?.toISOString() ?? null,
      revokedAt: share.revokedAt?.toISOString() ?? null,
    };
  }
}
