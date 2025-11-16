/**
 * Common Constants - Barrel Export
 *
 * Single Source of Truth for all common constants:
 * - HTTP status codes (re-exported from @nestjs/common)
 * - Error messages
 *
 * Usage:
 * ```typescript
 * import { HttpStatus, ERROR_MESSAGES } from '@/common/constants';
 * ```
 */

// Re-export NestJS HttpStatus for convenience
export { HttpStatus } from '@nestjs/common';

// Error messages constants
export { ERROR_MESSAGES } from './error-messages.constants';
