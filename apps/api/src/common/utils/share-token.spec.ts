import { createPublicShareToken, hashPublicShareToken } from './share-token';

describe('public share tokens', () => {
  it('stores a SHA-256 digest, not the raw token', () => {
    const { rawToken, tokenHash } = createPublicShareToken();

    expect(rawToken).toHaveLength(43);
    expect(tokenHash).toBe(hashPublicShareToken(rawToken));
    expect(tokenHash).not.toBe(rawToken);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashes the same token consistently', () => {
    const token = 'public-share-token';
    expect(hashPublicShareToken(token)).toBe(hashPublicShareToken(token));
  });
});
