import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import {
  WebSocketGateway as NestWebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtMockService } from './auth/jwt-mock.service';
import { WebSocketGatewayConfigService } from './config/gateway-config.service';
import {
  WsErrorCode,
  WsErrorMessage,
  WsErrorResponse,
  WsEvent,
} from './constants';
import {
  JoinResourceDto,
  LeaveResourceDto,
  ResourceAllUsersDto,
  ResourceJoinedDto,
  ResourceLeftDto,
  ResourceUser,
  ResourceUserDto,
  SubResourceUsers,
} from './dto/presence.dto';
import { getParentResourceId } from './types/resource.types';

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
  namespace: '/collaboration',
  path: '/ws/socket.io', // Custom path for Socket.IO endpoint (required for nginx proxy)
  transports: ['websocket', 'polling'], // Enable both transports (polling fallback for restrictive networks)
  cors: {
    origin: true, // Will be overridden by config in afterInit
    credentials: true,
  },
})
export class WebSocketGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnApplicationShutdown
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

  /**
   * Resource presence tracking: Map<resourceId, Map<socketId, ResourceUser>>
   *
   * Tracks users present in each resource room.
   * - Outer Map: resourceId → users in that resource
   * - Inner Map: socketId → ResourceUser details
   *
   * Used for:
   * - Real-time presence list (who's viewing/editing)
   * - Broadcast user:joined / user:left events
   * - Cleanup on disconnect (remove user from all resources)
   *
   * BE-001.2: Presence Tracking & Resource Rooms
   */
  private readonly resourceUsers = new Map<string, Map<string, ResourceUser>>();

  constructor(
    private readonly config: WebSocketGatewayConfigService,
    private readonly jwtService: JwtMockService,
  ) {}

  /**
   * Gateway initialization hook
   *
   * Called once when WebSocket server is ready.
   * Configures Socket.IO engine with ping/pong settings for zombie connection detection.
   *
   * Socket.IO Transport-Level Heartbeat:
   * - pingInterval: Time between automatic ping frames (default 25s)
   * - pingTimeout: Time to wait for pong before considering connection dead (default 20s)
   * - Automatic: Socket.IO client responds to ping with pong (no application code needed)
   * - Updates lastActivityAt: Connection pool tracks last activity for stale cleanup
   *
   * Application-Level Heartbeat (Future):
   * - user:heartbeat event for room-based activity tracking (lock TTL management)
   * - Deferred to room implementation phase (BE-001.2)
   *
   * @param server - Socket.IO server instance
   */
  afterInit(server: Server): void {
    // Configure Socket.IO engine ping/pong for zombie detection
    const pingInterval = this.config.getPingInterval() || 25000;
    const pingTimeout = this.config.getPingTimeout() || 20000;

    // Engine might not be initialized yet in test environment
    if (server.engine && server.engine.opts) {
      server.engine.opts.pingInterval = pingInterval;
      server.engine.opts.pingTimeout = pingTimeout;
    }

    // Add authentication middleware to validate JWT BEFORE connection
    server.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) {
          return next(new Error('JWT_MISSING'));
        }

        // Validate token (throws if invalid/expired)
        await this.jwtService.validateToken(token);
        next(); // Allow connection
      } catch (error) {
        // Reject connection with descriptive error
        next(new Error('JWT_INVALID: ' + (error as Error).message));
      }
    });

    console.log('[DEBUG][WS][Gateway] WebSocket Gateway initialized:', {
      namespace: this.config.getNamespace(),
      port: this.config.getPort(),
      pingInterval,
      pingTimeout,
      maxConnectionsPerUser: this.config.getMaxConnectionsPerUser(),
      timestamp: new Date().toISOString(),
    });

    console.log(
      `[DEBUG][WS][Gateway] Ping/Pong configured: interval=${pingInterval}ms, timeout=${pingTimeout}ms`,
    );
  }

  /**
   * Handle new client connection
   *
   * Authentication flow:
   * 1. Extract JWT from handshake.auth.token
   * 2. Validate with JwtMockService (signature, expiration, issuer, audience)
   * 3. Check max connections per user
   * 4. Add to connection pool and emit CONNECTED event
   *
   * Error handling:
   * - Missing token: Emit WsErrorCode.JWT_MISSING
   * - Invalid/expired token: Emit WsErrorCode.JWT_INVALID or WsErrorCode.JWT_EXPIRED
   * - Max connections exceeded: Disconnect silently (client receives 'disconnect' event)
   *
   * @param client - Socket.IO client socket
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token;
      this.logConnectionAttempt(client, token);

      // JWT validation already done in middleware (afterInit)
      // Extract user info from validated token
      const validatedUser = await this.jwtService.validateToken(token);

      // Step 1: Check max connections per user
      if (!this.checkMaxConnections(client, validatedUser.userId)) {
        return;
      }

      // Step 2: Add to connection pool
      this.addToConnectionPool(client, validatedUser);
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

    // Emit error event BEFORE disconnect so client can catch it
    client.emit(WsEvent.CONNECT_ERROR, errorResponse);

    // Disconnect after short delay to ensure error event is sent
    setTimeout(() => {
      client.disconnect(true);
    }, 100);
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
    validatedUser: { userId: string; username: string; email?: string },
  ): void {
    const connectionInfo: ConnectionInfo = {
      socketId: client.id!,
      userId: validatedUser.userId,
      username: validatedUser.username,
      email: validatedUser.email || 'unknown',
      transport: client.conn.transport.name,
      ipAddress: client.handshake.address,
      userAgent: client.handshake.headers['user-agent'] || 'unknown',
      connectedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };

    this.connectionPool.set(client.id!, connectionInfo);

    const userSocketIds =
      this.userConnections.get(validatedUser.userId) || new Set();
    userSocketIds.add(client.id!);
    this.userConnections.set(validatedUser.userId, userSocketIds);

    console.log('[DEBUG][WS][Gateway] Client connected successfully:', {
      socketId: client.id,
      userId: validatedUser.userId,
      username: validatedUser.username,
      transport: connectionInfo.transport,
      totalConnections: this.connectionPool.size,
      userConnections: userSocketIds.size,
    });

    client.emit(WsEvent.CONNECTED, {
      socketId: client.id,
      userId: validatedUser.userId,
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

    // BE-001.2: Cleanup presence tracking for all resources user was in
    this.cleanupUserFromAllResources(client, connectionInfo);

    console.log('[DEBUG][WS][Gateway] Connection pool updated:', {
      totalConnections: this.connectionPool.size,
      userId: connectionInfo.userId,
      userConnections: userSocketIds?.size || 0,
    });
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

  // ==============================================================================
  // BE-001.1 Step 4: Connection Pool Advanced Management
  // ==============================================================================

  /**
   * Get pool statistics (Step 4.2)
   *
   * Provides real-time metrics about connection pool state.
   *
   * @returns Pool statistics including total connections, unique users, transport breakdown, stale connections
   */
  getPoolStats(): {
    totalConnections: number;
    uniqueUsers: number;
    byTransport: { websocket: number; polling: number };
    staleConnections: number;
  } {
    const totalConnections = this.connectionPool.size;
    const uniqueUsers = this.userConnections.size;

    // Count by transport
    const byTransport = { websocket: 0, polling: 0 };
    for (const conn of this.connectionPool.values()) {
      if (conn.transport === 'websocket') {
        byTransport.websocket++;
      } else if (conn.transport === 'polling') {
        byTransport.polling++;
      }
    }

    // Count stale connections (inactive for > 2x pingTimeout)
    const staleThreshold = 2 * this.config.getPingTimeout(); // Default: 2 * 20s = 40s
    const now = Date.now();
    let staleConnections = 0;

    for (const conn of this.connectionPool.values()) {
      const inactiveMs = now - new Date(conn.lastActivityAt).getTime();
      if (inactiveMs > staleThreshold) {
        staleConnections++;
      }
    }

    return {
      totalConnections,
      uniqueUsers,
      byTransport,
      staleConnections,
    };
  }

  /**
   * Force disconnect a single connection (Step 4.3)
   *
   * Admin helper to forcibly disconnect a socket and cleanup pool.
   *
   * @param socketId - Socket.IO socket ID to disconnect
   */
  forceDisconnect(socketId: string): void {
    const socket = this.server.sockets.sockets.get(socketId);

    if (socket) {
      console.log('[DEBUG][WS][Gateway] Force disconnecting socket:', {
        socketId,
        timestamp: new Date().toISOString(),
      });
      socket.disconnect(true);
    }

    // Cleanup pool (in case socket was already gone)
    const connectionInfo = this.connectionPool.get(socketId);
    if (connectionInfo) {
      this.connectionPool.delete(socketId);

      // Cleanup user connections index
      const userSocketIds = this.userConnections.get(connectionInfo.userId);
      if (userSocketIds) {
        userSocketIds.delete(socketId);
        if (userSocketIds.size === 0) {
          this.userConnections.delete(connectionInfo.userId);
        }
      }
    }
  }

  /**
   * Disconnect all connections for a user (Step 4.3)
   *
   * Admin helper to disconnect all sockets for a specific user.
   *
   * @param userId - User identifier
   * @returns Number of connections disconnected
   */
  disconnectUser(userId: string): number {
    const userSocketIds = this.userConnections.get(userId);

    if (!userSocketIds || userSocketIds.size === 0) {
      return 0;
    }

    const count = userSocketIds.size;
    console.log('[DEBUG][WS][Gateway] Disconnecting all user connections:', {
      userId,
      count,
      timestamp: new Date().toISOString(),
    });

    // Clone set to avoid modification during iteration
    const socketIdsArray = Array.from(userSocketIds);
    socketIdsArray.forEach(socketId => this.forceDisconnect(socketId));

    return count;
  }

  /**
   * Cleanup stale connections (Step 4.1)
   *
   * Detects and forcibly disconnects connections that have been inactive
   * for longer than the stale threshold (2x pingTimeout).
   *
   * @returns Number of connections cleaned up
   */
  cleanupStaleConnections(): number {
    const staleThreshold = 2 * this.config.getPingTimeout(); // Default: 40s
    const now = Date.now();
    let cleanedUpCount = 0;

    const staleSocketIds: string[] = [];

    for (const [socketId, conn] of this.connectionPool.entries()) {
      const inactiveMs = now - new Date(conn.lastActivityAt).getTime();

      if (inactiveMs > staleThreshold) {
        console.warn('[DEBUG][WS][Gateway] Stale connection detected:', {
          socketId,
          userId: conn.userId,
          inactiveMs,
          threshold: staleThreshold,
          timestamp: new Date().toISOString(),
        });
        staleSocketIds.push(socketId);
      }
    }

    // Disconnect stale connections
    staleSocketIds.forEach(socketId => {
      this.forceDisconnect(socketId);
      cleanedUpCount++;
    });

    if (cleanedUpCount > 0) {
      console.log('[DEBUG][WS][Gateway] Stale connection cleanup completed:', {
        cleanedUpCount,
        remainingConnections: this.connectionPool.size,
        timestamp: new Date().toISOString(),
      });
    }

    return cleanedUpCount;
  }

  /**
   * Graceful shutdown (Step 4.5)
   *
   * Notifies all connected clients about server shutdown, waits for acknowledgments
   * (with timeout), then forcibly disconnects remaining clients and clears pool.
   *
   * @param options - Shutdown options (timeout, message)
   */
  async gracefulShutdown(options?: {
    timeout?: number;
    message?: string;
  }): Promise<void> {
    const timeout = options?.timeout || 5000; // Default: 5 seconds
    const message =
      options?.message || 'Server is shutting down for maintenance';

    console.log('[DEBUG][WS][Gateway] Graceful shutdown started:', {
      activeConnections: this.connectionPool.size,
      timeout,
      timestamp: new Date().toISOString(),
    });

    // Step 1: Notify all clients
    this.server.emit(WsEvent.SERVER_SHUTDOWN, {
      message,
      timestamp: new Date().toISOString(),
    });

    // Step 2: Wait for timeout
    await new Promise(resolve => setTimeout(resolve, timeout));

    // Step 3: Force disconnect remaining clients
    const socketIds = Array.from(this.connectionPool.keys());
    socketIds.forEach(socketId => this.forceDisconnect(socketId));

    console.log('[DEBUG][WS][Gateway] Graceful shutdown completed:', {
      disconnectedCount: socketIds.length,
      timestamp: new Date().toISOString(),
    });
  }

  // ==============================================================================
  // BE-001.2: Presence Tracking & Resource Rooms
  // ==============================================================================

  /**
   * Broadcast user:joined event to other users in resource
   */
  private broadcastUserJoined(
    client: Socket,
    resourceId: string,
    resourceUser: ResourceUser,
  ): void {
    client.to(resourceId).emit(WsEvent.USER_JOINED, {
      resourceId,
      userId: resourceUser.userId,
      username: resourceUser.username,
      email: resourceUser.email,
      socketId: client.id,
      joinedAt: resourceUser.joinedAt,
      mode: resourceUser.mode,
    });
  }

  /**
   * Add user to resource presence tracking
   */
  private addUserToResource(
    resourceId: string,
    client: Socket,
    connInfo: ConnectionInfo,
    mode: 'editor' | 'viewer',
  ): ResourceUser {
    const resourceUser: ResourceUser = {
      userId: connInfo.userId,
      username: connInfo.username,
      email: connInfo.email,
      socketId: client.id,
      joinedAt: new Date().toISOString(),
      mode,
      lastActivityAt: new Date().toISOString(),
    };

    if (!this.resourceUsers.has(resourceId)) {
      this.resourceUsers.set(resourceId, new Map());
    }
    this.resourceUsers.get(resourceId)!.set(client.id, resourceUser);

    return resourceUser;
  }

  /**
   * Get user list for resource (DTO format)
   */
  private getResourceUserList(resourceId: string): ResourceUserDto[] {
    const resourceUsersMap = this.resourceUsers.get(resourceId);
    if (!resourceUsersMap) return [];

    return Array.from(resourceUsersMap.values()).map(u => ({
      userId: u.userId,
      username: u.username,
      email: u.email,
      socketId: u.socketId,
      joinedAt: u.joinedAt,
      mode: u.mode,
    }));
  }

  /**
   * Create "already joined" error response
   */
  private createAlreadyJoinedResponse(
    resourceId: string,
    connInfo: ConnectionInfo,
  ): { event: string; data: ResourceJoinedDto } {
    return {
      event: WsEvent.RESOURCE_JOINED,
      data: {
        resourceId,
        userId: connInfo.userId,
        success: false,
        joinedAt: new Date().toISOString(),
        users: this.getResourceUserList(resourceId),
        message: WsErrorMessage[WsErrorCode.RESOURCE_ALREADY_JOINED],
      },
    };
  }

  /**
   * Emit cross-tab presence tracking (resource:all_users)
   *
   * If resourceId is a sub-resource (has parent), emits resource:all_users event
   * showing ALL users across ALL sub-resources (e.g., all tabs of a document).
   *
   * @param client - Socket.IO client to emit to
   * @param resourceId - Current resource ID
   */
  private emitCrossTabPresence(client: Socket, resourceId: string): void {
    const allUsers = this.getAllSubResourceUsers(resourceId);
    if (allUsers) {
      client.emit(WsEvent.RESOURCE_ALL_USERS, allUsers);
      console.log('[DEBUG][WS][Gateway] Sent all users for parent resource:', {
        parentResourceId: allUsers.parentResourceId,
        totalSubResources: allUsers.subResources.length,
        totalUsers: allUsers.totalCount,
      });
    }
  }

  /**
   * Get all users across all sub-resources of a parent resource
   *
   * Example: For "document:123/tab:patient", returns users from ALL tabs:
   * - document:123/tab:patient
   * - document:123/tab:diagnosis
   * - document:123/tab:procedure
   *
   * @param currentResourceId - Current sub-resource ID (e.g., "document:123/tab:patient")
   * @returns DTO with all users grouped by sub-resource
   */
  private getAllSubResourceUsers(
    currentResourceId: string,
  ): ResourceAllUsersDto | null {
    const parentResourceId = getParentResourceId(currentResourceId);

    // If no parent (top-level resource), return null
    if (!parentResourceId) {
      return null;
    }

    const subResources: SubResourceUsers[] = [];
    let totalCount = 0;

    // Iterate through all resource rooms to find matching sub-resources
    for (const [resourceId, usersMap] of this.resourceUsers.entries()) {
      // Check if this resource is a sub-resource of the parent
      if (
        resourceId.startsWith(parentResourceId + '/') ||
        resourceId === currentResourceId
      ) {
        const users = Array.from(usersMap.values()).map(u => ({
          userId: u.userId,
          username: u.username,
          email: u.email,
          socketId: u.socketId,
          joinedAt: u.joinedAt,
          mode: u.mode,
        }));

        if (users.length > 0) {
          subResources.push({
            subResourceId: resourceId,
            users,
          });
          totalCount += users.length;
        }
      }
    }

    return {
      parentResourceId,
      currentSubResourceId: currentResourceId,
      subResources,
      totalCount,
    };
  }

  /**
   * Remove user from resource presence tracking
   */
  private removeUserFromResource(resourceId: string, socketId: string): void {
    const resourceUsersMap = this.resourceUsers.get(resourceId);
    if (!resourceUsersMap) return;

    resourceUsersMap.delete(socketId);

    // Cleanup empty resource Map
    if (resourceUsersMap.size === 0) {
      this.resourceUsers.delete(resourceId);
    }
  }

  /**
   * Broadcast user:left event to OTHER users in resource
   */
  private broadcastUserLeft(
    client: Socket,
    resourceId: string,
    userId: string,
  ): void {
    const connInfo = this.connectionPool.get(client.id);
    if (!connInfo) return;

    client.to(resourceId).emit(WsEvent.USER_LEFT, {
      resourceId,
      userId,
      username: connInfo.username,
      email: connInfo.email,
    });
  }

  /**
   * Cleanup user from all resources on disconnect (BE-001.2)
   */
  private cleanupUserFromAllResources(
    client: Socket,
    connInfo: ConnectionInfo,
  ): void {
    const resourcesUserWasIn: string[] = [];

    // Find all resources user is in
    for (const [resourceId, usersMap] of this.resourceUsers) {
      if (usersMap.has(client.id)) {
        resourcesUserWasIn.push(resourceId);
      }
    }

    // Remove from each resource and broadcast
    for (const resourceId of resourcesUserWasIn) {
      this.removeUserFromResource(resourceId, client.id);
      client.to(resourceId).emit(WsEvent.USER_LEFT, {
        resourceId,
        userId: connInfo.userId,
        username: connInfo.username,
        email: connInfo.email,
        reason: 'disconnect',
      });
    }

    if (resourcesUserWasIn.length > 0) {
      console.log('[DEBUG][WS][Gateway] Cleanup user from resources:', {
        userId: connInfo.userId,
        resources: resourcesUserWasIn,
      });
    }
  }

  /**
   * Validate leave resource request
   * @returns Error response if invalid, undefined if valid
   */
  private validateLeaveResourcePayload(
    payload: LeaveResourceDto,
    connInfo: ConnectionInfo | undefined,
  ): ResourceLeftDto | undefined {
    // Check connection
    if (!connInfo) {
      return {
        resourceId: payload?.resourceId || 'unknown',
        userId: 'unknown',
        success: false,
        message: WsErrorMessage[WsErrorCode.JWT_INVALID],
      };
    }

    // Check resourceId
    if (!payload?.resourceId) {
      return {
        resourceId: 'unknown',
        userId: connInfo.userId,
        success: false,
        message: 'resourceId is required',
      };
    }

    return undefined;
  }

  /**
   * Validate join resource request
   * @returns Error response if invalid, undefined if valid
   */
  private validateJoinResourcePayload(
    payload: JoinResourceDto,
    connInfo: ConnectionInfo | undefined,
  ): ResourceJoinedDto | undefined {
    if (!connInfo) {
      return {
        resourceId: payload.resourceId,
        userId: 'unknown',
        success: false,
        joinedAt: new Date().toISOString(),
        users: [],
        message: 'Connection not found in pool',
      };
    }

    if (!payload.resourceId || !payload.mode) {
      return {
        resourceId: payload.resourceId || '',
        userId: connInfo.userId,
        success: false,
        joinedAt: new Date().toISOString(),
        users: [],
        message: 'Missing resourceId or mode',
      };
    }

    if (payload.mode !== 'editor' && payload.mode !== 'viewer') {
      return {
        resourceId: payload.resourceId,
        userId: connInfo.userId,
        success: false,
        joinedAt: new Date().toISOString(),
        users: [],
        message: WsErrorMessage[WsErrorCode.INVALID_MODE],
      };
    }

    return undefined; // Valid
  }

  /**
   * Handle resource:join event (BE-001.2)
   *
   * User joins a resource room for collaboration.
   * - Validates request payload
   * - Joins Socket.IO room
   * - Tracks user in presence Map
   * - Broadcasts user:joined to other users in resource
   * - Returns resource:joined with current user list
   *
   * @param client - Socket.IO client
   * @param payload - Join resource request DTO
   */
  @SubscribeMessage(WsEvent.RESOURCE_JOIN)
  async handleJoinResource(
    client: Socket,
    payload: JoinResourceDto,
  ): Promise<{ event: string; data: ResourceJoinedDto }> {
    const connInfo = this.connectionPool.get(client.id);

    // Validate payload
    const validationError = this.validateJoinResourcePayload(payload, connInfo);
    if (validationError) {
      return { event: WsEvent.RESOURCE_JOINED, data: validationError };
    }

    // Type guard: connInfo must be defined after validation
    if (!connInfo) {
      throw new Error('Connection info missing after validation');
    }

    const { resourceId, mode } = payload;

    // Check if already joined
    if (this.resourceUsers.get(resourceId)?.has(client.id)) {
      return this.createAlreadyJoinedResponse(resourceId, connInfo);
    }

    // Join Socket.IO room
    await client.join(resourceId);

    // Track user in presence Map
    const resourceUser = this.addUserToResource(
      resourceId,
      client,
      connInfo,
      mode,
    );

    console.log('[DEBUG][WS][Gateway] User joined resource:', {
      resourceId,
      userId: connInfo.userId,
      mode,
      totalUsersInResource: this.resourceUsers.get(resourceId)!.size,
    });

    // Broadcast user:joined to OTHER users in resource
    this.broadcastUserJoined(client, resourceId, resourceUser);

    // Emit cross-tab presence if sub-resource
    this.emitCrossTabPresence(client, resourceId);

    // Return resource:joined with current user list
    return {
      event: WsEvent.RESOURCE_JOINED,
      data: {
        resourceId,
        userId: connInfo.userId,
        success: true,
        joinedAt: resourceUser.joinedAt,
        users: this.getResourceUserList(resourceId),
      },
    };
  }

  /**
   * WebSocket event handler: Leave resource (BE-001.2 Task 3)
   *
   * @param client - Socket.IO client
   * @param payload - Leave resource request DTO
   */
  @SubscribeMessage(WsEvent.RESOURCE_LEAVE)
  async handleLeaveResource(
    client: Socket,
    payload: LeaveResourceDto,
  ): Promise<{ event: string; data: ResourceLeftDto }> {
    const connInfo = this.connectionPool.get(client.id);

    // Validate payload
    const validationError = this.validateLeaveResourcePayload(
      payload,
      connInfo,
    );
    if (validationError) {
      return { event: WsEvent.RESOURCE_LEFT, data: validationError };
    }

    if (!connInfo) {
      throw new Error('Connection info missing after validation');
    }

    const { resourceId } = payload;

    // Check if user is in resource
    if (!this.resourceUsers.get(resourceId)?.has(client.id)) {
      return {
        event: WsEvent.RESOURCE_LEFT,
        data: {
          resourceId,
          userId: connInfo.userId,
          success: false,
          message: WsErrorMessage[WsErrorCode.RESOURCE_NOT_JOINED],
        },
      };
    }

    // Remove user from presence tracking
    this.removeUserFromResource(resourceId, client.id);

    // Leave Socket.IO room
    await client.leave(resourceId);

    console.log('[DEBUG][WS][Gateway] User left resource:', {
      resourceId,
      userId: connInfo.userId,
      remainingUsers: this.resourceUsers.get(resourceId)?.size || 0,
    });

    // Broadcast user:left to OTHER users in resource
    this.broadcastUserLeft(client, resourceId, connInfo.userId);

    // Return resource:left confirmation
    return {
      event: WsEvent.RESOURCE_LEFT,
      data: {
        resourceId,
        userId: connInfo.userId,
        success: true,
      },
    };
  }

  /**
   * NestJS lifecycle hook: Application shutdown (Step 4.5)
   *
   * Called when NestJS application is shutting down (SIGTERM, SIGINT, etc.).
   * Triggers graceful shutdown to cleanup connections.
   *
   * @param signal - Shutdown signal (SIGTERM, SIGINT, etc.)
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    console.log('[DEBUG][WS][Gateway] Application shutdown signal received:', {
      signal,
      timestamp: new Date().toISOString(),
    });

    await this.gracefulShutdown({ timeout: 3000 }); // Shorter timeout for signals
  }
}
