/**
 * Disconnect Reasons (Single Source of Truth)
 *
 * Centralized enum for disconnect event reasons.
 * Used in lock cleanup, presence tracking, and audit logs.
 *
 * Usage:
 * ```typescript
 * client.emit('user:left', {
 *   reason: DisconnectReason.USER_DISCONNECTED
 * });
 * ```
 */
export enum DisconnectReason {
  /** User socket disconnected (network/client close) */
  USER_DISCONNECTED = 'user_disconnected',

  /** Admin forced disconnect */
  ADMIN_DISCONNECT = 'admin_disconnect',

  /** User manually left resource */
  USER_LEFT = 'user_left',

  /** Max connections exceeded */
  MAX_CONNECTIONS = 'max_connections',

  /** Server shutdown */
  SERVER_SHUTDOWN = 'server_shutdown',
}
