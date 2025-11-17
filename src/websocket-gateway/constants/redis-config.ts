/**
 * Redis Configuration Constants (SSOT)
 *
 * Centralized Redis configuration values for consistency across the application.
 *
 * @see docs/project/BE-001.3-MEETING-OUTCOME.md
 */

/**
 * Redis database indices for different contexts
 */
export enum RedisDatabase {
  /** Production/Development database */
  DEFAULT = 0,

  /** Test database (isolated for unit/integration tests) */
  TEST = 15,
}

/**
 * Redis connection configuration defaults
 */
export class RedisConfig {
  /** Default Redis host */
  static readonly DEFAULT_HOST = 'localhost';

  /** Default Redis port */
  static readonly DEFAULT_PORT = 6379;

  /** Default database index (production/development) */
  static readonly DEFAULT_DB = RedisDatabase.DEFAULT;

  /** Test database index (testing only) */
  static readonly TEST_DB = RedisDatabase.TEST;

  /** Retry strategy: max delay between retries (ms) */
  static readonly RETRY_MAX_DELAY_MS = 2000;

  /** Retry strategy: base delay multiplier */
  static readonly RETRY_BASE_DELAY_MS = 50;

  /**
   * Calculate retry delay with exponential backoff
   * @param attempt - Retry attempt number
   * @returns Delay in milliseconds
   */
  static getRetryDelay(attempt: number): number {
    return Math.min(
      attempt * this.RETRY_BASE_DELAY_MS,
      this.RETRY_MAX_DELAY_MS,
    );
  }
}

/**
 * Lock configuration constants (from BE-001.3 meeting decisions)
 */
export class LockConfig {
  /** Default lock TTL: 5 minutes (300s) - Meeting Decision 6 */
  static readonly DEFAULT_TTL_MS = 5 * 60 * 1000;

  /** Heartbeat interval: 60 seconds - Meeting Decision 7 */
  static readonly HEARTBEAT_INTERVAL_MS = 60 * 1000;

  /** Grace period on disconnect: 30 seconds - Meeting Decision 3 */
  static readonly DISCONNECT_GRACE_MS = 30 * 1000;
}
