/**
 * RateLimiter - Sliding Window Rate Limiter
 *
 * Rate Limiting Events
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
 * Usage:
 * ```typescript
 * const limiter = new RateLimiter({ limit: 10, window: 1000 }); // 10 req/sec
 * 
 * if (limiter.allow()) {
 *   // Process request
 * } else {
 *   // Reject - rate limit exceeded
 * }
 * ```
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the time window */
  limit: number;
  
  /** Time window in milliseconds */
  window: number;
}

/**
 * Sliding window rate limiter implementation
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
   */
  constructor(config: RateLimitConfig = { limit: 10, window: 1000 }) {
    this.config = config;
  }
  
  /**
   * Check if request should be allowed
   * 
   * Automatically cleans expired requests and checks against limit.
   * 
   * @returns true if request allowed, false if rate limit exceeded
   */
  allow(): boolean {
    const now = Date.now();
    
    // Remove requests outside current window (sliding window cleanup)
    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.config.window,
    );
    
    // Check if limit exceeded
    if (this.requests.length >= this.config.limit) {
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
   */
  reset(): void {
    this.requests = [];
  }
  
  /**
   * Get remaining capacity before hitting rate limit
   * 
   * @returns number of requests that can still be made in current window
   */
  getRemaining(): number {
    const now = Date.now();
    
    // Clean expired requests first
    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.config.window,
    );
    
    return Math.max(0, this.config.limit - this.requests.length);
  }
  
  /**
   * Get current configuration
   * 
   * @returns rate limit configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}
