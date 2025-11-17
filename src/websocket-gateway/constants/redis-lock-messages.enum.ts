/**
 * Error Messages for RedisLockService (SSOT)
 *
 * All error messages must use these constants to ensure consistency.
 *
 * @see docs/project/BE-001.3-MEETING-OUTCOME.md
 */

/**
 * Error messages for RedisLockService
 */
export enum RedisLockError {
  /** Redis connection not initialized */
  REDIS_NOT_INITIALIZED = 'Redis not initialized',

  /** Lock acquisition failed due to race condition */
  LOCK_RACE_CONDITION = 'Lock acquisition race condition',

  /** Lock release denied - not lock owner */
  RELEASE_DENIED = 'Release denied: lock held by different user',

  /** Lock renewal denied - not lock owner */
  RENEWAL_DENIED = 'Renewal denied: lock held by different user',

  /** Failed to parse lock metadata */
  CORRUPTED_LOCK = 'Failed to parse existing lock, treating as corrupted',

  /** Generic error acquiring lock */
  ERROR_ACQUIRING = 'Error acquiring lock',

  /** Generic error releasing lock */
  ERROR_RELEASING = 'Error releasing lock',

  /** Generic error renewing lock */
  ERROR_RENEWING = 'Error renewing lock',

  /** Generic error getting lock holder */
  ERROR_GET_HOLDER = 'Error getting lock holder',
}

/**
 * Log messages for RedisLockService (info/debug)
 */
export enum RedisLockLog {
  /** Redis connected successfully */
  REDIS_CONNECTED = 'Redis connected successfully',

  /** Using externally provided Redis instance (testing) */
  REDIS_EXTERNAL = 'Using externally provided Redis instance',

  /** Lock acquired successfully */
  LOCK_ACQUIRED = 'Lock acquired',

  /** Lock reacquired by same user (idempotent) */
  LOCK_REACQUIRED = 'Lock reacquired by same user',

  /** Lock denied - held by another user */
  LOCK_DENIED = 'Lock denied: held by different user',

  /** Lock released successfully */
  LOCK_RELEASED = 'Lock released',

  /** No lock to release (idempotent) */
  NO_LOCK_TO_RELEASE = 'No lock to release',

  /** Lock renewed successfully */
  LOCK_RENEWED = 'Lock renewed',

  /** No lock to renew */
  NO_LOCK_TO_RENEW = 'No lock to renew',
}
