/**
 * WebSocket Error Codes (Single Source of Truth)
 *
 * Centralized enum for all WebSocket error codes. Enables consistent
 * error handling, logging, and client-side error recovery strategies.
 *
 * Error Code Ranges:
 * - 1000-1999: Connection errors
 * - 2000-2999: Authentication/Authorization errors
 * - 3000-3999: Validation errors
 * - 4000-4999: Business logic errors (rooms, locks)
 * - 5000-5999: Server errors
 *
 * Usage:
 * ```typescript
 * throw new WsException({
 *   code: WsErrorCode.JWT_INVALID,
 *   message: WsErrorMessage[WsErrorCode.JWT_INVALID]
 * });
 * ```
 */
export enum WsErrorCode {
  // Connection errors (1000-1999)
  MAX_CONNECTIONS_EXCEEDED = 'WS_1001',
  CONNECTION_TIMEOUT = 'WS_1002',
  TRANSPORT_ERROR = 'WS_1003',

  // Authentication/Authorization errors (2000-2999)
  JWT_MISSING = 'WS_2001',
  JWT_INVALID = 'WS_2002',
  JWT_EXPIRED = 'WS_2003',
  UNAUTHORIZED = 'WS_2004',

  // Validation errors (3000-3999)
  INVALID_PAYLOAD = 'WS_3001',
  MISSING_REQUIRED_FIELD = 'WS_3002',
  INVALID_RESOURCE_TYPE = 'WS_3003',
  INVALID_ROOM_NAME = 'WS_3004',

  // Business logic errors (4000-4999)
  ROOM_FULL = 'WS_4001',
  ROOM_NOT_FOUND = 'WS_4002',
  LOCK_CONFLICT = 'WS_4003',
  LOCK_NOT_OWNED = 'WS_4004',
  RESOURCE_NOT_FOUND = 'WS_4005',
  RESOURCE_ALREADY_JOINED = 'WS_4006', // BE-001.2: Duplicate join attempt
  RESOURCE_NOT_JOINED = 'WS_4007', // BE-001.2: Leave without join
  INVALID_MODE = 'WS_4008', // BE-001.2: Invalid editor/viewer mode
  CONNECTION_NOT_FOUND = 'WS_4009', // BE-001.3: Connection info missing
  LOCK_ACQUIRE_FAILED = 'WS_4010', // BE-001.3: Lock acquire operation failed
  LOCK_RELEASE_FAILED = 'WS_4011', // BE-001.3: Lock release operation failed
  LOCK_EXTEND_FAILED = 'WS_4012', // BE-001.3: Lock extend operation failed
  LOCK_NOT_HELD = 'WS_4013', // BE-001.3: User doesn't hold the lock

  // Server errors (5000-5999)
  INTERNAL_SERVER_ERROR = 'WS_5001',
  SERVICE_UNAVAILABLE = 'WS_5002',
  RATE_LIMIT_EXCEEDED = 'WS_5003',
}

/**
 * WebSocket Error Messages (Single Source of Truth)
 *
 * Human-readable error messages mapped to error codes.
 * Supports internationalization (i18n) in future.
 *
 * Note: Keep messages generic to avoid leaking sensitive info.
 */
export const WsErrorMessage: Record<WsErrorCode, string> = {
  // Connection errors
  [WsErrorCode.MAX_CONNECTIONS_EXCEEDED]:
    'Maximum connections per user exceeded. Please close an existing connection.',
  [WsErrorCode.CONNECTION_TIMEOUT]: 'Connection timeout. Please try again.',
  [WsErrorCode.TRANSPORT_ERROR]: 'Transport connection error. Check network.',

  // Authentication/Authorization errors
  [WsErrorCode.JWT_MISSING]:
    'Authentication token missing. Please provide a valid JWT token.',
  [WsErrorCode.JWT_INVALID]:
    'Authentication token invalid. Please login again.',
  [WsErrorCode.JWT_EXPIRED]:
    'Authentication token expired. Please refresh your session.',
  [WsErrorCode.UNAUTHORIZED]: 'Unauthorized access. Insufficient permissions.',

  // Validation errors
  [WsErrorCode.INVALID_PAYLOAD]:
    'Invalid request payload. Check required fields.',
  [WsErrorCode.MISSING_REQUIRED_FIELD]: 'Missing required field in request.',
  [WsErrorCode.INVALID_RESOURCE_TYPE]:
    'Invalid resource type. Must be SURGICAL_OPERATION or ADMIN.',
  [WsErrorCode.INVALID_ROOM_NAME]: 'Invalid room name format.',

  // Business logic errors
  [WsErrorCode.ROOM_FULL]: 'Room capacity reached. Cannot join room.',
  [WsErrorCode.ROOM_NOT_FOUND]: 'Room not found. It may have been closed.',
  [WsErrorCode.LOCK_CONFLICT]: 'Resource is locked by another user.',
  [WsErrorCode.LOCK_NOT_OWNED]: 'You do not own this lock. Cannot release.',
  [WsErrorCode.RESOURCE_NOT_FOUND]: 'Resource not found.',
  [WsErrorCode.RESOURCE_ALREADY_JOINED]:
    'You have already joined this resource.',
  [WsErrorCode.RESOURCE_NOT_JOINED]:
    'You are not in this resource. Cannot leave.',
  [WsErrorCode.INVALID_MODE]:
    'Invalid collaboration mode. Must be "editor" or "viewer".',
  [WsErrorCode.CONNECTION_NOT_FOUND]:
    'Connection information not found. Please reconnect.',
  [WsErrorCode.LOCK_ACQUIRE_FAILED]:
    'Failed to acquire lock. Please try again.',
  [WsErrorCode.LOCK_RELEASE_FAILED]:
    'Failed to release lock. Please try again.',
  [WsErrorCode.LOCK_EXTEND_FAILED]: 'Failed to extend lock. Please try again.',
  [WsErrorCode.LOCK_NOT_HELD]:
    'You do not hold this lock. Cannot perform operation.',

  // Server errors
  [WsErrorCode.INTERNAL_SERVER_ERROR]:
    'Internal server error. Please try again later.',
  [WsErrorCode.SERVICE_UNAVAILABLE]:
    'Service temporarily unavailable. Please retry.',
  [WsErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please slow down.',
};

/**
 * WebSocket Error Response Interface
 *
 * Standardized error response structure for all WebSocket errors.
 *
 * @property code - Machine-readable error code (WsErrorCode)
 * @property message - Human-readable error message
 * @property timestamp - ISO 8601 timestamp when error occurred
 * @property details - Optional additional context (e.g., field name, validation errors)
 */
export interface WsErrorResponse {
  code: WsErrorCode;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
