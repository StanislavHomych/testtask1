import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FileStatus,
  ResourceStatus,
  type DataRoom,
} from '../../generated/prisma/client';
import { AccessService } from '../common/authorization/access.service';
import type { AccessRole } from '../common/authorization/access.types';
import {
  decodeCreatedAtCursor,
  encodeCreatedAtCursor,
} from '../common/utils/cursor';
import { toNameKey } from '../common/utils/name-key';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import type { CreateDataRoomDto } from './dto/create-data-room.dto';
import type { ListDataRoomsDto } from './dto/list-data-rooms.dto';
import type { SearchDataRoomDto } from './dto/search-data-room.dto';
import type { UpdateDataRoomDto } from './dto/update-data-room.dto';

export interface DataRoomResponse {
  id: string;
  name: string;
  role: AccessRole;
  rootFolderId: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class DataRoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly accessService: AccessService,
    private readonly storage: StorageService,
  ) {}

  async list(
    clerkUserId: string,
    query: ListDataRoomsDto,
  ): Promise<{
    items: DataRoomResponse[];
    nextCursor: string | null;
    hasNextPage: boolean;
  }> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const sharedIds = await this.accessService.listAccessibleDataRoomIds(
      user.id,
    );
    const limit = query.limit ?? 50;
    const cursor = query.cursor
      ? decodeCreatedAtCursor(query.cursor)
      : undefined;

    const rooms = await this.prisma.dataRoom.findMany({
      where: {
        status: ResourceStatus.ACTIVE,
        AND: [
          { OR: [{ ownerId: user.id }, { id: { in: sharedIds } }] },
          ...(cursor
            ? [
                {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    {
                      createdAt: cursor.createdAt,
                      id: { lt: cursor.id },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      include: {
        folders: {
          where: { parentId: null, status: ResourceStatus.ACTIVE },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasNextPage = rooms.length > limit;
    const page = hasNextPage ? rooms.slice(0, limit) : rooms;
    const nextCursor = hasNextPage
      ? encodeCreatedAtCursor(
          page[page.length - 1].createdAt,
          page[page.length - 1].id,
        )
      : null;

    return {
      items: page.map((room) =>
        this.toResponse(
          room,
          room.ownerId === user.id ? 'OWNER' : 'VIEWER',
          room.folders[0]?.id ?? null,
        ),
      ),
      nextCursor,
      hasNextPage,
    };
  }

  async create(
    clerkUserId: string,
    dto: CreateDataRoomDto,
  ): Promise<DataRoomResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);

    const created = await this.prisma.$transaction(async (tx) => {
      const dataRoom = await tx.dataRoom.create({
        data: {
          name: dto.name,
          ownerId: user.id,
        },
      });

      const rootFolder = await tx.folder.create({
        data: {
          name: dto.name,
          nameKey: toNameKey(dto.name),
          dataRoomId: dataRoom.id,
        },
      });

      return { dataRoom, rootFolderId: rootFolder.id };
    });

    return this.toResponse(created.dataRoom, 'OWNER', created.rootFolderId);
  }

  async getOne(
    clerkUserId: string,
    dataRoomId: string,
  ): Promise<DataRoomResponse> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const dataRoom = await this.findActiveOrThrow(dataRoomId);
    const entry = await this.accessService.resolveDataRoomEntryFolderId(
      user.id,
      dataRoomId,
    );

    if (!entry) {
      throw new NotFoundException('Data room not found');
    }

    return this.toResponse(dataRoom, entry.role, entry.folderId);
  }

  async search(
    clerkUserId: string,
    dataRoomId: string,
    query: SearchDataRoomDto,
  ): Promise<{
    items: Array<{
      id: string;
      name: string;
      mimeType: string;
      size: string;
      folderId: string;
      status: string;
      currentVersion: number;
      createdAt: string;
    }>;
    nextCursor: string | null;
    hasNextPage: boolean;
  }> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const entry = await this.accessService.resolveDataRoomEntryFolderId(
      user.id,
      dataRoomId,
    );
    if (!entry) {
      throw new NotFoundException('Data room not found');
    }

    const q = query.q.trim();
    if (!q) {
      return { items: [], nextCursor: null, hasNextPage: false };
    }

    const limit = query.limit ?? 50;
    const cursor = query.cursor
      ? decodeCreatedAtCursor(query.cursor)
      : undefined;

    // Folder-share viewers can only see files under their entry folder subtree.
    let allowedFolderIds: string[] | null = null;
    const roomAccess = await this.accessService.getDataRoomAccess(
      user.id,
      dataRoomId,
    );
    if (!roomAccess.allowed) {
      allowedFolderIds = await this.collectDescendantFolderIds(entry.folderId);
      allowedFolderIds.push(entry.folderId);
    }

    const rows = await this.prisma.file.findMany({
      where: {
        status: FileStatus.AVAILABLE,
        name: { contains: q, mode: 'insensitive' },
        folder: {
          dataRoomId,
          status: ResourceStatus.ACTIVE,
          ...(allowedFolderIds
            ? { id: { in: allowedFolderIds } }
            : {}),
        },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                {
                  createdAt: cursor.createdAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        folderId: true,
        status: true,
        currentVersion: true,
        createdAt: true,
      },
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
        currentVersion: row.currentVersion,
        createdAt: row.createdAt.toISOString(),
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

  async listFolderOptions(
    clerkUserId: string,
    dataRoomId: string,
  ): Promise<{
    items: Array<{
      id: string;
      name: string;
      parentId: string | null;
      pathLabel: string;
    }>;
  }> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    const entry = await this.accessService.resolveDataRoomEntryFolderId(
      user.id,
      dataRoomId,
    );
    if (!entry) {
      throw new NotFoundException('Data room not found');
    }

    const roomAccess = await this.accessService.getDataRoomAccess(
      user.id,
      dataRoomId,
    );
    let folders = await this.prisma.folder.findMany({
      where: {
        dataRoomId,
        status: ResourceStatus.ACTIVE,
      },
      select: { id: true, name: true, parentId: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    if (!roomAccess.allowed) {
      const allowed = new Set(
        await this.collectDescendantFolderIds(entry.folderId),
      );
      allowed.add(entry.folderId);
      folders = folders.filter((folder) => allowed.has(folder.id));
    }

    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const pathLabel = (folderId: string): string => {
      const parts: string[] = [];
      let current = byId.get(folderId);
      while (current) {
        parts.push(current.name);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      return parts.reverse().join(' / ');
    };

    return {
      items: folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        pathLabel: pathLabel(folder.id),
      })),
    };
  }

  async update(
    clerkUserId: string,
    dataRoomId: string,
    dto: UpdateDataRoomDto,
  ): Promise<DataRoomResponse> {
    await this.assertOwner(clerkUserId, dataRoomId);
    const dataRoom = await this.prisma.dataRoom.update({
      where: { id: dataRoomId },
      data: { name: dto.name },
    });
    const rootFolder = await this.prisma.folder.findFirst({
      where: {
        dataRoomId,
        parentId: null,
        status: ResourceStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return this.toResponse(dataRoom, 'OWNER', rootFolder?.id ?? null);
  }

  async remove(clerkUserId: string, dataRoomId: string): Promise<void> {
    await this.assertOwner(clerkUserId, dataRoomId);
    const deletedAt = new Date();

    const storageKeys = await this.prisma.file.findMany({
      where: {
        folder: { dataRoomId },
        deletedAt: null,
      },
      select: { id: true, storageKey: true },
    });
    const versionKeys = await this.prisma.fileVersion.findMany({
      where: { fileId: { in: storageKeys.map((row) => row.id) } },
      select: { storageKey: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.dataRoom.update({
        where: { id: dataRoomId },
        data: {
          status: ResourceStatus.DELETED,
          deletedAt,
        },
      });

      await tx.folder.updateMany({
        where: {
          dataRoomId,
          status: { not: ResourceStatus.DELETED },
        },
        data: {
          status: ResourceStatus.DELETED,
          deletedAt,
        },
      });

      await tx.file.updateMany({
        where: {
          folder: { dataRoomId },
          deletedAt: null,
        },
        data: {
          status: FileStatus.DELETED,
          deletedAt,
        },
      });

      await tx.share.updateMany({
        where: {
          revokedAt: null,
          OR: [
            { dataRoomId },
            { folder: { dataRoomId } },
            { file: { folder: { dataRoomId } } },
          ],
        },
        data: { revokedAt: deletedAt },
      });
    });

    await this.storage.deleteObjectsBestEffort([
      ...storageKeys.map((row) => row.storageKey),
      ...versionKeys.map((row) => row.storageKey),
    ]);
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

  private async assertOwner(
    clerkUserId: string,
    dataRoomId: string,
  ): Promise<void> {
    const user = await this.usersService.ensureLocalUser(clerkUserId);
    await this.findActiveOrThrow(dataRoomId);
    const access = await this.accessService.getDataRoomAccess(
      user.id,
      dataRoomId,
    );
    if (!access.allowed || access.role !== 'OWNER') {
      throw new NotFoundException('Data room not found');
    }
  }

  private async findActiveOrThrow(dataRoomId: string): Promise<DataRoom> {
    const dataRoom = await this.prisma.dataRoom.findUnique({
      where: { id: dataRoomId },
    });
    if (!dataRoom || dataRoom.status !== ResourceStatus.ACTIVE) {
      throw new NotFoundException('Data room not found');
    }
    return dataRoom;
  }

  private toResponse(
    dataRoom: DataRoom,
    role: AccessRole,
    rootFolderId: string | null,
  ): DataRoomResponse {
    return {
      id: dataRoom.id,
      name: dataRoom.name,
      role,
      rootFolderId,
      createdAt: dataRoom.createdAt.toISOString(),
      updatedAt: dataRoom.updatedAt.toISOString(),
    };
  }
}
