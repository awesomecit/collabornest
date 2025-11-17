/**
 * Health Check Service
 *
 * Implements health check logic for API readiness and resource configuration validation.
 *
 * @see EPIC-004: Resource Configuration Management
 */

import { HttpStatus, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import {
  EVENT_ROUTING,
  TransportProtocol,
} from '../config/api-contracts.types';
import { WebSocketGatewayConfigService } from '../config/gateway-config.service';
import {
  ResourceConfig,
  ResourceType,
  SURGERY_CONFIG,
} from '../config/resource-config.types';

/**
 * Service health status
 */
export interface ServiceStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  error?: string;
}

/**
 * Readiness check response
 */
export interface ReadinessResponse {
  ready: boolean;
  status: number;
  services: ServiceStatus[];
  timestamp: string;
}

/**
 * Resource configuration response
 */
export interface ResourceConfigResponse {
  resources: ResourceType[];
  configurations: Record<ResourceType, ResourceConfig>;
  validationStatus: Record<ResourceType, 'valid' | 'invalid'>;
  timestamp: string;
}

/**
 * API capabilities response
 */
export interface CapabilitiesResponse {
  version: string;
  supportedProtocols: TransportProtocol[];
  supportedResources: ResourceType[];
  eventRouting: typeof EVENT_ROUTING;
  features: {
    distributedLocking: boolean;
    optimisticConcurrency: boolean;
    stateTransitions: boolean;
    roleBasedAccess: boolean;
  };
  timestamp: string;
}

@Injectable()
export class HealthCheckService {
  private redis: Redis | null = null;
  private redisOwned = false;

  constructor(
    private readonly config?: WebSocketGatewayConfigService,
    redisInstance?: Redis,
  ) {
    if (redisInstance) {
      this.redis = redisInstance;
      this.redisOwned = false;
    } else if (config) {
      const redisConfig = config.getRedisConfig();
      this.redis = new Redis(redisConfig);
      this.redisOwned = true;
    }
  }

  /**
   * Cleanup on service destroy
   */
  async onModuleDestroy() {
    if (this.redis && this.redisOwned) {
      await this.redis.quit();
    }
  }

  /**
   * Basic health check (always returns 200 if service is running)
   * @returns Basic status
   */
  basicCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Readiness check (validates all dependencies)
   * @returns Readiness status
   */
  async readinessCheck(): Promise<ReadinessResponse> {
    const services: ServiceStatus[] = [];

    // Check Redis
    services.push(await this.checkRedis());

    // Check database (if applicable)
    // services.push(await this.checkDatabase());

    // Check message queue (if applicable)
    // services.push(await this.checkMessageQueue());

    const allUp = services.every(s => s.status === 'up');

    return {
      ready: allUp,
      status: allUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
      services,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Resource configuration check
   * @returns Resource configurations and validation status
   */
  async resourceConfigCheck(): Promise<ResourceConfigResponse> {
    // Load from ResourceConfigRegistry
    // TODO: Inject ResourceConfigRegistryService via constructor
    // For now, return static example config (will be replaced when registry is wired)
    const configurations: Record<ResourceType, ResourceConfig> = {
      [ResourceType.SURGERY]: SURGERY_CONFIG,
      // Add other resource configs here
    } as Record<ResourceType, ResourceConfig>;

    const resources = Object.keys(configurations) as ResourceType[];

    const validationStatus: Record<ResourceType, 'valid' | 'invalid'> =
      {} as Record<ResourceType, 'valid' | 'invalid'>;

    for (const resourceType of resources) {
      validationStatus[resourceType] = this.validateResourceConfig(
        configurations[resourceType],
      )
        ? 'valid'
        : 'invalid';
    }

    return {
      resources,
      configurations,
      validationStatus,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * API capabilities check
   * @returns API capabilities
   */
  capabilitiesCheck(): CapabilitiesResponse {
    // Load version from package.json
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const packageJson = require('../../../package.json');
    const version = packageJson.version || '0.0.0';

    return {
      version,
      supportedProtocols: [TransportProtocol.WEBSOCKET, TransportProtocol.HTTP],
      supportedResources: [ResourceType.SURGERY], // TODO: Load from ResourceConfigRegistry
      eventRouting: EVENT_ROUTING,
      features: {
        distributedLocking: true,
        optimisticConcurrency: true,
        stateTransitions: true,
        roleBasedAccess: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check Redis connection
   * @returns Redis status
   */
  private async checkRedis(): Promise<ServiceStatus> {
    if (!this.redis) {
      return {
        name: 'redis',
        status: 'down',
        error: 'Redis client not initialized',
      };
    }

    const start = Date.now();
    try {
      await this.redis.ping();
      return {
        name: 'redis',
        status: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'down',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Validate resource configuration
   * @param config - Resource configuration
   * @returns True if valid
   */
  private validateResourceConfig(config: ResourceConfig): boolean {
    return (
      this.hasBasicFields(config) &&
      this.hasValidConcurrency(config) &&
      this.hasValidSubResources(config) &&
      this.hasValidStateTransitions(config)
    );
  }

  private hasBasicFields(config: ResourceConfig): boolean {
    return Boolean(config.type && config.displayName);
  }

  private hasValidConcurrency(config: ResourceConfig): boolean {
    return Boolean(config.concurrency && config.concurrency.maxEditors >= 0);
  }

  private hasValidSubResources(config: ResourceConfig): boolean {
    if (!Array.isArray(config.subResources) || config.subResources.length === 0)
      return false;

    return config.subResources.every(
      sr =>
        sr.type &&
        sr.displayName &&
        Array.isArray(sr.editRoles) &&
        Array.isArray(sr.viewRoles),
    );
  }

  private hasValidStateTransitions(config: ResourceConfig): boolean {
    if (!Array.isArray(config.stateTransitions)) return false;

    return config.stateTransitions.every(
      t => t.from && t.to && Array.isArray(t.allowedRoles),
    );
  }
}
