import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * WebSocket Gateway Configuration Service
 *
 * Provides type-safe access to WebSocket Gateway configuration using @nestjs/config.
 * All configuration values are validated on module initialization.
 *
 * Environment Variables:
 * - WEBSOCKET_ENABLED: Enable/disable WebSocket gateway (default: true)
 * - WEBSOCKET_PORT: WebSocket server port (default: 3001)
 * - WEBSOCKET_NAMESPACE: Socket.IO namespace (default: /collaboration)
 * - WEBSOCKET_PING_INTERVAL: Time between pings in ms (default: 25000)
 * - WEBSOCKET_PING_TIMEOUT: Pong timeout in ms (default: 20000)
 * - WEBSOCKET_MAX_CONNECTIONS_PER_USER: Max simultaneous connections per user (default: 5)
 *
 * Usage:
 * ```typescript
 * constructor(private readonly config: WebSocketGatewayConfigService) {}
 *
 * const port = this.config.getPort();
 * const pingInterval = this.config.getPingInterval();
 * ```
 *
 * @see EPIC-001-websocket-gateway.md BE-001.1
 */
@Injectable()
export class WebSocketGatewayConfigService {
  constructor(private readonly configService: ConfigService) {
    // Validate configuration on initialization
    if (this.isEnabled()) {
      this.validateConfig();
    }
  }

  /**
   * Check if WebSocket Gateway is enabled
   *
   * @returns true if WEBSOCKET_ENABLED is 'true' (default: true)
   */
  isEnabled(): boolean {
    return (
      this.configService.get<string>('WEBSOCKET_ENABLED', 'true') === 'true'
    );
  }

  /**
   * Get the WebSocket Gateway port
   *
   * @returns port number (default: 3001)
   */
  getPort(): number {
    return this.configService.get<number>('WEBSOCKET_PORT', 3001);
  }

  /**
   * Get the WebSocket Gateway namespace
   *
   * Socket.IO namespace for collaboration events.
   * Must start with '/'.
   *
   * @returns namespace string (default: '/collaboration')
   */
  getNamespace(): string {
    return this.configService.get<string>(
      'WEBSOCKET_NAMESPACE',
      '/collaboration',
    );
  }

  /**
   * Get CORS configuration
   *
   * CORS settings for WebSocket connections.
   * In production, restrict to specific origins.
   *
   * @returns CORS configuration object
   */
  getCorsConfig(): {
    origin: string | string[] | boolean;
    credentials: boolean;
  } {
    const origin = this.configService.get<string>('WEBSOCKET_CORS_ORIGIN', '*');

    return {
      origin: origin === '*' ? true : origin.split(','),
      credentials: true,
    };
  }

  /**
   * Get transports configuration
   *
   * Allowed Socket.IO transports.
   * Production should prefer 'websocket' for performance.
   *
   * @returns array of transport types (default: ['websocket', 'polling'])
   */
  getTransports(): string[] {
    const transports = this.configService.get<string>(
      'WEBSOCKET_TRANSPORTS',
      'websocket,polling',
    );

    return transports.split(',').map(t => t.trim());
  }

  /**
   * Get ping interval (time between pings)
   *
   * Heartbeat/Ping-Pong configuration.
   * Server sends ping every X milliseconds to check client health.
   *
   * @returns ping interval in milliseconds (default: 25000 = 25s)
   */
  getPingInterval(): number {
    return this.configService.get<number>('WEBSOCKET_PING_INTERVAL', 25000);
  }

  /**
   * Get ping timeout (time to wait for pong before considering connection dead)
   *
   * Heartbeat/Ping-Pong configuration.
   * If client doesn't respond with pong within X milliseconds, connection is closed.
   *
   * @returns ping timeout in milliseconds (default: 20000 = 20s)
   */
  getPingTimeout(): number {
    return this.configService.get<number>('WEBSOCKET_PING_TIMEOUT', 20000);
  }

  /**
   * Get max connections per user
   *
   * Connection Limits - prevent multi-tab abuse.
   * Limits number of simultaneous WebSocket connections per userId.
   *
   * @returns maximum number of simultaneous connections per user (default: 5)
   */
  getMaxConnectionsPerUser(): number {
    return this.configService.get<number>(
      'WEBSOCKET_MAX_CONNECTIONS_PER_USER',
      5,
    );
  }

