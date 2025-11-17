/**
 * WebSocket Error Response Interface
 *
 * Provides both machine-readable (code) and human-readable (type) error identifiers.
 *
 * @example
 * {
 *   code: 'WS_4013',           // Machine ID for monitoring/logging
 *   type: 'LOCK_NOT_HELD',     // Human ID for frontend switch/case
 *   message: 'You do not hold this lock',
 *   details: { resourceId: '...', userId: '...' }
 * }
 */
export interface WsError {
  /**
   * Machine-readable error code (enum value)
   * Format: WS_XXXX
   * Use for: Monitoring, logging, alerting
   */
  code: string;

  /**
   * Human-readable error type (enum key)
   * Format: SNAKE_CASE
   * Use for: Frontend error handling, switch/case statements
   */
  type: string;

  /**
   * Human-readable error message
   * Localization-friendly string
   */
  message: string;

  /**
   * Optional context data for debugging
   */
  details?: Record<string, any>;
}
