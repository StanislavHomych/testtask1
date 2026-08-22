import { BadRequestException } from '@nestjs/common';

export function encodeCreatedAtCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

export function decodeCreatedAtCursor(cursor: string): {
  createdAt: Date;
  id: string;
} {
  try {
    const [iso, id] = Buffer.from(cursor, 'base64url')
      .toString('utf8')
      .split('|');
    const createdAt = new Date(iso);
    if (!iso || !id || Number.isNaN(createdAt.getTime())) {
      throw new Error('invalid');
    }
    return { createdAt, id };
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}
