/**
 * RateLimiter - Sliding Window Rate Limiter
 *
 * Generic rate limiter using sliding window algorithm.
 * Tracks request timestamps and automatically cleans expired entries.
 *
 * Features:
 * - Configurable limit and time window
 * - O(n) cleanup on each check (where n = requests in window)
 * - Memory efficient (only stores timestamps)
 * - Thread-safe for single-threaded Node.js
 *
 * Use Cases:
 * - WebSocket event rate limiting (prevent spam)
 * - API rate limiting per client
 * - Connection attempt throttling
 *
 * Usage Example:
 * ```typescript
 * const limiter = new RateLimiter({ limit: 10, window: 1000 }); // 10 req/sec
 *
 * if (limiter.allow()) {
 *   // Process request
 * } else {
 *   // Reject - rate limit exceeded
 *   throw new RateLimitExceededException();
 * }
 * ```
 *
 * Performance:
 * - Time complexity: O(n) where n = requests in current window
 * - Space complexity: O(limit)
 * - Automatic cleanup on each check (no memory leaks)
 *
 * @see EPIC-001-websocket-gateway.md BE-001.7 (Error Handling)
 */

/**
 * Rate limit configuration interface
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window */
  limit: number;

  /** Time window in milliseconds */
  window: number;
}

/**
 * Sliding window rate limiter implementation
 *
 * Tracks request timestamps within a sliding time window.
 * Automatically removes expired timestamps on each check.
 *
 * @public
 */
export class RateLimiter {
  /** Array of request timestamps within current window */
  private requests: number[] = [];

  /** Rate limit configuration */
  private readonly config: RateLimitConfig;

  /**
   * Create a new rate limiter
   *
   * @param config - Rate limit configuration (default: 10 req/sec)
   *
   * @example
   * ```typescript
   * // 10 requests per second
   * const limiter = new RateLimiter({ limit: 10, window: 1000 });
   *
   * // 100 requests per minute
   * const limiter = new RateLimiter({ limit: 100, window: 60000 });
   * ```
   */
  constructor(config: RateLimitConfig = { limit: 10, window: 1000 }) {
    if (config.limit <= 0) {
      throw new Error('RateLimiter: limit must be greater than 0');
    }
    if (config.window <= 0) {
      throw new Error('RateLimiter: window must be greater than 0');
    }

    this.config = config;
  }

  /**
   * Check if request should be allowed
   *
   * Automatically cleans expired requests and checks against limit.
   * If allowed, request is tracked for future rate limit calculations.
   *
   * @returns true if request allowed, false if rate limit exceeded
   *
   * @example
   * ```typescript
   * if (!limiter.allow()) {
   *   socket.emit('error', { message: 'Rate limit exceeded' });
   *   return;
   * }
   *
   * // Process request
   * socket.emit('message', { data: 'OK' });
   * ```
   */
  allow(): boolean {
    const now = Date.now();

    // Remove requests outside current window (sliding window cleanup)
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.config.window,
    );

    // Check if limit exceeded
    if (this.requests.length >= this.config.limit) {
      console.log('[DEBUG][RateLimiter] Rate limit exceeded:', {
        limit: this.config.limit,
        window: this.config.window,
        currentRequests: this.requests.length,
        timestamp: new Date().toISOString(),
      });
      return false; // Rate limit exceeded
    }

    // Allow request and track timestamp
    this.requests.push(now);
    return true;
  }

  /**
   * Reset rate limiter (clear all tracked requests)
   *
   * Useful for testing or manual reset scenarios.
   * In production, consider creating a new instance instead.
   *
   * @example
   * ```typescript
   * // Reset limiter for user after successful payment
   * userRateLimiters.get(userId)?.reset();
   * ```
   */
  reset(): void {
    this.requests = [];
    console.log('[DEBUG][RateLimiter] Rate limiter reset');
  }

  /**
   * Get remaining capacity before hitting rate limit
   *
   * Cleans expired requests before calculating remaining capacity.
   * Useful for displaying rate limit headers or warnings.
   *
   * @returns number of requests that can still be made in current window
   *
   * @example
   * ```typescript
   * const remaining = limiter.getRemaining();
   * socket.emit('rate-limit-status', {
   *   remaining,
   *   limit: limiter.getConfig().limit,
   *   resetAt: Date.now() + limiter.getConfig().window
   * });
   * ```
   */
  getRemaining(): number {
    const now = Date.now();

    // Clean expired requests first
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.config.window,
    );

    return Math.max(0, this.config.limit - this.requests.length);
  }

  /**
   * Get current configuration
   *
   * Returns a copy of the configuration to prevent external modification.
   *
   * @returns rate limit configuration (copy)
   *
   * @example
   * ```typescript
   * const config = limiter.getConfig();
   * console.log(`Rate limit: ${config.limit} requests per ${config.window}ms`);
   * ```
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Get current request count in sliding window
   *
   * Cleans expired requests before returning count.
   * Useful for monitoring and debugging.
   *
   * @returns number of requests in current sliding window
   *
   * @internal
   */
  getCurrentCount(): number {
    const now = Date.now();

    // Clean expired requests first
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.config.window,
    );

    return this.requests.length;
  }
}
