/**
 * WebSocket Event Names (Single Source of Truth)
 *
 * Centralized enum for all WebSocket event names to ensure consistency
 * across gateway, clients, and tests. Prevents typos and enables
 * type-safe event handling.
 *
 * Usage:
 * ```typescript
 * client.emit(WsEvent.CONNECTED, data);
 * client.on(WsEvent.JOIN_ROOM, handler);
 * ```
 *
 * @see https://socket.io/docs/v4/emitting-events/
 */
export enum WsEvent {
  // Connection lifecycle events (custom)
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',

  /**
   * @deprecated DO NOT USE - Reserved by Socket.IO, cannot be emitted manually
   * @see https://socket.io/docs/v4/client-api/#event-connect_error
   * Use client.disconnect(true) instead for auth failures
   */
  CONNECT_ERROR = 'connect_error', // Reserved by Socket.IO specification

  // Room management events (BE-001.2)
  JOIN_ROOM = 'JOIN_ROOM',
  LEAVE_ROOM = 'LEAVE_ROOM',
  ROOM_JOINED = 'ROOM_JOINED',
  ROOM_LEFT = 'ROOM_LEFT',

  // Presence tracking events (BE-001.2)
  USER_JOINED = 'USER_JOINED',
  USER_LEFT = 'USER_LEFT',
  PRESENCE_UPDATE = 'PRESENCE_UPDATE',

  // Lock management events (BE-001.3)
  LOCK_ACQUIRED = 'LOCK_ACQUIRED',
  LOCK_RELEASED = 'LOCK_RELEASED',
  LOCK_STOLEN = 'LOCK_STOLEN',

  // Activity tracking events (BE-001.3)
  ACTIVITY_PING = 'ACTIVITY_PING',
  ACTIVITY_PONG = 'ACTIVITY_PONG',

  // Server management events (BE-001.1 Step 4)
  SERVER_SHUTDOWN = 'SERVER_SHUTDOWN',

  // Y.js CRDT sync events (BE-001.4)
  SYNC_STEP_1 = 'SYNC_STEP_1',
  SYNC_STEP_2 = 'SYNC_STEP_2',
  SYNC_UPDATE = 'SYNC_UPDATE',
  AWARENESS_UPDATE = 'AWARENESS_UPDATE',
}
