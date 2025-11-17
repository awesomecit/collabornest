/**
 * Redis Key Prefixes and Patterns (SSOT)
 *
 * All Redis keys must use these constants to prevent typos and enable refactoring.
 *
 * @see docs/project/BE-001.3-MEETING-OUTCOME.md
 */

/**
 * Redis key prefixes for different resource types
 */
export enum RedisKeyPrefix {
  /** Distributed lock keys: `lock:{resourceId}` */
  LOCK = 'lock',

  /** User session keys: `session:{userId}` (future use) */
  SESSION = 'session',

  /** Presence tracking keys: `presence:{roomId}` (future use) */
  PRESENCE = 'presence',
}

/**
 * Redis key factory functions for type-safe key generation
 */
export class RedisKeyFactory {
  /**
   * Generate lock key for resource
   * @param resourceId - Resource identifier (e.g., "surgery:123:main")
   * @returns Redis key (e.g., "lock:surgery:123:main")
   */
  static lock(resourceId: string): string {
    return `${RedisKeyPrefix.LOCK}:${resourceId}`;
  }

  /**
   * Generate session key for user
   * @param userId - User identifier
   * @returns Redis key (e.g., "session:user_alice")
   */
  static session(userId: string): string {
    return `${RedisKeyPrefix.SESSION}:${userId}`;
  }

  /**
   * Generate presence key for room
   * @param roomId - Room identifier
   * @returns Redis key (e.g., "presence:surgery:123")
   */
  static presence(roomId: string): string {
    return `${RedisKeyPrefix.PRESENCE}:${roomId}`;
  }

  /**
   * Get all lock keys pattern for Redis KEYS command
   * @returns Pattern (e.g., "lock:*")
   */
  static lockPattern(): string {
    return `${RedisKeyPrefix.LOCK}:*`;
  }
}
