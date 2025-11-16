import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway as NestWebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WebSocketGatewayConfigService } from './config/gateway-config.service';
import {
  WsErrorCode,
  WsErrorMessage,
  WsErrorResponse,
  WsEvent,
} from './constants';

/**
 * Connection Information
 *
 * Tracks metadata for each active WebSocket connection.
 * Stored in connection pool for presence tracking and connection management.
 */
export interface ConnectionInfo {
  /** Unique socket identifier (Socket.IO id) */
  socketId: string;

  /** User identifier from JWT token */
  userId: string;

  /** Username from JWT token (preferred_username claim) */
  username: string;

  /** Email from JWT token */
  email: string;

  /** Transport type (websocket or polling) */
  transport: string;

  /** Client IP address */
  ipAddress: string;

  /** User-Agent header */
  userAgent: string;

  /** Connection timestamp (ISO 8601) */
  connectedAt: string;

  /** Last activity timestamp (updated on heartbeat) */
  lastActivityAt: string;
}

/**
 * WebSocket Gateway for Real-time Collaboration
 *
 * Implements BE-001.1: WebSocket Connection Management
 * - JWT authentication
 * - Connection pool tracking
 * - Heartbeat ping/pong mechanism
 * - Max connections per user enforcement
 *
 * Features:
 * - Socket.IO namespace: /collaboration
 * - CORS configuration from environment
 * - Ping interval: 25s (configurable)
 * - Ping timeout: 20s (configurable)
 * - Max connections per user: 5 (configurable)
 *
 * Usage:
 * ```typescript
 * // Client-side (JavaScript)
 * const socket = io('http://localhost:3001/collaboration', {
 *   auth: { token: 'your-jwt-token' },
 *   transports: ['websocket']
 * });
 *
 * socket.on('connect', () => {
 *   console.log('Connected:', socket.id);
 * });
 * ```
 *
 * @see EPIC-001-websocket-gateway.md BE-001.1
 */
