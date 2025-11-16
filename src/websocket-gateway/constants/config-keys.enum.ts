/**
 * WebSocket Gateway Configuration Keys (SSOT)
 *
 * Single Source of Truth for all environment variable names.
 * Prevents typos and enables type-safe configuration access.
 *
 * NEVER use magic strings directly - always import from this enum.
 */

/**
 * WebSocket Gateway configuration environment variable keys
 */
export enum WebSocketConfigKey {
  // Core settings
  ENABLED = 'WEBSOCKET_ENABLED',
  PORT = 'WEBSOCKET_PORT',
  NAMESPACE = 'WEBSOCKET_NAMESPACE',
  CORS_ORIGIN = 'WEBSOCKET_CORS_ORIGIN',
  TRANSPORTS = 'WEBSOCKET_TRANSPORTS',

  // Heartbeat/Ping-Pong
  PING_INTERVAL = 'WEBSOCKET_PING_INTERVAL',
  PING_TIMEOUT = 'WEBSOCKET_PING_TIMEOUT',

  // Connection limits
  MAX_CONNECTIONS_PER_USER = 'WEBSOCKET_MAX_CONNECTIONS_PER_USER',

  // Room limits per resource type
  ROOM_LIMIT_RESOURCE = 'WEBSOCKET_ROOM_LIMIT_RESOURCE',
  ROOM_LIMIT_ADMIN = 'WEBSOCKET_ROOM_LIMIT_ADMIN',
  ROOM_LIMIT_CHAT = 'WEBSOCKET_ROOM_LIMIT_CHAT',
  ROOM_LIMIT_DEFAULT = 'WEBSOCKET_ROOM_LIMIT_DEFAULT',

  // Lock/Activity tracking
  LOCK_TTL = 'WEBSOCKET_LOCK_TTL',
  LOCK_WARNING_TIME = 'WEBSOCKET_LOCK_WARNING_TIME',
  LOCK_SWEEP_INTERVAL = 'WEBSOCKET_LOCK_SWEEP_INTERVAL',
  HEARTBEAT_INTERVAL = 'WEBSOCKET_HEARTBEAT_INTERVAL',
}

/**
 * JWT authentication configuration keys
 */
export enum JwtConfigKey {
  SECRET = 'JWT_SECRET',
  ISSUER = 'JWT_ISSUER',
  AUDIENCE = 'JWT_AUDIENCE',
  EXPIRES_IN = 'JWT_EXPIRES_IN',
}
