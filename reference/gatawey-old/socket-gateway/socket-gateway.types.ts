import { Socket as BaseSocket, Server as BaseServer } from 'socket.io';
import { SocketData, SocketErrorCategory, SocketErrorDto, SocketEventName } from './socket-gateway.dto';


/**
 * Typed Socket with guaranteed SocketData structure
 * 
 * Extends Socket.IO base Socket to provide type-safe access to client.data
 */
export interface TypedSocket extends BaseSocket {
  data: SocketData;
}

/**
 * Type guard to check if a socket has been authenticated
 * 
 * @param socket - Socket.IO socket instance
 * @returns true if socket.data contains user and metadata
 */
export function isAuthenticatedSocket(socket: BaseSocket): socket is TypedSocket {
  return (
    socket.data !== undefined &&
    typeof socket.data === 'object' &&
    'user' in socket.data &&
    'metadata' in socket.data &&
    socket.data.user !== undefined &&
    socket.data.metadata !== undefined
  );
}

/**
 * Safely get transport name from Socket.IO connection
 * 
 * Accesses internal Engine.IO connection structure safely.
 * Returns 'unknown' if transport cannot be determined.
 * 
 * @param socket - Socket.IO socket instance
 * @returns Transport name ('websocket', 'polling', or 'unknown')
 */
export function getTransportName(socket: BaseSocket): string {
  try {
    // Engine.IO connection is internal, access safely
    const conn = socket.conn as any;
    if (conn && conn.transport && typeof conn.transport.name === 'string') {
      return conn.transport.name;
    }
    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Safely get a socket by ID from the server
 * 
 * Handles undefined server.sockets.sockets gracefully (e.g., in test contexts)
 * 
 * @param server - Socket.IO server instance
 * @param socketId - Socket ID to retrieve
 * @returns Socket instance or undefined if not found
 */
export function getSocketById(
  server: BaseServer,
  socketId: string,
): BaseSocket | undefined {
  try {
    return server?.sockets?.sockets?.get(socketId);
  } catch (error) {
    return undefined;
  }
}

/**
 * Initialize socket data structure
 * 
 * Type-safe way to set socket.data with proper structure
 * 
 * @param socket - Socket.IO socket instance
 * @param data - SocketData to assign
 */
export function initializeSocketData(
  socket: BaseSocket,
  data: SocketData,
): asserts socket is TypedSocket {
  socket.data = data;
}

/**
 * Validate that socket has been authenticated
 * 
 * Throws error if socket.data is not properly initialized
 * Use as type assertion for runtime validation
 * 
 * @param socket - Socket.IO socket instance
 * @throws Error if socket data is not initialized
 */
export function assertAuthenticatedSocket(
  socket: BaseSocket,
): asserts socket is TypedSocket {
  if (!isAuthenticatedSocket(socket)) {
    throw new Error('Socket data not initialized or invalid');
  }
}

/**
 * Create mock client for testing
 * 
 * Creates a minimal Socket.IO client mock with required properties
 * 
 * @param id - Socket ID
 * @returns Partial socket mock suitable for testing
 */
export function createMockClient(id: string): Partial<BaseSocket> {
  return {
    id,
    rooms: new Set<string>([id]),
    join: jest.fn((room: string) => {
      const socket = this as any;
      socket.rooms.add(room);
      return Promise.resolve();
    }),
    leave: jest.fn((room: string) => {
      const socket = this as any;
      socket.rooms.delete(room);
    }),
    emit: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
    data: {},
    handshake: {
      time: Date.now().toString(),
      address: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' },
    } as any,
  };
}

// ============================================
// TASK 8.3 - Error Handling Classes
// ============================================


/**
 * Custom Socket Exception
 * 
 * Used for known, operational errors in socket message handlers.
 * Provides structured error information for consistent client handling.
 * 
 * Examples:
 * ```typescript
 * // Validation error
 * throw new SocketException(
 *   SocketErrorCategory.VALIDATION,
 *   'INVALID_ROOM_ID',
 *   'Room ID must be a non-empty string'
 * );
 * 
 * // Authorization error
 * throw new SocketException(
 *   SocketErrorCategory.AUTHORIZATION,
 *   'PERMISSION_DENIED',
 *   'You do not have permission to join this room',
 *   { requiredRole: 'surgeon', userRole: 'nurse' }
 * );
 * ```
 */
export class SocketException extends Error {
  public readonly category: SocketErrorCategory;
  public readonly errorCode: string;
  public readonly details?: any;
  public readonly isOperational: boolean;
  public readonly statusCode: number;

  constructor(
    category: SocketErrorCategory,
    errorCode: string,
    message: string,
    details?: any,
    isOperational: boolean = true,
  ) {
    super(message);
    
    this.name = 'SocketException';
    this.category = category;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;
    
    // Map category to HTTP-like status code for logging
    this.statusCode = this.getStatusCodeForCategory(category);
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SocketException);
    }
  }

  /**
   * Convert SocketException to SocketErrorDto for client emission
   * 
   * @param socketId - Socket ID where error occurred
   * @param userId - User ID if authenticated (optional)
   * @param eventName - Event name that triggered error (optional, type-safe)
   * @returns Structured error DTO
   */
  toSocketErrorDto(
    socketId: string,
    userId?: string,
    eventName?: SocketEventName,
  ): Omit<SocketErrorDto, 'timestamp' | 'requestId'> {
    return {
      category: this.category,
      errorCode: this.errorCode,
      message: this.message,
      details: this.details,
      socketId,
      userId,
      eventName,
    };
  }

  /**
   * Map error category to HTTP-like status code
   * Useful for logging and metrics
   */
  private getStatusCodeForCategory(category: SocketErrorCategory): number {
    switch (category) {
      case SocketErrorCategory.VALIDATION:
        return 400; // Bad Request
      case SocketErrorCategory.AUTHORIZATION:
        return 403; // Forbidden
      case SocketErrorCategory.NOT_FOUND:
        return 404; // Not Found
      case SocketErrorCategory.CONFLICT:
        return 409; // Conflict
      case SocketErrorCategory.TIMEOUT:
        return 408; // Request Timeout
      case SocketErrorCategory.RATE_LIMIT:
        return 429; // Too Many Requests
      case SocketErrorCategory.INTERNAL:
      default:
        return 500; // Internal Server Error
    }
  }
}
