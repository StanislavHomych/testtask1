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

    for (const row of storageKeys) {
      try {
        await this.storage.deleteObject(row.storageKey);
      } catch {
        // Soft-deleted metadata remains authoritative; orphan cleanup can retry.
      }
    }
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
