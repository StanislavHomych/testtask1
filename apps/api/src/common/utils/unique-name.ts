import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { buildConflictName, toNameKey } from './name-key';

type Db =
  PrismaService | Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

export async function allocateUniqueFolderName(
  db: Db,
  dataRoomId: string,
  parentId: string | null,
  desiredName: string,
  excludeFolderId?: string,
): Promise<{ name: string; nameKey: string }> {
  const baseName = desiredName.trim();

  for (let attempt = 1; attempt <= 200; attempt += 1) {
    const name = buildConflictName(baseName, attempt);
    const nameKey = toNameKey(name);
    const clash = await db.folder.findFirst({
      where: {
        dataRoomId,
        nameKey,
        parentId,
        ...(excludeFolderId ? { id: { not: excludeFolderId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) {
      return { name, nameKey };
    }
  }

  throw new ConflictException('Could not allocate a unique folder name');
}

export async function allocateUniqueFileName(
  db: Db,
  folderId: string,
  desiredName: string,
  excludeFileId?: string,
): Promise<{ name: string; nameKey: string }> {
  const baseName = desiredName.trim();

  for (let attempt = 1; attempt <= 200; attempt += 1) {
    const name = buildConflictName(baseName, attempt);
    const nameKey = toNameKey(name);
    const clash = await db.file.findFirst({
      where: {
        folderId,
        nameKey,
        ...(excludeFileId ? { id: { not: excludeFileId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) {
      return { name, nameKey };
    }
  }

  throw new ConflictException('Could not allocate a unique file name');
}
