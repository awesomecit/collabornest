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

  // Resource room management events (BE-001.2 Presence Tracking)
  RESOURCE_JOIN = 'resource:join', // Client → Server: Join resource room
  RESOURCE_LEAVE = 'resource:leave', // Client → Server: Leave resource room
  RESOURCE_JOINED = 'resource:joined', // Server → Client: Successfully joined
  RESOURCE_LEFT = 'resource:left', // Server → Client: Successfully left
  RESOURCE_GET_USERS = 'resource:get_users', // Client → Server: Request user list
  RESOURCE_USERS = 'resource:users', // Server → Client: User list response

  // Presence tracking broadcast events (BE-001.2)
  USER_JOINED = 'user:joined', // Server → All clients: Someone joined
  USER_LEFT = 'user:left', // Server → All clients: Someone left
  PRESENCE_UPDATE = 'presence:update', // Server → All clients: Presence changed

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
