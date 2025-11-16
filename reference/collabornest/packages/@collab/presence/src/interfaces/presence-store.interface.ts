/**
 * Interface for presence store implementation
 */

export interface PresenceUser {
  userId: string;
  mode: 'viewer' | 'editor';
  since: number;
  metadata?: any;
}

export interface PresenceCount {
  viewers: number;
  editors: number;
}

export interface IPresenceStore {
  /**
   * Register a user's presence on a resource
   */
  join(
    resource: string,
    subresource: string | null,
    userId: string,
    mode: 'viewer' | 'editor',
    metadata?: any,
  ): Promise<void>;

  /**
   * Remove a user's presence from a resource
   */
  leave(resource: string, subresource: string | null, userId: string): Promise<void>;

  /**
   * List all users present on a resource
   */
  list(resource: string, subresource?: string | null): Promise<PresenceUser[]>;

  /**
   * Count users by mode on a resource
   */
  count(resource: string, subresource?: string | null): Promise<PresenceCount>;

  /**
   * Update user's heartbeat timestamp
   */
  heartbeat?(resource: string, subresource: string | null, userId: string): Promise<void>;

  /**
   * Clean stale presence entries
   */
  cleanup?(staleThresholdMs: number): Promise<number>;
}
