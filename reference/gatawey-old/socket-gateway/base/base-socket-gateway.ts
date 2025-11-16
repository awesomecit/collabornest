import {
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { SocketGatewayConfigService } from '../socket-gateway-config.service';
import { JwtPayload } from '../../common/base.service';
import {
  AuthenticatedUser,
  ConnectionInfo,
  GracefulShutdownOptions,
  SocketErrorDto,
  SocketErrorCategory,
  SocketEventName,
} from '../socket-gateway.dto';
import {
  TypedSocket,
  initializeSocketData,
  getTransportName,
  getSocketById,
  SocketException,
} from '../socket-gateway.types';

/**
 * BaseSocketGateway - Abstract Infrastructure Class
 * 
 * Generic WebSocket gateway infrastructure for NestJS + Socket.IO.
 * Provides authentication, connection lifecycle, error handling, and graceful shutdown.
 * 
 * ## Purpose
 * - Reusable infrastructure for any domain-specific gateway
 * - Clear separation: infrastructure vs business logic
 * - Hooks pattern for subclass customization
 * 
 * ## Features
 * - ✅ JWT authentication with Keycloak payload
 * - ✅ Connection pool tracking
 * - ✅ Max connections per user enforcement
 * - ✅ Graceful shutdown with client notification
 * - ✅ Centralized error handling (SocketException pattern)
 * - ✅ Structured logging (connection lifecycle, errors)
 * - ✅ Type-safe socket data management
 * 
 * ## Usage
 * ```typescript
 * @WebSocketGateway({ namespace: '/my-namespace' })
 * export class MyGateway extends BaseSocketGateway {
 *   constructor(configService: SocketGatewayConfigService) {
 *     super(configService, MyGateway.name);
 *   }
 *   
 *   protected onClientAuthenticated(client: TypedSocket): void {
 *     // Custom initialization after auth
 *   }
 *   
 *   protected onClientDisconnecting(client: TypedSocket): void {
 *     // Custom cleanup before disconnect
 *   }
 *   
 *   @SubscribeMessage('my:event')
 *   handleMyEvent(@MessageBody() data, @ConnectedSocket() client) {
 *     try {
 *       // Business logic
 *     } catch (error) {
 *       this.handleSocketError(error, client, 'my:event');
 *     }
 *   }
 * }
 * ```
 * 
 * ## Hooks
 * - `onClientAuthenticated(client)`: Called after successful authentication
 * - `onClientDisconnecting(client)`: Called before disconnect processing
 * 
 * ## Protected Methods Available to Subclasses
 * - `getUserConnections(userId): string[]` - Query connection pool
 * - `handleSocketError(error, client, eventName)` - Centralized error handling
 * 
 * @see REFACTOR_2.1_EXTRACT_BASE_GATEWAY_PLAN.md - Full refactoring specification
 */
@Injectable()
export abstract class BaseSocketGateway
  implements
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnApplicationShutdown {
  @WebSocketServer()
  protected server: Server;

  protected readonly logger: Logger;

  // Connection Pool Tracking
  protected readonly connectionPool = new Map<string, ConnectionInfo>();

  // Timer Management - Store timer references for proper cleanup
  private shutdownTimer?: NodeJS.Timeout;

  /**
   * Constructor
   * 
   * @param configService - Socket gateway configuration service
   * @param loggerContext - Logger context name (typically subclass name)
   */
  constructor(
    protected readonly configService: SocketGatewayConfigService,
    loggerContext: string,
  ) {
    this.logger = new Logger(loggerContext);
    this.logger.log(`${loggerContext} constructor called`);
  }

  // ============================================================================
  // Lifecycle Hooks (OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect)
  // ============================================================================

  /**
   * Lifecycle Hook: After Gateway Initialization
   * 
   * Basic initialization logging
   * Configure ping/pong mechanism for zombie detection // TOCHECK: test
   * 
   * Called by NestJS after the WebSocket server is fully initialized.
   */
  afterInit(server: Server): void {
    // Check if gateway is enabled in configuration
    if (!this.configService.isEnabled()) {
      this.logger.warn(
        '⚠️  Socket Gateway is DISABLED - WebSocket server will not accept connections',
      );
      return;
    }

    // Load configuration
    const port = this.configService.getPort();
    const namespace = this.configService.getNamespace();
    const corsConfig = this.configService.getCorsConfig();
    const transports = this.configService.getTransports();

    // Configure ping/pong for heartbeat
    const pingInterval = this.configService.getPingInterval() || 25000;
    const pingTimeout = this.configService.getPingTimeout() || 20000;

    // Configure Socket.IO engine options (if engine exists)
    // Note: engine may not be initialized in some test scenarios
    if (server.engine) {
      server.engine.opts.pingInterval = pingInterval;
      server.engine.opts.pingTimeout = pingTimeout;
    }

    // Log initialization success
    this.logger.log('='.repeat(60));
    this.logger.log('✓ WebSocket Gateway initialized successfully');
    this.logger.log(`Port: ${port}`);
    this.logger.log(`Namespace: ${namespace}`);
    this.logger.log(`CORS Origins: ${JSON.stringify(corsConfig.origin)}`);
    this.logger.log(`Transports: ${transports.join(', ')}`);
    this.logger.log(`Ping Interval: ${pingInterval}ms`);
    this.logger.log(`Ping Timeout: ${pingTimeout}ms`);
    this.logger.log('='.repeat(60));
  }

  /**
   * Lifecycle Hook: Client Connection
   * 
   * JWT Authentication & User Extraction
   * Max Connections per User Enforcement
   *
   * Called when a client establishes a WebSocket connection.
   * Validates JWT token, enforces connection limits, and calls subclass hook.
   * 
   * @param client - TypedSocket client
   */
  handleConnection(client: TypedSocket): void {
    // Immediately disconnect if gateway is disabled
    if (!this.configService.isEnabled()) {
      client.disconnect(true);
      return;
    }

    // Log connection attempt
    this.logger.log(`[WebSocket] Client attempting to connect: ${client.id}`);

    // Authenticate client with JWT token
    try {
      const authenticatedUser = this.authenticateClient(client);

      // Store authenticated user data and metadata (type-safe)
      initializeSocketData(client, {
        user: authenticatedUser,
        metadata: {
          ipAddress: client.handshake.address,
          userAgent: client.handshake.headers['user-agent'] || 'unknown',
          connectedAt: Date.now(),
        },
      });

      // Log successful authentication with detailed connection info
      this.logger.log(JSON.stringify({
        event: '[WebSocket] USER_AUTHENTICATED',
        userId: authenticatedUser.userId,
        username: authenticatedUser.username,
        roles: authenticatedUser.roles,
        socketId: client.id,
        transport: getTransportName(client),
        ipAddress: client.handshake.address,
        referer: client.handshake.headers['referer'] || client.handshake.headers['origin'] || 'unknown',
        queryParams: client.handshake.query,
        existingConnections: this.getUserConnections(authenticatedUser.userId).length,
      }));

      // Enforce max connections per user
      const maxConnections = this.configService.getMaxConnectionsPerUser();
      const userConnections = this.getUserConnections(authenticatedUser.userId);
      const currentCount = userConnections.length;

      // Reject connection if limit exceeded
      if (currentCount >= maxConnections) {
        const rejection = {
          reason: 'MAX_CONNECTIONS_EXCEEDED',
          limit: maxConnections,
          current: currentCount,
          message: `Maximum number of concurrent connections (${maxConnections}) exceeded. Please disconnect an existing session.`,
          retryAfter: 5000,
        };

        client.emit('connection:rejected', rejection);

        this.logger.warn(JSON.stringify({
          event: 'CONNECTION_REJECTED',
          reason: 'MAX_CONNECTIONS_EXCEEDED',
          userId: authenticatedUser.userId,
          username: authenticatedUser.username,
          currentConnections: currentCount,
          maxConnections,
          socketId: client.id,
        }));

        client.disconnect(true);
        return;
      }

      // Emit warning if approaching limit (80% threshold)
      const percentageUsed = (currentCount / maxConnections) * 100;
      if (percentageUsed >= 80) {
        const warning = {
          limit: maxConnections,
          current: currentCount + 1, // +1 because we're about to add this connection
          percentageUsed,
          message: `You are approaching the maximum connection limit (${currentCount + 1}/${maxConnections})`,
        };

        client.emit('connection:warning', warning);

        this.logger.warn(JSON.stringify({
          event: 'CONNECTION_WARNING',
          userId: authenticatedUser.userId,
          username: authenticatedUser.username,
          currentConnections: currentCount + 1,
          maxConnections,
          percentageUsed: Math.round(percentageUsed),
          socketId: client.id,
        }));
      }

      // Emit authenticated event to client
      client.emit('authenticated', {
        success: true,
        user: {
          userId: authenticatedUser.userId,
          username: authenticatedUser.username,
          firstName: authenticatedUser.firstName,
          lastName: authenticatedUser.lastName,
          email: authenticatedUser.email,
          roles: authenticatedUser.roles,
        },
      });

      // Task 1.2.5: Add connection to pool (type-safe)
      const transport = getTransportName(client);
      const connectionInfo: ConnectionInfo = {
        socketId: client.id,
        userId: authenticatedUser.userId,
        username: authenticatedUser.username,
        connectedAt: client.data.metadata.connectedAt,
        transport,
        metadata: client.data.metadata,
      };

      this.connectionPool.set(client.id, connectionInfo);

      // Log connection success with config service
      this.configService.logClientConnected(client.id, {
        userId: authenticatedUser.userId,
        username: authenticatedUser.username,
        transport,
      });

      // Call subclass hook for custom initialization
      this.onClientAuthenticated(client);
    } catch (error) {
      // Authentication failed
      const errorMessage = error instanceof Error ? error.message : 'UNKNOWN_ERROR';

      this.logger.warn(JSON.stringify({
        event: 'AUTH_FAILED',
        socketId: client.id,
        reason: errorMessage,
        ip: client.handshake.address,
      }));

      // Emit authentication failure event
      client.emit('authenticated', {
        success: false,
        error: errorMessage,
      });

      // Disconnect client after auth failure
      setTimeout(() => {
        client.disconnect(true);
      }, 100); // Small delay to ensure auth failure message is sent
    }
  }

  /**
   * Lifecycle Hook: Client Disconnection
   * 
   * Disconnect Logging with Metadata
   * Disconnect Reason Categorization
   * 
   * Called when a client disconnects from the WebSocket.
   * Calls subclass hook for custom cleanup, then removes from pool.
   * 
   * @param client - TypedSocket client
   */
  handleDisconnect(client: TypedSocket): void {
    // Skip processing if gateway is disabled
    if (!this.configService.isEnabled()) {
      return;
    }

    const userId = client.data?.user?.userId;
    const username = client.data?.user?.username;
    const connectedAt = client.data?.metadata?.connectedAt;

    // Note: Socket.IO v4 doesn't pass reason to handleDisconnect in all cases
    // We need to access it from client.disconnectReason if available
    const reason = (client as any).disconnectReason || 'unknown';

    // Calculate session duration
    const sessionDuration = connectedAt ? Date.now() - connectedAt : 0;
    const sessionDurationMinutes = Math.floor(sessionDuration / 1000 / 60);

    // Categorize disconnect reason
    let disconnectCategory: string;
    let disconnectDescription: string;

    switch (reason) {
      case 'transport close':
        disconnectCategory = 'NORMAL';
        disconnectDescription =
          'Client closed connection normally (browser close, navigation)';
        break;
      case 'ping timeout':
        disconnectCategory = 'TIMEOUT';
        disconnectDescription =
          'Client failed to respond to ping (network issue or zombie)';
        break;
      case 'transport error':
        disconnectCategory = 'ERROR';
        disconnectDescription =
          'Transport error - WebSocket or polling failure';
        break;
      case 'server namespace disconnect':
        disconnectCategory = 'SERVER_INITIATED';
        disconnectDescription = 'Server forcefully disconnected the client';
        break;
      case 'client namespace disconnect':
        disconnectCategory = 'CLIENT_INITIATED';
        disconnectDescription = 'Client explicitly called disconnect()';
        break;
      default:
        disconnectCategory = 'UNKNOWN';
        disconnectDescription = `Reason: ${reason}`;
    }

    // Get transport type
    const transport = getTransportName(client);

    // Call subclass hook for custom cleanup BEFORE removing from pool
    // This allows subclass to access connection info if needed
    this.onClientDisconnecting(client);

    // Remove from connection pool
    this.connectionPool.delete(client.id);

    // Log disconnect with structured metadata
    // Use warn for UNKNOWN/ERROR, log for normal disconnects
    const logLevel =
      disconnectCategory === 'ERROR' ? 'error' :
        disconnectCategory === 'UNKNOWN' ? 'warn' :
          'log';
    this.logger[logLevel](JSON.stringify({
      event: '[WebSocket] CLIENT_DISCONNECTED',
      socketId: client.id,
      userId: userId || 'unknown',
      username: username || 'unknown',
      disconnectReason: reason,
      disconnectCategory,
      disconnectDescription,
      sessionDuration: `${sessionDuration}ms`,
      sessionDurationMinutes: `${sessionDurationMinutes}min`,
      transport,
      roomsLeft: [], // Subclass can override this in hook
      roomCount: 0,
      ip: client.handshake?.address || 'unknown',
      userAgent: client.handshake?.headers?.['user-agent'] || 'unknown',
      timestamp: new Date().toISOString(),
    }));

    // Log with config service
    this.configService.logClientDisconnected(client.id, reason);

    // Clean up all listeners to prevent memory leaks
    client.removeAllListeners();
  }

  // ============================================================================
  // Abstract Hooks for Subclasses
  // ============================================================================

  /**
   * Hook: Called after client is authenticated but before connection is fully established.
   * 
   * Subclass can perform custom initialization (e.g., load user data, join default rooms).
   * 
   * @param client - Authenticated socket client
   */
  protected abstract onClientAuthenticated(
    client: TypedSocket,
  ): void | Promise<void>;

  /**
   * Hook: Called before client disconnect is processed.
   * 
   * Subclass can perform custom cleanup (e.g., leave rooms, notify other users).
   * Called BEFORE connection is removed from pool, so pool info is still accessible.
   * 
   * @param client - Socket client being disconnected
   */
  protected abstract onClientDisconnecting(
    client: TypedSocket,
  ): void | Promise<void>;

  // ============================================================================
  // Authentication Logic (Private - Infrastructure)
  // ============================================================================

  /**
   * Authenticate Client with JWT Token
   * 
   * Extracts and validates JWT token from handshake.
   * Decodes JWT payload and extracts user information.
   * 
   * @param client - Socket.IO client
   * @returns Authenticated user data
   * @throws Error if authentication fails
   * @private
   */
  private authenticateClient(client: Socket): AuthenticatedUser {
    // Check if token exists
    const token = client.handshake.auth?.token;
    if (!token) {
      throw new Error('MISSING_TOKEN');
    }

    // Decode JWT token using existing utility
    // Note: This mimics the JWTDecode method from BaseService
    let jwtPayload: JwtPayload;
    try {
      const base64Payload = token.split('.')[1];
      if (!base64Payload) {
        throw new Error('INVALID_TOKEN');
      }

      const payloadBuffer = Buffer.from(base64Payload, 'base64');
      jwtPayload = JSON.parse(payloadBuffer.toString()) as JwtPayload;
    } catch (error) {
      throw new Error('INVALID_TOKEN');
    }

    // Check token expiration
    if (jwtPayload.exp) {
      const now = Math.floor(Date.now() / 1000);
      if (jwtPayload.exp < now) {
        throw new Error('TOKEN_EXPIRED');
      }
    }

    // Extract user data from JWT payload (JwtPayload already has email field)
    const authenticatedUser: AuthenticatedUser = {
      userId: jwtPayload.sub,
      username: jwtPayload.preferred_username,
      firstName: jwtPayload.given_name,
      lastName: jwtPayload.family_name,
      email: jwtPayload.email || jwtPayload.email_address,
      roles: jwtPayload.realm_access?.roles || [],
    };

    // Validate required fields
    if (!authenticatedUser.userId || !authenticatedUser.username) {
      throw new Error('INVALID_TOKEN');
    }

    return authenticatedUser;
  }

  // ============================================================================
  // Connection Pool Management (Protected - Available to Subclasses)
  // ============================================================================

  /**
   * Get user connections from connection pool
   * 
   * Returns array of socket IDs for a given userId.
   * Used to enforce max connections per user limit.
   * 
   * @param userId - User ID to count connections for
   * @returns Array of socket IDs belonging to this user
   * @protected
   */
  protected getUserConnections(userId: string): string[] {
    const connections: string[] = [];

    for (const [socketId, connInfo] of this.connectionPool.entries()) {
      if (connInfo.userId === userId) {
        connections.push(socketId);
      }
    }

    return connections;
  }

  // ============================================================================
  // Error Handling (Protected - Available to Subclasses)
  // ============================================================================

  /**
   * Centralized Error Handler
   * 
   * Handles errors from socket message handlers with structured logging and client notification.
   * Distinguishes between operational errors (SocketException) and unexpected errors.
   * 
   * Error Handling Strategy:
   * - SocketException: Known, operational errors (validation, authorization, etc.)
   *   → Log as WARN with context
   *   → Emit socket:error to client with structured data
   *   → Do NOT disconnect client (graceful degradation)
   * 
   * - Unexpected Error: Unknown errors (programming bugs, infrastructure failures)
   *   → Log as ERROR with full stack trace
   *   → Emit socket:error with generic INTERNAL category
   *   → Do NOT disconnect client (graceful degradation)
   * 
   * @param error - Error object (SocketException or generic Error)
   * @param client - Socket.IO client where error occurred
   * @param eventName - Event name that triggered the error (for context, type-safe)
   * @protected
   */
  protected handleSocketError(
    error: Error | SocketException,
    client: TypedSocket,
    eventName?: SocketEventName,
  ): void {
    const userId = client.data?.user?.userId;
    const username = client.data?.user?.username;

    // Prepare base error DTO
    const baseErrorDto: Omit<
      SocketErrorDto,
      'category' | 'errorCode' | 'message' | 'details'
    > = {
      timestamp: Date.now(),
      socketId: client.id,
      userId,
      eventName,
    };

    let errorDto: SocketErrorDto;

    if (error instanceof SocketException) {
      // Operational error - expected, known error
      errorDto = {
        ...baseErrorDto,
        ...error.toSocketErrorDto(client.id, userId, eventName),
      };

      // Log as WARN with context
      this.logger.warn(JSON.stringify({
        event: 'SOCKET_ERROR',
        category: error.category,
        errorCode: error.errorCode,
        message: error.message,
        details: error.details,
        socketId: client.id,
        userId,
        username,
        eventName,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
      }));
    } else {
      // Unexpected error - programming bug or infrastructure failure
      errorDto = {
        ...baseErrorDto,
        category: SocketErrorCategory.INTERNAL,
        errorCode: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again later.',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      };

      // Log as ERROR with full stack trace
      this.logger.error(JSON.stringify({
        event: 'SOCKET_ERROR_UNEXPECTED',
        category: 'INTERNAL',
        errorCode: 'INTERNAL_ERROR',
        message: error.message,
        stack: error.stack,
        socketId: client.id,
        userId,
        username,
        eventName,
        error: error.toString(),
      }));
    }

    // Emit socket:error to client (graceful degradation - do not disconnect)
    client.emit('socket:error', errorDto);

    // Log error with config service
    this.configService.logError(error, eventName || 'unknown');
  }

  // ============================================================================
  // Graceful Shutdown (Public - Infrastructure)
  // ============================================================================

  /**
   * Graceful Shutdown
   * 
   * Gracefully shuts down the WebSocket gateway:
   * 1. Logs shutdown start with active connection count
   * 2. Notifies all connected clients via 'server:shutdown' event
   * 3. Waits for timeout period (clients can gracefully disconnect)
   * 4. Force disconnects remaining clients
   * 5. Clears connection pool
   * 6. Logs shutdown completion
   * 
   * @param options - Graceful shutdown options (timeout, message, reconnectIn)
   */
  async gracefulShutdown(options?: GracefulShutdownOptions): Promise<void> {
    const timeout = options?.timeout || 5000;
    const message = options?.message || 'Server is shutting down gracefully';
    const reconnectIn = options?.reconnectIn || 5000;

    // 1. Log shutdown start
    const activeConnections = this.connectionPool.size;
    this.logger.log(JSON.stringify({
      event: 'SHUTDOWN_STARTED',
      activeConnections,
      timeout,
      timestamp: new Date().toISOString(),
    }));

    // 2. Notify all connected clients
    this.server.emit('server:shutdown', {
      message,
      reconnectIn,
      timestamp: Date.now(),
    });

    // 3. Wait for timeout period (clients can gracefully disconnect)
    // Store timer reference for proper cleanup
    await new Promise((resolve) => {
      this.shutdownTimer = setTimeout(() => {
        this.shutdownTimer = undefined; // Clear reference after execution
        resolve(undefined);
      }, timeout);
    });

    // 4. Force disconnect all remaining clients (type-safe access)
    let forcedDisconnects = 0;

    for (const [socketId] of this.connectionPool) {
      const socket = getSocketById(this.server, socketId);
      if (socket) {
        socket.disconnect(true);
        forcedDisconnects++;
      }
    }

    // 5. Clear connection pool
    this.connectionPool.clear();

    // 6. Log shutdown completion
    this.logger.log(JSON.stringify({
      event: 'SHUTDOWN_COMPLETED',
      disconnected: activeConnections,
      forced: forcedDisconnects,
      timestamp: new Date().toISOString(),
    }));
  }

  /**
   * Cleanup method for resource disposal
   * 
   * Clears all active timers to prevent memory leaks.
   * Should be called before destroying the gateway instance.
   */
  cleanup(): void {
    if (this.shutdownTimer) {
      clearTimeout(this.shutdownTimer);
      this.shutdownTimer = undefined;

      this.logger.log(JSON.stringify({
        event: 'TIMER_CLEANUP',
        message: 'Shutdown timer cleared',
        timestamp: new Date().toISOString(),
      }));
    }
  }

  /**
   * NestJS Lifecycle Hook: Application Shutdown
   * 
   * Integrates our custom gracefulShutdown() with NestJS lifecycle management.
   * Called automatically when NestJS application is shutting down.
   * 
   * @param signal - Shutdown signal (SIGTERM, SIGINT, etc.)
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(JSON.stringify({
      event: 'APPLICATION_SHUTDOWN',
      signal: signal || 'unknown',
      timestamp: new Date().toISOString(),
    }));

    await this.gracefulShutdown();
  }
}
