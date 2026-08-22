import { Injectable } from '@nestjs/common';
import {
  ResourceStatus,
  ResourceType,
  ShareRole,
  type Folder,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AccessDecision, AccessRole } from './access.types';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Room-level access only: ownership or an explicit DATA_ROOM share.
   * Folder/file shares must NOT grant whole-room browse access.
   */
  async getDataRoomAccess(
    userId: string,
    dataRoomId: string,
  ): Promise<AccessDecision> {
    const dataRoom = await this.prisma.dataRoom.findUnique({
      where: { id: dataRoomId },
      select: { id: true, ownerId: true, status: true },
    });

    if (!dataRoom || dataRoom.status !== ResourceStatus.ACTIVE) {
      return { allowed: false };
    }

    if (dataRoom.ownerId === userId) {
      return { allowed: true, role: 'OWNER', source: 'OWNERSHIP' };
    }

    const share = await this.prisma.share.findFirst({
      where: {
        userId,
        dataRoomId,
        resourceType: ResourceType.DATA_ROOM,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { role: true },
    });

    if (share) {
      return {
        allowed: true,
        role: this.toAccessRole(share.role),
        source: 'DIRECT_SHARE',
      };
    }

    return { allowed: false };
  }

  async getFolderAccess(
    userId: string,
    folderId: string,
  ): Promise<AccessDecision & { folder?: Folder }> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        dataRoom: { select: { ownerId: true, status: true } },
      },
    });

    if (
      !folder ||
      folder.status !== ResourceStatus.ACTIVE ||
      folder.dataRoom.status !== ResourceStatus.ACTIVE
    ) {
      return { allowed: false };
    }

    if (folder.dataRoom.ownerId === userId) {
      return {
        allowed: true,
        role: 'OWNER',
        source: 'OWNERSHIP',
        folder,
      };
    }

    const roomShare = await this.prisma.share.findFirst({
      where: {
        userId,
        dataRoomId: folder.dataRoomId,
        resourceType: ResourceType.DATA_ROOM,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { role: true },
    });

    if (roomShare) {
      return {
        allowed: true,
        role: this.toAccessRole(roomShare.role),
        source: 'DIRECT_SHARE',
        folder,
      };
    }

    const ancestorIds = await this.collectAncestorFolderIds(folder);
    const folderShares = await this.prisma.share.findMany({
      where: {
        userId,
        revokedAt: null,
        resourceType: ResourceType.FOLDER,
        folderId: { in: ancestorIds },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { role: true, folderId: true },
    });

    if (folderShares.length > 0) {
      const clipRootFolderId = await this.pickShallowestFolderId(
        folderShares
          .map((share) => share.folderId)
          .filter((id): id is string => Boolean(id)),
      );
      const clipShare =
        folderShares.find((share) => share.folderId === clipRootFolderId) ??
        folderShares[0];

      return {
        allowed: true,
        role: this.toAccessRole(clipShare.role),
        source: 'ANCESTOR_SHARE',
        folder,
        clipRootFolderId,
      };
    }

    return { allowed: false, folder };
  }

  async getFileAccess(userId: string, fileId: string): Promise<AccessDecision> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        folder: {
          include: {
            dataRoom: { select: { status: true } },
          },
        },
      },
    });

    if (
      !file ||
      file.deletedAt ||
      !file.folder ||
      file.folder.status !== ResourceStatus.ACTIVE ||
      file.folder.dataRoom.status !== ResourceStatus.ACTIVE
    ) {
      return { allowed: false };
    }

    const folderAccess = await this.getFolderAccess(userId, file.folderId);
    if (folderAccess.allowed) {
      return folderAccess;
    }

    const share = await this.prisma.share.findFirst({
      where: {
        userId,
        fileId,
        resourceType: ResourceType.FILE,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { role: true },
    });

    if (share) {
      return {
        allowed: true,
        role: this.toAccessRole(share.role),
        source: 'DIRECT_SHARE',
      };
    }

    return { allowed: false };
  }

  /**
   * Rooms the user should see on the dashboard: owned, room-shared, or
   * folder-shared. File-only shares are intentionally omitted so the room
   * open path cannot over-grant sibling folder contents.
   */
  async listAccessibleDataRoomIds(userId: string): Promise<string[]> {
    const shares = await this.prisma.share.findMany({
      where: {
        userId,
        revokedAt: null,
        resourceType: {
          in: [ResourceType.DATA_ROOM, ResourceType.FOLDER],
        },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        resourceType: true,
        dataRoomId: true,
        folder: { select: { dataRoomId: true } },
      },
    });

    const ids = new Set<string>();
    for (const share of shares) {
      if (share.dataRoomId) {
        ids.add(share.dataRoomId);
      }
      if (share.folder?.dataRoomId) {
        ids.add(share.folder.dataRoomId);
      }
    }
    return [...ids];
  }

  /**
   * Entry folder for authenticated room open: true root for room-level
   * access, otherwise the shallowest folder the user is shared.
   */
  async resolveDataRoomEntryFolderId(
    userId: string,
    dataRoomId: string,
  ): Promise<{ role: AccessRole; folderId: string } | null> {
    const roomAccess = await this.getDataRoomAccess(userId, dataRoomId);
    if (roomAccess.allowed && roomAccess.role) {
      const root = await this.prisma.folder.findFirst({
        where: {
          dataRoomId,
          parentId: null,
          status: ResourceStatus.ACTIVE,
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!root) {
        return null;
      }
      return { role: roomAccess.role, folderId: root.id };
    }

    const folderShares = await this.prisma.share.findMany({
      where: {
        userId,
        revokedAt: null,
        resourceType: ResourceType.FOLDER,
        folder: { dataRoomId, status: ResourceStatus.ACTIVE },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        role: true,
        folderId: true,
        folder: { select: { id: true, parentId: true } },
      },
    });

    if (folderShares.length === 0) {
      return null;
    }

    let best = folderShares[0];
    let bestDepth = await this.folderDepth(best.folderId!);
    for (const share of folderShares.slice(1)) {
      const depth = await this.folderDepth(share.folderId!);
      if (depth < bestDepth) {
        best = share;
        bestDepth = depth;
      }
    }

    return {
      role: this.toAccessRole(best.role),
      folderId: best.folderId!,
    };
  }

  async collectAncestorFolderIds(folder: Folder): Promise<string[]> {
    const ids: string[] = [folder.id];
    let currentParentId = folder.parentId;

    while (currentParentId) {
      ids.push(currentParentId);
      const parent = await this.prisma.folder.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });
      currentParentId = parent?.parentId ?? null;
    }

    return ids;
  }

  private async folderDepth(folderId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = folderId;
    while (currentId) {
      const folder: { parentId: string | null } | null =
        await this.prisma.folder.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
      currentId = folder?.parentId ?? null;
      if (currentId) {
        depth += 1;
      }
    }
    return depth;
  }

  private async pickShallowestFolderId(folderIds: string[]): Promise<string> {
    let bestId = folderIds[0];
    let bestDepth = await this.folderDepth(bestId);
    for (const folderId of folderIds.slice(1)) {
      const depth = await this.folderDepth(folderId);
      if (depth < bestDepth) {
        bestId = folderId;
        bestDepth = depth;
      }
    }
    return bestId;
  }

  private toAccessRole(role: ShareRole): AccessRole {
    return role === ShareRole.EDITOR ? 'EDITOR' : 'VIEWER';
  }
}
