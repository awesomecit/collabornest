/**
 * Interface for lock manager implementation
 */

export interface LockInfo {
  lockId: string | null;
  owner?: string;
  expiresAt?: number;
  createdAt?: number;
}

export interface ILockManager {
  /**
   * Acquire a lock on a resource
   * @returns Lock information including lockId and expiration
   * @throws Error if lock cannot be acquired
   */
  lock(
    resource: string,
    subresource: string | null | undefined,
    owner: string,
    ttlMs?: number,
  ): Promise<{ lockId: string; expiresAt: number }>;

  /**
   * Release a lock
   * @returns true if lock was released, false if lock didn't exist or wasn't owned
   */
  unlock(
    resource: string,
    subresource: string | null | undefined,
    lockId: string,
  ): Promise<boolean>;

  /**
   * Get current lock information
   * @returns Lock info or null if no lock exists
   */
  getLock(resource: string, subresource?: string | null): Promise<LockInfo>;

  /**
   * Extend lock TTL
   */
  extend?(
    resource: string,
    subresource: string | null | undefined,
    lockId: string,
    ttlMs: number,
  ): Promise<boolean>;

  /**
   * Force unlock (admin operation)
   */
  forceUnlock?(resource: string, subresource?: string | null): Promise<boolean>;
}