  /**
   * Get room limits per resource type
   *
   * Max Users per Room - prevent overcrowding.
   * Different resource types can have different limits.
   *
   * @returns Record<string, number> mapping resource type to max users
   */
  getRoomLimits(): Record<string, number> {
    return {
      resourceType: this.configService.get<number>(
        'WEBSOCKET_ROOM_LIMIT_RESOURCE',
        20,
      ),
      admin_panel: this.configService.get<number>(
        'WEBSOCKET_ROOM_LIMIT_ADMIN',
        5,
      ),
      chat: this.configService.get<number>('WEBSOCKET_ROOM_LIMIT_CHAT', 100),
      default: this.configService.get<number>(
        'WEBSOCKET_ROOM_LIMIT_DEFAULT',
        50,
      ),
    };
  }

  /**
   * Get activity tracking configuration
   *
   * Lock TTL and Activity Tracking for distributed locks.
   * Used in BE-001.3 (Distributed Lock Management).
   *
   * @returns activity tracking configuration object
   */
  getActivityTrackingConfig(): {
    lockTTL: number;
    warningTime: number;
    sweepInterval: number;
    heartbeatInterval: number;
  } {
    return {
      // Lock TTL: 3 hours by default (time before lock expires due to inactivity)
      lockTTL: this.configService.get<number>(
        'WEBSOCKET_LOCK_TTL',
        3 * 60 * 60 * 1000,
      ), // 3h

      // Warning time: 15 minutes by default (warning sent before expiry)
      warningTime: this.configService.get<number>(
        'WEBSOCKET_LOCK_WARNING_TIME',
        15 * 60 * 1000,
      ), // 15 min

      // Sweep interval: 1 minute by default (how often to check for stale locks)
      sweepInterval: this.configService.get<number>(
        'WEBSOCKET_LOCK_SWEEP_INTERVAL',
        60 * 1000,
      ), // 1 min

      // Heartbeat interval: 60 seconds by default (expected client heartbeat frequency)
      heartbeatInterval: this.configService.get<number>(
        'WEBSOCKET_HEARTBEAT_INTERVAL',
        60 * 1000,
      ), // 60s
    };
  }

  /**
   * Validate the current configuration
   *
   * Throws error if configuration is invalid.
   * Called automatically on service initialization.
   *
   * @throws Error if configuration is invalid
   */
  private validateConfig(): void {
    const errors: string[] = [];

    this.validatePort(errors);
    this.validateNamespace(errors);
    this.validateCors(errors);
    this.validateTransports(errors);
    this.validatePingConfig(errors);
    this.validateMaxConnections(errors);

    if (errors.length > 0) {
      const errorList = errors.map(e => `  - ${e}`).join('\n');
      throw new Error(
        `WebSocket Gateway configuration validation failed:\n${errorList}`,
      );
    }
  }

  private validatePort(errors: string[]): void {
    const port = this.getPort();
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push(`Invalid WEBSOCKET_PORT: ${port} (must be 1-65535)`);
    }
  }

  private validateNamespace(errors: string[]): void {
    const namespace = this.getNamespace();
    if (!namespace.startsWith('/')) {
      errors.push(
        `Invalid WEBSOCKET_NAMESPACE: ${namespace} (must start with '/')`,
      );
    }
  }

  private validateCors(errors: string[]): void {
    const corsConfig = this.getCorsConfig();
    if (!corsConfig.origin) {
      errors.push('Invalid WEBSOCKET_CORS_ORIGIN: must be defined');
    }
  }

  private validateTransports(errors: string[]): void {
    const transports = this.getTransports();
    if (transports.length === 0) {
      errors.push(
        'Invalid WEBSOCKET_TRANSPORTS: must have at least one transport',
      );
    }
  }

  private validatePingConfig(errors: string[]): void {
    const pingInterval = this.getPingInterval();
    const pingTimeout = this.getPingTimeout();
    if (pingTimeout >= pingInterval) {
      errors.push(
        `Invalid ping config: PING_TIMEOUT (${pingTimeout}ms) < PING_INTERVAL (${pingInterval}ms) required`,
      );
    }
  }

  private validateMaxConnections(errors: string[]): void {
    const maxConnections = this.getMaxConnectionsPerUser();
    if (maxConnections < 1) {
      errors.push(
        `Invalid WEBSOCKET_MAX_CONNECTIONS_PER_USER: ${maxConnections} (must be >= 1)`,
      );
    }
  }
}
