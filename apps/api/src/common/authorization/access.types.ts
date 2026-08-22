export type AccessRole = 'OWNER' | 'VIEWER' | 'EDITOR';

export interface AccessDecision {
  allowed: boolean;
  role?: AccessRole;
  source?: 'OWNERSHIP' | 'DIRECT_SHARE' | 'ANCESTOR_SHARE' | 'PUBLIC_LINK';
  /**
   * When set, API responses must not expose folder names/IDs above this node
   * (breadcrumb clip + parentId redaction).
   */
  clipRootFolderId?: string | null;
}

export interface PublicShareContext {
  token: string;
}
