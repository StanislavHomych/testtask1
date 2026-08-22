import { createHash, randomBytes } from 'node:crypto';

export function createPublicShareToken(): {
  rawToken: string;
  tokenHash: string;
} {
  const rawToken = randomBytes(32).toString('base64url');
  return {
    rawToken,
    tokenHash: hashPublicShareToken(rawToken),
  };
}

export function hashPublicShareToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
