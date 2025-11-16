/**
 * Socket event payload interfaces
 */

export interface AuthPayload {
  token?: string;
  userId?: string;
}

export interface JoinPayload {
  resource: string;
  subresource?: string;
  mode: 'viewer' | 'editor';
  metadata?: Record<string, any>;
}

export interface JoinAck {
  ok: boolean;
  presenceCount?: number;
  lockHeldBy?: string | null;
  limits?: {
    maxEditors?: number;
    maxViewers?: number;
  };
  error?: string;
}

export interface LeavePayload {
  resource: string;
  subresource?: string;
}

export interface LockPayload {
  resource: string;
  subresource?: string;
  reason?: string;
  ttlMs?: number;
}

export interface LockAck {
  ok: boolean;
  lockId?: string;
  owner?: string;
  expiresAt?: string;
  error?: string;
}

export interface UnlockPayload {
  resource: string;
  subresource?: string;
  lockId?: string;
}

export interface UpdatePayload {
  resource: string;
  subresource?: string;
  revision?: string;
  diff?: any;
  metadata?: {
    userId?: string;
    timestamp?: string;
  };
}

export interface HeartbeatPayload {
  resource: string;
  subresource?: string;
  timestamp: string;
}

export interface PresenceQuery {
  resource: string;
  subresource?: string;
}

export interface PresenceResponse {
  users: Array<{
    userId: string;
    mode: 'viewer' | 'editor';
    since: string;
    metadata?: any;
  }>;
}

export interface LockNotice {
  resource: string;
  subresource?: string;
  lockId?: string;
  owner?: string;
  expiresAt?: string;
}

export interface UpdateApplied {
  resource: string;
  subresource?: string;
  revision: string;
  author?: string;
  timestamp: string;
}

export interface ConflictNotice {
  resource: string;
  subresource?: string;
  ours: {
    revision: string;
    patch?: any;
  };
  theirs: {
    revision: string;
    patch?: any;
  };
  resolutionHint?: string;
}

export interface ErrorNotice {
  code: string;
  message: string;
  details?: any;
}
