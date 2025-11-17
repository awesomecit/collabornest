/**
 * HealthCheckService Unit Tests
 *
 * Tests readiness check, resource config validation, and capabilities response.
 */

import Redis from 'ioredis';
import { WebSocketGatewayConfigService } from '../config/gateway-config.service';
import { ResourceType, SURGERY_CONFIG } from '../config/resource-config.types';
import { HealthCheckService } from './health-check.service';

describe('HealthCheckService', () => {
  let service: HealthCheckService;
  let mockRedis: jest.Mocked<Redis>;
  let mockConfig: jest.Mocked<WebSocketGatewayConfigService>;

  beforeEach(() => {
    // Mock Redis instance
    mockRedis = {
      ping: jest.fn(),
      quit: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    // Mock config service
    mockConfig = {
      getRedisConfig: jest.fn().mockReturnValue({
        host: 'localhost',
        port: 6379,
        db: 0,
      }),
    } as unknown as jest.Mocked<WebSocketGatewayConfigService>;

    service = new HealthCheckService(mockConfig, mockRedis);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('basicCheck', () => {
    it('should return status ok with timestamp and uptime', () => {
      const result = service.basicCheck();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThan(0);
    });

    it('should return current timestamp in ISO format', () => {
      const result = service.basicCheck();

      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('readinessCheck', () => {
    it('should return ready=true when Redis is up', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await service.readinessCheck();

      expect(result.ready).toBe(true);
      expect(result.status).toBe(200);
      expect(result.services).toHaveLength(1);
      expect(result.services[0]).toEqual({
        name: 'redis',
        status: 'up',
        latencyMs: expect.any(Number),
      });
      expect(result.timestamp).toBeDefined();
    });

    it('should return ready=false when Redis is down', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

      const result = await service.readinessCheck();

      expect(result.ready).toBe(false);
      expect(result.status).toBe(503);
      expect(result.services[0]).toEqual({
        name: 'redis',
        status: 'down',
        error: 'Connection refused',
      });
    });

    it('should return ready=false when Redis client not initialized', async () => {
      const serviceWithoutRedis = new HealthCheckService();

      const result = await serviceWithoutRedis.readinessCheck();

      expect(result.ready).toBe(false);
      expect(result.services[0]).toEqual({
        name: 'redis',
        status: 'down',
        error: 'Redis client not initialized',
      });
    });

    it('should measure Redis latency correctly', async () => {
      mockRedis.ping.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('PONG'), 10)),
      );

      const result = await service.readinessCheck();

      expect(result.services[0].latencyMs).toBeGreaterThanOrEqual(10);
    });
  });

  describe('resourceConfigCheck', () => {
    it('should return valid configuration for SURGERY resource', async () => {
      const result = await service.resourceConfigCheck();

      expect(result.resources).toContain(ResourceType.SURGERY);
      expect(result.configurations[ResourceType.SURGERY]).toEqual(
        SURGERY_CONFIG,
      );
      expect(result.validationStatus[ResourceType.SURGERY]).toBe('valid');
      expect(result.timestamp).toBeDefined();
    });

    it('should validate all resource configurations', async () => {
      const result = await service.resourceConfigCheck();

      for (const resourceType of result.resources) {
        expect(result.validationStatus[resourceType]).toBeDefined();
        expect(['valid', 'invalid']).toContain(
          result.validationStatus[resourceType],
        );
      }
    });
  });

  describe('capabilitiesCheck', () => {
    it('should return current version from package.json', () => {
      const result = service.capabilitiesCheck();

      // Version should match package.json (not hardcoded)
      expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(result.version).not.toBe('1.0.0'); // Ensure not hardcoded
    });

    it('should return supported protocols', () => {
      const result = service.capabilitiesCheck();

      expect(result.supportedProtocols).toContain('websocket');
      expect(result.supportedProtocols).toContain('http');
    });

    it('should return supported resources', () => {
      const result = service.capabilitiesCheck();

      expect(result.supportedResources).toContain(ResourceType.SURGERY);
    });

    it('should return event routing configuration', () => {
      const result = service.capabilitiesCheck();

      expect(result.eventRouting).toBeDefined();
      expect(result.eventRouting.lock_acquired).toBeDefined();
      expect(result.eventRouting.state_changed).toBeDefined();
    });

    it('should return feature flags', () => {
      const result = service.capabilitiesCheck();

      expect(result.features.distributedLocking).toBe(true);
      expect(result.features.optimisticConcurrency).toBe(true);
      expect(result.features.stateTransitions).toBe(true);
      expect(result.features.roleBasedAccess).toBe(true);
    });

    it('should return timestamp', () => {
      const result = service.capabilitiesCheck();

      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('Resource config validation', () => {
    it('should validate SURGERY_CONFIG as valid', () => {
      const isValid = (service as any).validateResourceConfig(SURGERY_CONFIG);

      expect(isValid).toBe(true);
    });

    it('should reject config without type', () => {
      const invalidConfig = { ...SURGERY_CONFIG, type: undefined };

      const isValid = (service as any).validateResourceConfig(invalidConfig);

      expect(isValid).toBe(false);
    });

    it('should reject config without displayName', () => {
      const invalidConfig = { ...SURGERY_CONFIG, displayName: '' };

      const isValid = (service as any).validateResourceConfig(invalidConfig);

      expect(isValid).toBe(false);
    });

    it('should reject config with negative maxEditors', () => {
      const invalidConfig = {
        ...SURGERY_CONFIG,
        concurrency: { maxEditors: -1, maxViewers: 0 },
      };

      const isValid = (service as any).validateResourceConfig(invalidConfig);

      expect(isValid).toBe(false);
    });

    it('should reject config without subResources', () => {
      const invalidConfig = { ...SURGERY_CONFIG, subResources: [] };

      const isValid = (service as any).validateResourceConfig(invalidConfig);

      expect(isValid).toBe(false);
    });

    it('should accept state transitions with empty allowedRoles (public access)', () => {
      const configWithPublicTransition = {
        ...SURGERY_CONFIG,
        stateTransitions: [
          {
            from: 'draft' as any,
            to: 'approved' as any,
            allowedRoles: [], // Public access
          },
        ],
      };

      const isValid = (service as any).validateResourceConfig(
        configWithPublicTransition,
      );

      expect(isValid).toBe(true);
    });

    it('should reject state transition without from/to states', () => {
      const invalidConfig = {
        ...SURGERY_CONFIG,
        stateTransitions: [{ from: null, to: 'approved', allowedRoles: [] }],
      };

      const isValid = (service as any).validateResourceConfig(invalidConfig);

      expect(isValid).toBe(false);
    });

    it('should accept sub-resources with empty editRoles (public edit)', () => {
      const configWithPublicEdit = {
        ...SURGERY_CONFIG,
        subResources: [
          {
            type: 'main' as any,
            displayName: 'Main',
            concurrency: { maxEditors: 0, maxViewers: 0 },
            editRoles: [], // Public edit
            viewRoles: [], // Public view
            requiresLock: false,
          },
        ],
      };

      const isValid = (service as any).validateResourceConfig(
        configWithPublicEdit,
      );

      expect(isValid).toBe(true);
    });

    it('should reject sub-resource without type', () => {
      const invalidConfig = {
        ...SURGERY_CONFIG,
        subResources: [
          {
            type: undefined,
            displayName: 'Main',
            editRoles: [],
            viewRoles: [],
            requiresLock: false,
          },
        ],
      };

      const isValid = (service as any).validateResourceConfig(invalidConfig);

      expect(isValid).toBe(false);
    });

    it('should reject sub-resource with non-array editRoles', () => {
      const invalidConfig = {
        ...SURGERY_CONFIG,
        subResources: [
          {
            type: 'main' as any,
            displayName: 'Main',
            editRoles: 'admin' as any, // Should be array
            viewRoles: [],
            requiresLock: false,
          },
        ],
      };

      const isValid = (service as any).validateResourceConfig(invalidConfig);

      expect(isValid).toBe(false);
    });
  });

  describe('Lifecycle', () => {
    it('should cleanup Redis connection on module destroy', async () => {
      // Create service without Redis connection, then inject mock
      const mockRedisOwned = {
        ping: jest.fn(),
        quit: jest.fn().mockResolvedValue('OK'),
      };
      const serviceWithOwnedRedis = new HealthCheckService(
        undefined,
        mockRedisOwned as any,
      );
      (serviceWithOwnedRedis as any).redisOwned = true;

      await serviceWithOwnedRedis.onModuleDestroy();

      expect(mockRedisOwned.quit).toHaveBeenCalled();
    });

    it('should not close external Redis instance', async () => {
      await service.onModuleDestroy();

      expect(mockRedis.quit).not.toHaveBeenCalled();
    });
  });
});