@Injectable()
@NestWebSocketGateway({
  namespace: '/collaboration', // Will be overridden by config
  cors: {
    origin: true, // Will be overridden by config
    credentials: true,
  },
})
export class WebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  /**
   * Connection pool: Map<socketId, ConnectionInfo>
   *
   * Tracks all active WebSocket connections.
   * Used for presence tracking, max connections enforcement, and debugging.
   */
  private readonly connectionPool = new Map<string, ConnectionInfo>();

  /**
   * User connections index: Map<userId, Set<socketId>>
   *
   * Tracks all socket IDs for each user.
   * Used for max connections per user enforcement.
   */
  private readonly userConnections = new Map<string, Set<string>>();

  constructor(private readonly config: WebSocketGatewayConfigService) {}

  /**
   * Gateway initialization hook
   *
   * Called once when WebSocket server is ready.
   * Configures Socket.IO server with settings from config service.
   *
   * @param _server - Socket.IO server instance (unused, config done in decorator)
   */
  afterInit(_server: Server): void {
    const pingInterval = this.config.getPingInterval();
    const pingTimeout = this.config.getPingTimeout();

    console.log('[DEBUG][WS][Gateway] WebSocket Gateway initialized:', {
      namespace: this.config.getNamespace(),
      port: this.config.getPort(),
      pingInterval,
      pingTimeout,
      maxConnectionsPerUser: this.config.getMaxConnectionsPerUser(),
      timestamp: new Date().toISOString(),
    });

    // Note: Socket.IO v4+ configures ping/pong via constructor options
    // We set these in @WebSocketGateway decorator or via adapter
    // For now, just log the configuration (actual config happens in module setup)
  }

  /**
   * Handle new client connection
   *
   * Validates JWT, checks max connections, adds to pool.
   *
   * @param client - Socket.IO client socket
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token;
      this.logConnectionAttempt(client, token);

      const decoded = this.mockDecodeJWT(token);
      if (!decoded) {
        const errorCode = !token
          ? WsErrorCode.JWT_MISSING
          : WsErrorCode.JWT_INVALID;
        this.rejectConnection(client, errorCode);
        return;
      }

      if (!this.checkMaxConnections(client, decoded.userId)) {
        return;
      }

      this.addToConnectionPool(client, decoded);
    } catch (error) {
      this.handleConnectionError(client, error);
    }
  }

  private logConnectionAttempt(client: Socket, token?: string): void {
    console.log('[DEBUG][WS][Gateway] New connection attempt:', {
      socketId: client.id,
      transport: client.conn.transport.name,
      token: token ? `${token.substring(0, 20)}...` : 'MISSING',
      timestamp: new Date().toISOString(),
    });
  }

  private rejectConnection(client: Socket, errorCode: WsErrorCode): void {
    const errorResponse: WsErrorResponse = {
      code: errorCode,
      message: WsErrorMessage[errorCode],
      timestamp: new Date().toISOString(),
    };

    console.error('[DEBUG][WS][Gateway] Connection rejected:', {
      socketId: client.id,
      errorCode,
      message: errorResponse.message,
    });

    client.emit(WsEvent.CONNECT_ERROR, errorResponse);
    client.disconnect(true);
  }

  private checkMaxConnections(client: Socket, userId: string): boolean {
    const userSocketIds = this.userConnections.get(userId) || new Set();
    const maxConnections = this.config.getMaxConnectionsPerUser();

    if (userSocketIds.size >= maxConnections) {
      console.warn('[DEBUG][WS][Gateway] Max connections exceeded:', {
        userId,
        currentConnections: userSocketIds.size,
        maxConnections,
      });

      // Socket.IO pattern: disconnect with server-side logging
      // Client receives 'disconnect' event with reason
      client.disconnect(true);
      return false;
    }

    return true;
  }

  private addToConnectionPool(
    client: Socket,
    decoded: { userId: string; username: string; email: string },
  ): void {
    const connectionInfo: ConnectionInfo = {
      socketId: client.id!,
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      transport: client.conn.transport.name,
      ipAddress: client.handshake.address,
      userAgent: client.handshake.headers['user-agent'] || 'unknown',
      connectedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    this.connectionPool.set(client.id!, connectionInfo);

    const userSocketIds = this.userConnections.get(decoded.userId) || new Set();
    userSocketIds.add(client.id!);
    this.userConnections.set(decoded.userId, userSocketIds);

    console.log('[DEBUG][WS][Gateway] Client connected successfully:', {
      socketId: client.id,
      userId: decoded.userId,
      username: decoded.username,
      transport: connectionInfo.transport,
      totalConnections: this.connectionPool.size,
      userConnections: userSocketIds.size,
    });

    client.emit(WsEvent.CONNECTED, {
      socketId: client.id,
      userId: decoded.userId,
      timestamp: connectionInfo.connectedAt,
    });
  }

  private handleConnectionError(client: Socket, error: any): void {
    console.error('[DEBUG][WS][Gateway] Connection error:', {
      socketId: client.id,
      error: error.message,
      stack: error.stack,
    });

    // Socket.IO pattern: disconnect with server-side logging
    // 'connect_error' is a reserved event name, cannot emit manually
    client.disconnect(true);
  }

  /**
   * Handle client disconnection
   *
   * Lifecycle:
   * 1. Retrieve connection info from pool
   * 2. Remove from connection pool
   * 3. Update user connections index
   * 4. Log disconnection event
   *
   * @param client - Socket.IO client socket
   */
  handleDisconnect(client: Socket): void {
    const connectionInfo = this.connectionPool.get(client.id);

    if (!connectionInfo) {
      console.warn('[DEBUG][WS][Gateway] Disconnect for unknown socket:', {
        socketId: client.id,
      });
      return;
    }

    console.log('[DEBUG][WS][Gateway] Client disconnected:', {
      socketId: client.id,
      userId: connectionInfo.userId,
      username: connectionInfo.username,
      duration: Date.now() - new Date(connectionInfo.connectedAt).getTime(),
      timestamp: new Date().toISOString(),
    });

    // Remove from connection pool
    this.connectionPool.delete(client.id);

    // Update user connections index
    const userSocketIds = this.userConnections.get(connectionInfo.userId);
    if (userSocketIds) {
      userSocketIds.delete(client.id);

      if (userSocketIds.size === 0) {
        this.userConnections.delete(connectionInfo.userId);
      }
    }

    console.log('[DEBUG][WS][Gateway] Connection pool updated:', {
      totalConnections: this.connectionPool.size,
      userId: connectionInfo.userId,
      userConnections: userSocketIds?.size || 0,
    });
  }

  /**
   * Mock JWT decoder for TDD (temporary)
   *
   * TODO: Replace with real JWT validation using @nestjs/jwt
   * - Verify signature with public key
   * - Check expiration (exp claim)
   * - Validate issuer (iss claim)
   *
   * @param token - JWT token string
   * @returns Decoded JWT payload or null if invalid
   */
  private mockDecodeJWT(token: string): {
    userId: string;
    username: string;
    email: string;
  } | null {
    if (!token) {
      return null;
    }

    try {
      // Basic JWT format validation
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode payload (Base64)
      const payload = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf8'),
      );

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        console.warn('[DEBUG][WS][Gateway] JWT token expired:', {
          exp: payload.exp,
          now,
        });
        return null;
      }

      return {
        userId: payload.sub,
        username: payload.preferred_username,
        email: payload.email,
      };
    } catch (error) {
      console.error('[DEBUG][WS][Gateway] JWT decode error:', error.message);
      return null;
    }
  }

  // ==================== Test Helper Methods ====================
  // These methods are exposed for testing purposes only

  /**
   * Get connection information by socket ID
   *
   * @param socketId - Socket.IO socket ID
   * @returns Connection info or undefined
   */
  getConnectionInfo(socketId: string): ConnectionInfo | undefined {
    return this.connectionPool.get(socketId);
  }

  /**
   * Get total number of connections in pool
   *
   * @returns Number of active connections
   */
  getConnectionPoolSize(): number {
    return this.connectionPool.size;
  }

  /**
   * Check if socket ID exists in connection pool
   *
   * @param socketId - Socket.IO socket ID
   * @returns true if connection exists
   */
  hasConnection(socketId: string): boolean {
    return this.connectionPool.has(socketId);
  }

  /**
   * Get all connections for a specific user
   *
   * @param userId - User identifier
   * @returns Array of connection info for user
   */
  getConnectionsByUserId(userId: string): ConnectionInfo[] {
    const socketIds = this.userConnections.get(userId);
    if (!socketIds) {
      return [];
    }

    return Array.from(socketIds)
      .map(socketId => this.connectionPool.get(socketId))
      .filter((info): info is ConnectionInfo => info !== undefined);
  }

  /**
   * Get connection pool (for debugging)
   *
   * @returns Map of all connections
   * @internal
   */
  getConnectionPool(): Map<string, ConnectionInfo> {
    return this.connectionPool;
  }
}
