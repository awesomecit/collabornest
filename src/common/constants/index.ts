/**
 * Common Constants - Barrel Export
 *
 * Single Source of Truth for all common constants:
 * - HTTP error codes and messages
 * - Error messages (deprecated, use HttpErrorCode instead)
 *
 * Usage:
 * ```typescript
 * import { HttpErrorCode, HttpErrorMessage, HttpStatus } from '@/common/constants';
 * ```
 */

// HTTP Error Codes (SSOT)
export {
  HttpErrorCode,
  HttpErrorMessage,
  HttpErrorResponse,
  HttpErrorStatusMap,
} from './http-error-codes.enum';

// Re-export NestJS HttpStatus for convenience
export { HttpStatus } from '@nestjs/common';

// Legacy error messages (deprecated)
export { ERROR_MESSAGES } from './error-messages.constants';
