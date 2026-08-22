import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FileStatus,
  ResourceStatus,
  type Folder,
} from '../../generated/prisma/client';
import { AccessService } from '../common/authorization/access.service';
import type { AccessRole } from '../common/authorization/access.types';
import type { CursorPageInfo } from '../common/dto/cursor-pagination.dto';
import {
  decodeCreatedAtCursor,
  encodeCreatedAtCursor,
} from '../common/utils/cursor';
import { wouldCreateFolderCycle } from '../common/utils/folder-cycle';
import {
  clipBreadcrumbsToRoot,
  redactParentIdOutsideClip,
} from '../common/utils/access-redaction';
import { allocateUniqueFolderName } from '../common/utils/unique-name';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import type { CreateFolderDto } from './dto/create-folder.dto';
import type { ListFolderContentsDto } from './dto/list-folder-contents.dto';
import type { MoveFolderDto } from './dto/move-folder.dto';
import type { UpdateFolderDto } from './dto/update-folder.dto';

export interface FolderResponse {
  id: string;
  name: string;
  dataRoomId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FolderBreadcrumb {
  id: string;
  name: string;
}

export interface FileListItem {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  folderId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface FolderContentsResponse {
  folder: FolderResponse;
  breadcrumbs: FolderBreadcrumb[];
  role: AccessRole;
  canWrite: boolean;
  folders: { items: FolderResponse[] } & CursorPageInfo;
  files: { items: FileListItem[] } & CursorPageInfo;
}

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly accessService: AccessService,
    private readonly storage: StorageService,
  ) {}

