import { HttpStatus } from '@nestjs/common';

/**
 * HTTP Error Codes (Single Source of Truth)
 *
 * Centralized enum for all HTTP error codes. Uses NestJS HttpStatus enum
 * for standard HTTP status codes, with custom error codes for business logic.
 *
 * Error Code Ranges (aligned with WsErrorCode):
 * - 1000-1999: Connection/Network errors
 * - 2000-2999: Authentication/Authorization errors
 * - 3000-3999: Validation errors
 * - 4000-4999: Business logic errors
 * - 5000-5999: Server errors
 *
 * Usage:
 * ```typescript
 * throw new HttpException(
 *   {
 *     code: HttpErrorCode.RESOURCE_NOT_FOUND,
 *     message: HttpErrorMessage[HttpErrorCode.RESOURCE_NOT_FOUND]
 *   },
 *   HttpStatus.NOT_FOUND
 * );
 * ```
 *
 * @see https://docs.nestjs.com/exception-filters
 */
export enum HttpErrorCode {
  // Authentication/Authorization errors (2000-2999)
  UNAUTHORIZED = 'HTTP_2001',
  FORBIDDEN = 'HTTP_2002',
  TOKEN_EXPIRED = 'HTTP_2003',
  INVALID_CREDENTIALS = 'HTTP_2004',

  // Validation errors (3000-3999)
  VALIDATION_FAILED = 'HTTP_3001',
  INVALID_INPUT = 'HTTP_3002',
  MISSING_REQUIRED_FIELD = 'HTTP_3003',
  INVALID_FORMAT = 'HTTP_3004',

  // Business logic errors (4000-4999)
  RESOURCE_NOT_FOUND = 'HTTP_4001',
  RESOURCE_ALREADY_EXISTS = 'HTTP_4002',
  OPERATION_NOT_ALLOWED = 'HTTP_4003',
  CONCURRENT_MODIFICATION = 'HTTP_4004',

  // Server errors (5000-5999)
  INTERNAL_SERVER_ERROR = 'HTTP_5001',
  SERVICE_UNAVAILABLE = 'HTTP_5002',
  DATABASE_ERROR = 'HTTP_5003',
  EXTERNAL_SERVICE_ERROR = 'HTTP_5004',
}

/**
 * HTTP Error Messages (Single Source of Truth)
 *
 * Human-readable error messages mapped to error codes.
 * Supports internationalization (i18n) in future.
 *
 * Note: Keep messages generic to avoid leaking sensitive info.
 */
export const HttpErrorMessage: Record<HttpErrorCode, string> = {
  // Authentication/Authorization errors
  [HttpErrorCode.UNAUTHORIZED]: 'Authentication required. Please login.',
  [HttpErrorCode.FORBIDDEN]: 'Access forbidden. Insufficient permissions.',
  [HttpErrorCode.TOKEN_EXPIRED]: 'Session expired. Please login again.',
  [HttpErrorCode.INVALID_CREDENTIALS]: 'Invalid username or password.',

  // Validation errors
  [HttpErrorCode.VALIDATION_FAILED]:
    'Request validation failed. Check input data.',
  [HttpErrorCode.INVALID_INPUT]: 'Invalid input data. Check request format.',
  [HttpErrorCode.MISSING_REQUIRED_FIELD]: 'Missing required field in request.',
  [HttpErrorCode.INVALID_FORMAT]: 'Invalid data format. Check documentation.',

  // Business logic errors
  [HttpErrorCode.RESOURCE_NOT_FOUND]: 'Resource not found.',
  [HttpErrorCode.RESOURCE_ALREADY_EXISTS]:
    'Resource already exists. Cannot create duplicate.',
  [HttpErrorCode.OPERATION_NOT_ALLOWED]:
    'Operation not allowed in current state.',
  [HttpErrorCode.CONCURRENT_MODIFICATION]:
    'Resource modified by another user. Please refresh and retry.',

  // Server errors
  [HttpErrorCode.INTERNAL_SERVER_ERROR]:
    'Internal server error. Please try again later.',
  [HttpErrorCode.SERVICE_UNAVAILABLE]:
    'Service temporarily unavailable. Please retry.',
  [HttpErrorCode.DATABASE_ERROR]: 'Database error. Please contact support.',
  [HttpErrorCode.EXTERNAL_SERVICE_ERROR]:
    'External service error. Please try again later.',
};

/**
 * HTTP Error Response Interface
 *
 * Standardized error response structure for all HTTP errors.
 * Aligns with WsErrorResponse for consistency across protocols.
 *
 * @property statusCode - HTTP status code (from @nestjs/common HttpStatus)
 * @property code - Machine-readable error code (HttpErrorCode)
 * @property message - Human-readable error message
 * @property timestamp - ISO 8601 timestamp when error occurred
 * @property path - Request path that triggered the error
 * @property details - Optional additional context (e.g., validation errors)
 */
export interface HttpErrorResponse {
  statusCode: HttpStatus;
  code: HttpErrorCode;
  message: string;
  timestamp: string;
  path: string;
  details?: Record<string, unknown>;
}

/**
 * Map HttpErrorCode to appropriate HttpStatus
 *
 * Provides consistent HTTP status codes for each error type.
 * Used by exception filters to set response status.
 */
export const HttpErrorStatusMap: Record<HttpErrorCode, HttpStatus> = {
  // Authentication/Authorization errors → 401/403
  [HttpErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [HttpErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [HttpErrorCode.TOKEN_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [HttpErrorCode.INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,

  // Validation errors → 400
  [HttpErrorCode.VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [HttpErrorCode.INVALID_INPUT]: HttpStatus.BAD_REQUEST,
  [HttpErrorCode.MISSING_REQUIRED_FIELD]: HttpStatus.BAD_REQUEST,
  [HttpErrorCode.INVALID_FORMAT]: HttpStatus.BAD_REQUEST,

  // Business logic errors → 404/409/422
  [HttpErrorCode.RESOURCE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [HttpErrorCode.RESOURCE_ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [HttpErrorCode.OPERATION_NOT_ALLOWED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [HttpErrorCode.CONCURRENT_MODIFICATION]: HttpStatus.CONFLICT,

  // Server errors → 500/503
  [HttpErrorCode.INTERNAL_SERVER_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [HttpErrorCode.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [HttpErrorCode.DATABASE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
  [HttpErrorCode.EXTERNAL_SERVICE_ERROR]: HttpStatus.BAD_GATEWAY,
};
