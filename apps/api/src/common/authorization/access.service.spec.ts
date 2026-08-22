jest.mock('../../../generated/prisma/client', () => ({
  ResourceStatus: {
    ACTIVE: 'ACTIVE',
    DELETING: 'DELETING',
    DELETED: 'DELETED',
  },
  ResourceType: {
    DATA_ROOM: 'DATA_ROOM',
    FOLDER: 'FOLDER',
    FILE: 'FILE',
  },
  ShareRole: {
    VIEWER: 'VIEWER',
    EDITOR: 'EDITOR',
  },
}));

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

import { AccessService } from './access.service';

const ResourceStatus = {
  ACTIVE: 'ACTIVE',
  DELETED: 'DELETED',
} as const;

const ShareRole = {
  VIEWER: 'VIEWER',
  EDITOR: 'EDITOR',
} as const;

describe('AccessService authorization matrix', () => {
  const ownerId = 'owner-1';
  const viewerId = 'viewer-1';
  const roomId = 'room-1';
  const folderId = 'folder-1';
  const childFolderId = 'folder-2';
  const fileId = 'file-1';

  const activeRoom = {
    id: roomId,
    ownerId,
    status: ResourceStatus.ACTIVE,
  };

  const rootFolder = {
    id: folderId,
    name: 'Root',
    nameKey: 'root',
    dataRoomId: roomId,
    parentId: null,
    status: ResourceStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    dataRoom: { ownerId, status: ResourceStatus.ACTIVE },
  };

  const childFolder = {
    ...rootFolder,
    id: childFolderId,
    parentId: folderId,
    name: 'Child',
    nameKey: 'child',
  };

  let prisma: {
    dataRoom: { findUnique: jest.Mock };
    folder: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    file: { findUnique: jest.Mock };
    share: { findFirst: jest.Mock; findMany: jest.Mock };
  };
  let access: AccessService;

  beforeEach(() => {
    prisma = {
      dataRoom: { findUnique: jest.fn() },
      folder: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      file: { findUnique: jest.fn() },
      share: { findFirst: jest.fn(), findMany: jest.fn() },
    };
    access = new AccessService(prisma as never);
  });

  it('grants room access only for ownership or DATA_ROOM shares', async () => {
    prisma.dataRoom.findUnique.mockResolvedValue(activeRoom);
    prisma.share.findFirst.mockResolvedValue(null);

    await expect(access.getDataRoomAccess(viewerId, roomId)).resolves.toEqual({
      allowed: false,
    });

    prisma.share.findFirst.mockResolvedValue({ role: ShareRole.VIEWER });
    await expect(
      access.getDataRoomAccess(viewerId, roomId),
    ).resolves.toMatchObject({
      allowed: true,
      role: 'VIEWER',
      source: 'DIRECT_SHARE',
    });
  });

  it('does not grant folder access from a file-level share', async () => {
    prisma.folder.findUnique.mockResolvedValue(rootFolder);
    prisma.share.findFirst.mockResolvedValue(null);
    prisma.share.findMany.mockResolvedValue([]);

    await expect(
      access.getFolderAccess(viewerId, folderId),
    ).resolves.toMatchObject({ allowed: false });

    expect(prisma.share.findFirst).toHaveBeenCalled();
    expect(prisma.share.findMany).toHaveBeenCalled();
  });

  it('grants folder access via ancestor folder share', async () => {
    prisma.folder.findUnique
      .mockResolvedValueOnce(childFolder)
      .mockResolvedValueOnce({ parentId: null })
      .mockResolvedValue({ parentId: null });
    prisma.share.findFirst.mockResolvedValue(null);
    prisma.share.findMany.mockResolvedValue([
      { role: ShareRole.VIEWER, folderId },
    ]);

    await expect(
      access.getFolderAccess(viewerId, childFolderId),
    ).resolves.toMatchObject({
      allowed: true,
      role: 'VIEWER',
      source: 'ANCESTOR_SHARE',
      clipRootFolderId: folderId,
    });
  });

  it('grants file access via direct file share without folder access', async () => {
    prisma.file.findUnique.mockResolvedValue({
      id: fileId,
      folderId,
      deletedAt: null,
      folder: {
        status: ResourceStatus.ACTIVE,
        dataRoom: { status: ResourceStatus.ACTIVE },
      },
    });
    prisma.folder.findUnique.mockResolvedValue(rootFolder);
    prisma.share.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ role: ShareRole.VIEWER });
    prisma.share.findMany.mockResolvedValue([]);

    await expect(access.getFileAccess(viewerId, fileId)).resolves.toMatchObject(
      {
        allowed: true,
        role: 'VIEWER',
        source: 'DIRECT_SHARE',
      },
    );
  });

  it('lists only room and folder shared rooms for the dashboard', async () => {
    prisma.share.findMany.mockResolvedValue([
      { dataRoomId: roomId, folder: null },
      { dataRoomId: null, folder: { dataRoomId: 'room-2' } },
    ]);

    await expect(access.listAccessibleDataRoomIds(viewerId)).resolves.toEqual([
      roomId,
      'room-2',
    ]);
  });
});