  async getOne(
    clerkUserId: string,
    folderId: string,
  ): Promise<FolderResponse & { role: AccessRole; canWrite: boolean }> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const access = await this.accessService.getFolderAccess(user.id, folderId);
    if (!access.allowed || !access.role || !access.folder) {
      throw new NotFoundException('Folder not found');
    }
    return {
      ...this.toFolderResponse(access.folder, access.clipRootFolderId),
      role: access.role,
      canWrite: this.canWrite(access.role),
    };
  }

  async getContents(
    clerkUserId: string,
    folderId: string,
    query: ListFolderContentsDto,
  ): Promise<FolderContentsResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const access = await this.accessService.getFolderAccess(user.id, folderId);
    if (!access.allowed || !access.role || !access.folder) {
      throw new NotFoundException('Folder not found');
    }

    const limit = query.limit ?? 50;
    const foldersCursor = query.foldersCursor ?? query.cursor;
    const filesCursor = query.filesCursor;
    const canWrite = this.canWrite(access.role);

    const [breadcrumbs, foldersPage, filesPage] = await Promise.all([
      this.buildBreadcrumbs(access.folder, access.clipRootFolderId),
      this.listChildFolders(
        folderId,
        limit,
        foldersCursor,
        access.clipRootFolderId,
      ),
      this.listChildFiles(folderId, limit, filesCursor, canWrite),
    ]);

    return {
      folder: this.toFolderResponse(access.folder, access.clipRootFolderId),
      breadcrumbs,
      role: access.role,
      canWrite,
      folders: foldersPage,
      files: filesPage,
    };
  }

  async create(
    clerkUserId: string,
    parentFolderId: string,
    dto: CreateFolderDto,
  ): Promise<FolderResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    await this.assertCanWriteFolder(user.id, parentFolderId);

    const parent = await this.findActiveFolderOrThrow(parentFolderId);
    const { name, nameKey } = await allocateUniqueFolderName(
      this.prisma,
      parent.dataRoomId,
      parent.id,
      dto.name,
    );

    const folder = await this.prisma.folder.create({
      data: {
        name,
        nameKey,
        dataRoomId: parent.dataRoomId,
        parentId: parent.id,
      },
    });

    return this.toFolderResponse(folder);
  }

  async update(
    clerkUserId: string,
    folderId: string,
    dto: UpdateFolderDto,
  ): Promise<FolderResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    await this.assertCanWriteFolder(user.id, folderId);
    const folder = await this.findActiveFolderOrThrow(folderId);

    if (folder.parentId === null) {
      throw new BadRequestException('The root folder cannot be renamed here');
    }

    const { name, nameKey } = await allocateUniqueFolderName(
      this.prisma,
      folder.dataRoomId,
      folder.parentId,
      dto.name,
      folder.id,
    );

    const updated = await this.prisma.folder.update({
      where: { id: folderId },
      data: { name, nameKey },
    });
    return this.toFolderResponse(updated);
  }

  async move(
    clerkUserId: string,
    folderId: string,
    dto: MoveFolderDto,
  ): Promise<FolderResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    await this.assertCanWriteFolder(user.id, folderId);

    const folder = await this.findActiveFolderOrThrow(folderId);
    if (folder.parentId === null) {
      throw new BadRequestException('The root folder cannot be moved');
    }
    if (folderId === dto.targetParentId) {
      throw new BadRequestException('A folder cannot be moved into itself');
    }

    const targetParent = await this.findActiveFolderOrThrow(dto.targetParentId);
    if (targetParent.dataRoomId !== folder.dataRoomId) {
      throw new BadRequestException(
        'Folders cannot be moved across data rooms',
      );
    }

    await this.assertCanWriteFolder(user.id, dto.targetParentId);

    const targetAncestors =
      await this.accessService.collectAncestorFolderIds(targetParent);
    if (wouldCreateFolderCycle(folderId, targetParent.id, targetAncestors)) {
      throw new BadRequestException(
        'A folder cannot be moved into its descendant',
      );
    }

    const { name, nameKey } = await allocateUniqueFolderName(
      this.prisma,
      folder.dataRoomId,
      targetParent.id,
      folder.name,
      folder.id,
    );

    const updated = await this.prisma.folder.update({
      where: { id: folderId },
      data: {
        parentId: targetParent.id,
        name,
        nameKey,
      },
    });
    return this.toFolderResponse(updated);
  }

  async remove(clerkUserId: string, folderId: string): Promise<void> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    await this.assertCanWriteFolder(user.id, folderId);
    const folder = await this.findActiveFolderOrThrow(folderId);

    if (folder.parentId === null) {
      throw new BadRequestException('The root folder cannot be deleted');
    }

    const now = new Date();
    const descendantIds = await this.collectDescendantFolderIds(folderId);
    const allFolderIds = [folderId, ...descendantIds];

    const storageKeys = await this.prisma.file.findMany({
      where: {
        folderId: { in: allFolderIds },
        status: {
          notIn: [FileStatus.DELETED, FileStatus.DELETING],
        },
      },
      select: { storageKey: true },
    });

    await this.prisma.$transaction(async (tx) => {
      const files = await tx.file.findMany({
        where: {
          folderId: { in: allFolderIds },
          status: {
            notIn: [FileStatus.DELETED, FileStatus.DELETING],
          },
        },
        select: { id: true, nameKey: true },
      });

      for (const file of files) {
        await tx.file.update({
          where: { id: file.id },
          data: {
            status: FileStatus.DELETED,
            deletedAt: now,
            nameKey: `${file.nameKey}__deleted__${file.id}`,
          },
        });
      }

      const folders = await tx.folder.findMany({
        where: {
          id: { in: allFolderIds },
          status: ResourceStatus.ACTIVE,
        },
        select: { id: true, nameKey: true },
      });

      for (const child of folders) {
        await tx.folder.update({
          where: { id: child.id },
          data: {
            status: ResourceStatus.DELETED,
            deletedAt: now,
            nameKey: `${child.nameKey}__deleted__${child.id}`,
          },
        });
      }

      await tx.share.updateMany({
        where: {
          revokedAt: null,
          OR: [
            { folderId: { in: allFolderIds } },
            { file: { folderId: { in: allFolderIds } } },
          ],
        },
        data: { revokedAt: now },
      });
    });

    await this.deleteStorageKeysBestEffort(
      storageKeys.map((row) => row.storageKey),
    );
  }

  private async listChildFolders(
    parentId: string,
    limit: number,
    cursor: string | undefined,
    clipRootFolderId: string | null | undefined,
  ): Promise<{ items: FolderResponse[] } & CursorPageInfo> {
    const decoded = cursor ? decodeCreatedAtCursor(cursor) : undefined;
    const rows = await this.prisma.folder.findMany({
      where: {
        parentId,
        status: ResourceStatus.ACTIVE,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                {
                  createdAt: decoded.createdAt,
                  id: { lt: decoded.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) => this.toFolderResponse(row, clipRootFolderId)),
      nextCursor: hasNextPage
        ? encodeCreatedAtCursor(
            page[page.length - 1].createdAt,
            page[page.length - 1].id,
          )
        : null,
      hasNextPage,
    };
  }

  private async listChildFiles(
    folderId: string,
    limit: number,
    cursor: string | undefined,
    includeIncomplete: boolean,
  ): Promise<{ items: FileListItem[] } & CursorPageInfo> {
    const decoded = cursor ? decodeCreatedAtCursor(cursor) : undefined;
    const rows = await this.prisma.file.findMany({
      where: {
        folderId,
        status: includeIncomplete
          ? {
              in: [
                FileStatus.AVAILABLE,
                FileStatus.PENDING_UPLOAD,
                FileStatus.FAILED,
              ],
            }
          : FileStatus.AVAILABLE,
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                {
                  createdAt: decoded.createdAt,
                  id: { lt: decoded.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasNextPage = rows.length > limit;
    const page = hasNextPage ? rows.slice(0, limit) : rows;
    return {
      items: page.map((row) => ({
        id: row.id,
        name: row.name,
        mimeType: row.mimeType,
        size: row.size.toString(),
        folderId: row.folderId,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      nextCursor: hasNextPage
        ? encodeCreatedAtCursor(
            page[page.length - 1].createdAt,
            page[page.length - 1].id,
          )
        : null,
      hasNextPage,
    };
  }

  private async buildBreadcrumbs(
    folder: Folder,
    clipRootFolderId?: string | null,
  ): Promise<FolderBreadcrumb[]> {
    const crumbs: FolderBreadcrumb[] = [];
    let current: Folder | null = folder;

    while (current) {
      crumbs.push({ id: current.id, name: current.name });
      if (!current.parentId) {
        break;
      }
      current = await this.prisma.folder.findUnique({
        where: { id: current.parentId },
      });
      if (!current || current.status !== ResourceStatus.ACTIVE) {
        break;
      }
    }

    return clipBreadcrumbsToRoot(crumbs.reverse(), clipRootFolderId);
  }

  private async collectDescendantFolderIds(
    rootFolderId: string,
  ): Promise<string[]> {
    const result: string[] = [];
    let frontier = [rootFolderId];

    while (frontier.length > 0) {
      const children = await this.prisma.folder.findMany({
        where: {
          parentId: { in: frontier },
          status: ResourceStatus.ACTIVE,
        },
        select: { id: true },
      });
      const childIds = children.map((child) => child.id);
      result.push(...childIds);
      frontier = childIds;
    }

    return result;
  }

  private async deleteStorageKeysBestEffort(keys: string[]): Promise<void> {
    for (const key of keys) {
      try {
        await this.storage.deleteObject(key);
      } catch {
        // Soft-deleted metadata remains authoritative; orphan cleanup can retry.
      }
    }
  }

  private async assertCanWriteFolder(
    userId: string,
    folderId: string,
  ): Promise<Folder> {
    const access = await this.accessService.getFolderAccess(userId, folderId);
    if (!access.allowed || !access.folder) {
      throw new NotFoundException('Folder not found');
    }
    if (!access.role || !this.canWrite(access.role)) {
      throw new ForbiddenException('You cannot modify this folder');
    }
    return access.folder;
  }

  private async findActiveFolderOrThrow(folderId: string): Promise<Folder> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });
    if (!folder || folder.status !== ResourceStatus.ACTIVE) {
      throw new NotFoundException('Folder not found');
    }
    return folder;
  }

  private canWrite(role: AccessRole): boolean {
    return role === 'OWNER' || role === 'EDITOR';
  }

  private toFolderResponse(
    folder: Folder,
    clipRootFolderId?: string | null,
  ): FolderResponse {
    return {
      id: folder.id,
      name: folder.name,
      dataRoomId: folder.dataRoomId,
      parentId: redactParentIdOutsideClip(
        folder.id,
        folder.parentId,
        clipRootFolderId,
      ),
      createdAt: folder.createdAt.toISOString(),
      updatedAt: folder.updatedAt.toISOString(),
    };
  }
}
