import { Injectable, Logger } from '@nestjs/common';

/**
 * Socket Gateway Configuration Service
 * 
 * Provides access to Socket Gateway configuration loaded from socketgatewayconfig.js
 * The configuration is validated on module initialization if the gateway is enabled.
 */
@Injectable()
export class SocketGatewayConfigService {
  private readonly logger: Logger = new Logger(this.constructor.name);
  private readonly config: any;
  private readonly enabled: boolean;

  constructor() {
    // Load configuration from socketgatewayconfig.js
    // Validation is performed inside the config file if enabled
    this.config = require('../../socketgatewayconfig');
    this.enabled = this.config.SOCKET_GATEWAY_ENABLED || false;

    if (this.enabled) {
      this.logger.log(`Socket Gateway ENABLED - Port: ${this.config.port}, Namespace: ${this.config.namespace}`);
      
      // Perform additional validation via service method
      const validation = this.validateConfig();
      if (!validation.valid) {
        const errorMessage = `Configuration validation failed:\n${validation.errors.map(e => `  - ${e}`).join('\n')}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
    } else {
      this.logger.log('Socket Gateway DISABLED');
    }
  }

  /**
   * Check if Socket Gateway is enabled
   * @returns true if SOCKET_GATEWAY_ENABLED is true
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the full configuration object
   * @returns Socket Gateway configuration
   */
  getConfig(): any {
    return this.config;
  }

  /**
   * Get the Socket Gateway port
   * @returns port number
   */
  getPort(): number {
    return this.config.port;
  }

  /**
   * Get the Socket Gateway namespace
   * @returns namespace string
   */
  getNamespace(): string {
    return this.config.namespace;
  }

  /**
   * Get CORS configuration
   * @returns CORS configuration object
   */
  getCorsConfig(): any {
    return this.config.cors;
  }

  /**
   * Get transports configuration
   * @returns array of transport types
   */
  getTransports(): string[] {
    return this.config.transports;
  }

  /**
   * Get ping interval (time between pings)
   * Heartbeat/Ping-Pong configuration
   * @returns ping interval in milliseconds (default: 25000)
   */
  getPingInterval(): number {
    return this.config.connection?.pingInterval || 25000;
  }

  /**
   * Get ping timeout (time to wait for pong before considering connection dead)
   * Heartbeat/Ping-Pong configuration
   * @returns ping timeout in milliseconds (default: 20000)
   */
  getPingTimeout(): number {
    return this.config.connection?.pingTimeout || 20000;
  }

  /**
   * Get max connections per user
   * Connection Limits - prevent multi-tab abuse
   * @returns maximum number of simultaneous connections per user (default: 5)
   */
  getMaxConnectionsPerUser(): number {
    return this.config.limits?.maxConnectionsPerUser || 5;
  }

  /**
   * Get room limits per resource type
   * Max Users per Room - prevent overcrowding
   * @returns Record<string, number> mapping resource type to max users
   */
  getRoomLimits(): Record<string, number> {
    return {
      resourceType: this.config.roomLimits?.resourceType || 20,
      admin_panel: this.config.roomLimits?.admin_panel || 5,
      chat: this.config.roomLimits?.chat || 100,
      default: this.config.roomLimits?.default || 50,
    };
  }

  /**
   * Get activity tracking configuration
   * Lock TTL and Activity Tracking
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
      lockTTL: this.config.activityTracking?.lockTTL || 3 * 60 * 60 * 1000, // 3h
      
      // Warning time: 15 minutes by default (warning sent before expiry)
      warningTime: this.config.activityTracking?.warningTime || 15 * 60 * 1000, // 15 min
      
      // Sweep interval: 1 minute by default (how often to check for stale locks)
      sweepInterval: this.config.activityTracking?.sweepInterval || 60 * 1000, // 1 min
      
      // Heartbeat interval: 60 seconds by default (expected client heartbeat frequency)
      heartbeatInterval: this.config.activityTracking?.heartbeatInterval || 60 * 1000, // 60s
    };
  }

  /**
   * Check if auto-lock feature is enabled
   * 
   * Auto-lock allows clients to acquire lock automatically when joining a resource
   * by providing initialSubResourceId in the resource:join event.
   * 
   * Feature flag: features.enableAutoLock (default: true)
   * Environment variable: SOCKET_GATEWAY_ENABLE_AUTO_LOCK (overrides config file)
   * 
   * @returns true if auto-lock is enabled, false otherwise
   */
  isAutoLockEnabled(): boolean {
    // Environment variable override (highest priority)
    const envOverride = process.env.SOCKET_GATEWAY_ENABLE_AUTO_LOCK;
    if (envOverride !== undefined) {
      return envOverride === 'true' || envOverride === '1';
    }

    // Config file value (default: true)
    return this.config.features?.enableAutoLock !== false;
  }

  /**
   * Validate the current configuration
   * @returns validation result with valid flag and error list
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate PORT
    const port = this.config.port;
    if (!port || typeof port !== 'number' || port < 1 || port > 65535) {
      errors.push('Invalid PORT: must be a number between 1 and 65535');
    }

    // Validate NAMESPACE
    const namespace = this.config.namespace;
    if (!namespace || typeof namespace !== 'string' || !namespace.startsWith('/')) {
      errors.push('Invalid NAMESPACE: must be a string starting with "/"');
    }

    // Validate CORS
    const corsOrigin = this.config.cors?.origin;
    if (!corsOrigin) {
      errors.push('Invalid CORS_ORIGIN: must be defined');
    } else if (Array.isArray(corsOrigin) && corsOrigin.length === 0) {
      errors.push('Invalid CORS_ORIGIN: array must not be empty');
    }

    // Validate TRANSPORTS
    const transports = this.config.transports;
    if (!Array.isArray(transports) || transports.length === 0) {
      errors.push('Invalid TRANSPORTS: must be a non-empty array');
    } else if (!transports.every(t => typeof t === 'string')) {
      errors.push('Invalid TRANSPORTS: all elements must be strings');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Log client connection event
   * @param clientId - Unique client identifier
   * @param metadata - Additional connection metadata
   */
  logClientConnected(clientId: string, metadata?: any): void {
    if (!this.enabled) return;
    
    const metadataStr = metadata && Object.keys(metadata).length > 0 
      ? ` - ${JSON.stringify(metadata)}` 
      : '';
    this.logger.log(`[WebSocket] Client connected: ${clientId}${metadataStr}`);
  }

  /**
   * Log client disconnection event
   * @param clientId - Unique client identifier
   * @param reason - Disconnection reason
   */
  logClientDisconnected(clientId: string, reason?: string): void {
    if (!this.enabled) return;
    
    const reasonStr = reason ? ` - Reason: ${reason}` : ' - Reason: unknown';
    this.logger.log(`[WebSocket] Client disconnected: ${clientId}${reasonStr}`);
  }

  /**
   * Log unexpected client disconnection (network error, timeout, etc.)
   * @param clientId - Unique client identifier
   * @param error - Error details
   */
  logUnexpectedDisconnection(clientId: string, error?: any): void {
    if (!this.enabled) return;
    
    const errorStr = error ? ` - Error: ${error.message || JSON.stringify(error)}` : '';
    this.logger.warn(`Unexpected disconnection: ${clientId}${errorStr}`);
  }

  /**
   * Log socket gateway error
   * @param error - Error object or message
   * @param context - Additional error context
   */
  logError(error: any, context?: string): void {
    if (!this.enabled) return;
    
    const contextStr = context ? `[${context}] ` : '';
    const errorMsg = error.message || error;
    this.logger.error(`${contextStr}${errorMsg}`, error.stack);
  }
}
