/**
 * RateLimiter - Unit Tests
 * 
 * Task 10.4: Rate Limiting Eventi
 * 
 * Tests for sliding window rate limiter:
 * - Allow requests within limit
 * - Reject requests exceeding limit
 * - Window sliding mechanism
 * - Reset functionality
 * - Remaining capacity tracking
 * 
 * TDD Approach: RED → GREEN → REFACTOR
 */

import { RateLimiter, RateLimitConfig } from './rate-limiter';

describe('RateLimiter - Task 10.4: Rate Limiting', () => {
  // Helper to advance time in tests
  let currentTime = Date.now();
  const originalDateNow = Date.now;

  beforeEach(() => {
    currentTime = 1000000; // Fixed start time for predictable tests
    Date.now = jest.fn(() => currentTime);
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  const advanceTime = (ms: number) => {
    currentTime += ms;
  };

  describe('Constructor and Configuration', () => {
    it('should create limiter with default config', () => {
      const limiter = new RateLimiter();
      
      expect(limiter).toBeDefined();
      expect(limiter.getRemaining()).toBe(10); // Default limit
    });

    it('should create limiter with custom config', () => {
      const config: RateLimitConfig = {
        limit: 5,
        window: 2000, // 2 seconds
      };
      
      const limiter = new RateLimiter(config);
      
      expect(limiter.getRemaining()).toBe(5);
    });
  });

  describe('allow() - Request Acceptance', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter({ limit: 3, window: 1000 });
      
      expect(limiter.allow()).toBe(true);  // 1st request
      expect(limiter.allow()).toBe(true);  // 2nd request
      expect(limiter.allow()).toBe(true);  // 3rd request
    });

    it('should reject requests exceeding limit', () => {
      const limiter = new RateLimiter({ limit: 2, window: 1000 });
      
      expect(limiter.allow()).toBe(true);   // 1st request - OK
      expect(limiter.allow()).toBe(true);   // 2nd request - OK
      expect(limiter.allow()).toBe(false);  // 3rd request - REJECTED
      expect(limiter.allow()).toBe(false);  // 4th request - REJECTED
    });

    it('should allow new requests after window expires', () => {
      const limiter = new RateLimiter({ limit: 2, window: 1000 });
      
      // Fill the limit
      expect(limiter.allow()).toBe(true);  // t=0ms
      expect(limiter.allow()).toBe(true);  // t=0ms
      expect(limiter.allow()).toBe(false); // t=0ms - REJECTED
      
      // Advance time beyond window
      advanceTime(1001);
      
      // Should allow new requests
      expect(limiter.allow()).toBe(true);  // t=1001ms - OK (old requests expired)
      expect(limiter.allow()).toBe(true);  // t=1001ms - OK
    });

    it('should implement sliding window correctly', () => {
      const limiter = new RateLimiter({ limit: 3, window: 1000 });
      
      // t=0: 3 requests
      expect(limiter.allow()).toBe(true);
      expect(limiter.allow()).toBe(true);
      expect(limiter.allow()).toBe(true);
      expect(limiter.allow()).toBe(false); // Limit reached
      
      // t=600: Still blocked (oldest request still in window)
      advanceTime(600);
      expect(limiter.allow()).toBe(false);
      
      // t=1100: Oldest requests expired, new slot available
      advanceTime(500); // total 1100ms
      expect(limiter.allow()).toBe(true);
    });
  });

  describe('getRemaining() - Capacity Tracking', () => {
    it('should return full capacity initially', () => {
      const limiter = new RateLimiter({ limit: 5, window: 1000 });
      
      expect(limiter.getRemaining()).toBe(5);
    });

    it('should decrease remaining after requests', () => {
      const limiter = new RateLimiter({ limit: 5, window: 1000 });
      
      limiter.allow();
      expect(limiter.getRemaining()).toBe(4);
      
      limiter.allow();
      expect(limiter.getRemaining()).toBe(3);
      
      limiter.allow();
      expect(limiter.getRemaining()).toBe(2);
    });

    it('should return 0 when limit reached', () => {
      const limiter = new RateLimiter({ limit: 2, window: 1000 });
      
      limiter.allow();
      limiter.allow();
      
      expect(limiter.getRemaining()).toBe(0);
    });

    it('should increase remaining after window expires', () => {
      const limiter = new RateLimiter({ limit: 3, window: 1000 });
      
      limiter.allow(); // t=0
      limiter.allow(); // t=0
      expect(limiter.getRemaining()).toBe(1);
      
      advanceTime(1001);
      
      // Old requests expired
      expect(limiter.getRemaining()).toBe(3);
    });
  });

  describe('reset() - Manual Reset', () => {
    it('should clear all tracked requests', () => {
      const limiter = new RateLimiter({ limit: 3, window: 1000 });
      
      limiter.allow();
      limiter.allow();
      limiter.allow();
      expect(limiter.getRemaining()).toBe(0);
      
      limiter.reset();
      
      expect(limiter.getRemaining()).toBe(3);
      expect(limiter.allow()).toBe(true); // Should accept new requests
    });

    it('should allow immediate requests after reset', () => {
      const limiter = new RateLimiter({ limit: 2, window: 1000 });
      
      limiter.allow();
      limiter.allow();
      expect(limiter.allow()).toBe(false); // Limit reached
      
      limiter.reset();
      
      expect(limiter.allow()).toBe(true);  // Should work after reset
      expect(limiter.allow()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle limit of 1', () => {
      const limiter = new RateLimiter({ limit: 1, window: 1000 });
      
      expect(limiter.allow()).toBe(true);
      expect(limiter.allow()).toBe(false);
      
      advanceTime(1001);
      expect(limiter.allow()).toBe(true);
    });

    it('should handle very short window', () => {
      const limiter = new RateLimiter({ limit: 3, window: 10 }); // 10ms window
      
      expect(limiter.allow()).toBe(true);
      expect(limiter.allow()).toBe(true);
      expect(limiter.allow()).toBe(true);
      expect(limiter.allow()).toBe(false);
      
      advanceTime(11);
      expect(limiter.allow()).toBe(true); // Window expired
    });

    it('should handle very large window', () => {
      const limiter = new RateLimiter({ limit: 2, window: 60000 }); // 1 minute
      
      expect(limiter.allow()).toBe(true);
      expect(limiter.allow()).toBe(true);
      expect(limiter.allow()).toBe(false);
      
      advanceTime(59999); // Just before window expires
      expect(limiter.allow()).toBe(false);
      
      advanceTime(2); // Total 60001ms
      expect(limiter.allow()).toBe(true);
    });

    it('should handle concurrent requests at same timestamp', () => {
      const limiter = new RateLimiter({ limit: 5, window: 1000 });
      
      // All at t=0
      for (let i = 0; i < 5; i++) {
        expect(limiter.allow()).toBe(true);
      }
      
      expect(limiter.allow()).toBe(false); // 6th rejected
    });
  });

  describe('Performance', () => {
    it('should efficiently clean old requests', () => {
      const limiter = new RateLimiter({ limit: 100, window: 1000 });
      
      // Fill with requests
      for (let i = 0; i < 100; i++) {
        limiter.allow();
      }
      
      // Advance time and make new request (should trigger cleanup)
      advanceTime(1001);
      
      const startTime = Date.now();
      limiter.allow(); // Should be fast (cleanup + allow)
      const duration = Date.now() - startTime;
      
      // Cleanup should be O(n) but fast for reasonable n
      expect(duration).toBeLessThan(10);
    });
  });
});
