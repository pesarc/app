// Shared types for the Developers dashboard.

export type KeyRow = {
  id: string;
  label: string;
  publishable: string;
  secretPrefix: string;
  signingSecret: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

export type CreatedKey = KeyRow & { secret: string };
