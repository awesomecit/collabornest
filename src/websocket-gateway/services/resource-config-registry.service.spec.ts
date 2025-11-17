/**
 * Unit tests for ResourceConfigRegistryService
 *
 * Tests resource configuration registration, validation, and management.
 *
 * @see EPIC-004: Resource Configuration Management
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  ResourceConfig,
  ResourceState,
  ResourceType,
  SubResourceType,
  SURGERY_CONFIG,
  UserRole,
} from '../config/resource-config.types';
import {
  ConfigSource,
  ResourceConfigRegistryService,
} from './resource-config-registry.service';

describe('ResourceConfigRegistryService', () => {
  let service: ResourceConfigRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ResourceConfigRegistryService],
    }).compile();

    service = module.get<ResourceConfigRegistryService>(
      ResourceConfigRegistryService,
    );
  });

  afterEach(() => {
    // Clear registry after each test
    service['registry'].clear();
  });

  describe('onModuleInit', () => {
    it('should register built-in SURGERY_CONFIG', async () => {
      await service.onModuleInit();

      const config = service.get(ResourceType.SURGERY);
      expect(config).toBeDefined();
      expect(config?.type).toBe(ResourceType.SURGERY);

      const metadata = service.getMetadata(ResourceType.SURGERY);
      expect(metadata?.source).toBe(ConfigSource.BUILTIN);
    });

    it('should log initialization message', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Initialized with'),
      );
    });
  });

  describe('register', () => {
    const validConfig: ResourceConfig = {
      type: ResourceType.SURGERY,
      displayName: 'Surgical Operation',
      concurrency: {
        maxEditors: 1,
        maxViewers: 5,
      },
      subResources: [
        {
          type: SubResourceType.MAIN,
          displayName: 'Main Content',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          editRoles: [UserRole.SURGEON],
          viewRoles: [],
          requiresLock: true,
        },
      ],
      stateTransitions: [],
      lockedStates: [],
    };

    it('should register valid configuration', () => {
      const result = service.register(
        validConfig,
        ConfigSource.RUNTIME,
        'test-user',
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);

      const config = service.get(ResourceType.SURGERY);
      expect(config).toEqual(validConfig);
    });

    it('should store metadata correctly', () => {
      service.register(validConfig, ConfigSource.RUNTIME, 'test-user');

      const metadata = service.getMetadata(ResourceType.SURGERY);
      expect(metadata).toBeDefined();
      expect(metadata?.source).toBe(ConfigSource.RUNTIME);
      expect(metadata?.registeredBy).toBe('test-user');
      expect(metadata?.registeredAt).toBeInstanceOf(Date);
    });

    it('should default to RUNTIME source if not specified', () => {
      service.register(validConfig);

      const metadata = service.getMetadata(ResourceType.SURGERY);
      expect(metadata?.source).toBe(ConfigSource.RUNTIME);
    });

    it('should reject invalid configuration', () => {
      const invalidConfig: ResourceConfig = {
        type: '' as ResourceType, // Invalid: empty type
        displayName: '',
        concurrency: {
          maxEditors: 1,
          maxViewers: 0,
        },
        subResources: [],
        stateTransitions: [],
        lockedStates: [],
      };

      const result = service.register(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn when overwriting existing configuration', () => {
      const loggerSpy = jest.spyOn(service['logger'], 'warn');

      service.register(validConfig, ConfigSource.BUILTIN);
      service.register(validConfig, ConfigSource.RUNTIME, 'admin');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Overwriting existing'),
      );
    });

    it('should log successful registration', () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      service.register(validConfig, ConfigSource.FILE, 'config-loader');

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Registered'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('config-loader'),
      );
    });
  });

  describe('get', () => {
    const testConfig: ResourceConfig = {
      type: ResourceType.SURGERY,
      displayName: 'Test Config',
      concurrency: {
        maxEditors: 1,
        maxViewers: 0,
      },
      subResources: [
        {
          type: SubResourceType.MAIN,
          displayName: 'Main',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          editRoles: [],
          viewRoles: [],
          requiresLock: false,
        },
      ],
      stateTransitions: [],
      lockedStates: [],
    };

    it('should return registered configuration', () => {
      service.register(testConfig);

      const config = service.get(ResourceType.SURGERY);
      expect(config).toEqual(testConfig);
    });

    it('should return null for non-existent configuration', () => {
      const config = service.get(ResourceType.SURGERY);
      expect(config).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return empty map when no configs registered', () => {
      const all = service.getAll();
      expect(Object.keys(all)).toHaveLength(0);
    });

    it('should return all registered configurations', () => {
      const config1: ResourceConfig = {
        type: ResourceType.SURGERY,
        displayName: 'Surgery',
        concurrency: { maxEditors: 1, maxViewers: 0 },
        subResources: [
          {
            type: SubResourceType.MAIN,
            displayName: 'Main',
            concurrency: { maxEditors: 1, maxViewers: 0 },
            editRoles: [],
            viewRoles: [],
            requiresLock: false,
          },
        ],
        stateTransitions: [],
        lockedStates: [],
      };

      const config2: ResourceConfig = {
        type: ResourceType.PATIENT,
        displayName: 'Patient Record',
        concurrency: { maxEditors: 0, maxViewers: 0 },
        subResources: [
          {
            type: SubResourceType.MAIN,
            displayName: 'Main',
            concurrency: { maxEditors: 1, maxViewers: 0 },
            editRoles: [],
            viewRoles: [],
            requiresLock: false,
          },
        ],
        stateTransitions: [],
        lockedStates: [],
      };

      service.register(config1);
      service.register(config2);

      const all = service.getAll();
      expect(Object.keys(all)).toHaveLength(2);
      expect(all[ResourceType.SURGERY]).toEqual(config1);
      expect(all[ResourceType.PATIENT]).toEqual(config2);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for registered config', () => {
      const config: ResourceConfig = {
        type: ResourceType.SURGERY,
        displayName: 'Surgery',
        concurrency: { maxEditors: 1, maxViewers: 0 },
        subResources: [
          {
            type: SubResourceType.MAIN,
            displayName: 'Main',
            concurrency: { maxEditors: 1, maxViewers: 0 },
            editRoles: [],
            viewRoles: [],
            requiresLock: false,
          },
        ],
        stateTransitions: [],
        lockedStates: [],
      };

      service.register(config, ConfigSource.DATABASE, 'db-loader');

      const metadata = service.getMetadata(ResourceType.SURGERY);
      expect(metadata).toBeDefined();
      expect(metadata?.config).toEqual(config);
      expect(metadata?.source).toBe(ConfigSource.DATABASE);
      expect(metadata?.registeredBy).toBe('db-loader');
    });

    it('should return null for non-existent config', () => {
      const metadata = service.getMetadata(ResourceType.SURGERY);
      expect(metadata).toBeNull();
    });
  });

  describe('listTypes', () => {
    it('should return empty array when no configs registered', () => {
      const types = service.listTypes();
      expect(types).toHaveLength(0);
    });

    it('should return all registered resource types', () => {
      const config1: ResourceConfig = {
        type: ResourceType.SURGERY,
        displayName: 'Surgery',
        concurrency: { maxEditors: 1, maxViewers: 0 },
        subResources: [
          {
            type: SubResourceType.MAIN,
            displayName: 'Main',
            concurrency: { maxEditors: 1, maxViewers: 0 },
            editRoles: [],
            viewRoles: [],
            requiresLock: false,
          },
        ],
        stateTransitions: [],
        lockedStates: [],
      };

      const config2: ResourceConfig = {
        type: ResourceType.PATIENT,
        displayName: 'Patient',
        concurrency: { maxEditors: 0, maxViewers: 0 },
        subResources: [
          {
            type: SubResourceType.MAIN,
            displayName: 'Main',
            concurrency: { maxEditors: 1, maxViewers: 0 },
            editRoles: [],
            viewRoles: [],
            requiresLock: false,
          },
        ],
        stateTransitions: [],
        lockedStates: [],
      };

      service.register(config1);
      service.register(config2);

      const types = service.listTypes();
      expect(types).toHaveLength(2);
      expect(types).toContain(ResourceType.SURGERY);
      expect(types).toContain(ResourceType.PATIENT);
    });
  });

  describe('unregister', () => {
    const testConfig: ResourceConfig = {
      type: ResourceType.SURGERY,
      displayName: 'Surgery',
      concurrency: { maxEditors: 1, maxViewers: 0 },
      subResources: [
        {
          type: SubResourceType.MAIN,
          displayName: 'Main',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          editRoles: [],
          viewRoles: [],
          requiresLock: false,
        },
      ],
      stateTransitions: [],
      lockedStates: [],
    };

    it('should remove registered configuration', () => {
      service.register(testConfig);
      expect(service.get(ResourceType.SURGERY)).toBeDefined();

      const result = service.unregister(ResourceType.SURGERY);

      expect(result).toBe(true);
      expect(service.get(ResourceType.SURGERY)).toBeNull();
    });

    it('should return false when unregistering non-existent config', () => {
      const result = service.unregister(ResourceType.SURGERY);
      expect(result).toBe(false);
    });

    it('should log successful unregistration', () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      service.register(testConfig);
      service.unregister(ResourceType.SURGERY);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unregistered'),
      );
    });

    it('should not log when unregistering non-existent config', () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');

      service.unregister(ResourceType.SURGERY);

      expect(loggerSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Unregistered'),
      );
    });
  });

  describe('validate', () => {
    describe('Basic Field Validation', () => {
      it('should validate complete valid configuration', () => {
        const result = service.validate(SURGERY_CONFIG);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should require resource type', () => {
        const config: ResourceConfig = {
          type: '' as ResourceType,
          displayName: 'Test',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'type',
          message: 'Resource type required',
        });
      });

      it('should require display name', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: '',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'displayName',
          message: 'Display name required',
        });
      });

      it('should reject whitespace-only display name', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: '   ',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'displayName',
          message: 'Display name required',
        });
      });
    });

    describe('Concurrency Configuration Validation', () => {
      it('should require concurrency config', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: undefined as any,
          subResources: [],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'concurrency',
          message: 'Concurrency config required',
        });
      });

      it('should require maxEditors >= 0', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: {
            maxEditors: -1,
            maxViewers: 0,
          },
          subResources: [],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'concurrency.maxEditors',
          message: 'maxEditors must be >= 0',
        });
      });

      it('should require maxViewers >= 0', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: {
            maxEditors: 1,
            maxViewers: -1,
          },
          subResources: [],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'concurrency.maxViewers',
          message: 'maxViewers must be >= 0',
        });
      });

      it('should accept valid concurrency config', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: {
            maxEditors: 1,
            maxViewers: 5,
          },
          subResources: [
            {
              type: SubResourceType.MAIN,
              displayName: 'Main',
              concurrency: { maxEditors: 1, maxViewers: 0 },
              editRoles: [],
              viewRoles: [],
              requiresLock: false,
            },
          ],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(true);
      });
    });

    describe('SubResources Array Validation', () => {
      it('should require at least one subResource', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'subResources',
          message: 'At least one sub-resource required',
        });
      });

      it('should require subResource type', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [
            {
              type: '' as SubResourceType,
              displayName: 'Main',
              concurrency: { maxEditors: 1, maxViewers: 0 },
              editRoles: [],
              viewRoles: [],
              requiresLock: false,
            },
          ],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'subResources[0].type',
          message: 'Sub-resource type required',
        });
      });

      it('should require subResource displayName', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [
            {
              type: SubResourceType.MAIN,
              displayName: '',
              concurrency: { maxEditors: 1, maxViewers: 0 },
              editRoles: [],
              viewRoles: [],
              requiresLock: false,
            },
          ],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'subResources[0].displayName',
          message: 'Display name required',
        });
      });

      it('should validate multiple subResources', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [
            {
              type: SubResourceType.MAIN,
              displayName: 'Main',
              concurrency: { maxEditors: 1, maxViewers: 0 },
              editRoles: [],
              viewRoles: [],
              requiresLock: false,
            },
            {
              type: SubResourceType.COMMENTS,
              displayName: '', // Invalid
              concurrency: { maxEditors: 0, maxViewers: 0 },
              editRoles: [],
              viewRoles: [],
              requiresLock: false,
            },
          ],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'subResources[1].displayName',
          message: 'Display name required',
        });
      });
    });

    describe('State Transitions Array Validation', () => {
      it('should accept empty stateTransitions array', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [
            {
              type: SubResourceType.MAIN,
              displayName: 'Main',
              concurrency: { maxEditors: 1, maxViewers: 0 },
              editRoles: [],
              viewRoles: [],
              requiresLock: false,
            },
          ],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(true);
      });

      it('should require transition from state', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [
            {
              type: SubResourceType.MAIN,
              displayName: 'Main',
              concurrency: { maxEditors: 1, maxViewers: 0 },
              editRoles: [],
              viewRoles: [],
              requiresLock: false,
            },
          ],
          stateTransitions: [
            {
              from: '' as ResourceState,
              to: ResourceState.APPROVED,
              allowedRoles: [],
            },
          ],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'stateTransitions[0].from',
          message: 'Source state required',
        });
      });

      it('should require transition to state', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [
            {
              type: SubResourceType.MAIN,
              displayName: 'Main',
              concurrency: { maxEditors: 1, maxViewers: 0 },
              editRoles: [],
              viewRoles: [],
              requiresLock: false,
            },
          ],
          stateTransitions: [
            {
              from: ResourceState.DRAFT,
              to: '' as ResourceState,
              allowedRoles: [],
            },
          ],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'stateTransitions[0].to',
          message: 'Target state required',
        });
      });

      it('should validate multiple transitions', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [
            {
              type: SubResourceType.MAIN,
              displayName: 'Main',
              concurrency: { maxEditors: 1, maxViewers: 0 },
              editRoles: [],
              viewRoles: [],
              requiresLock: false,
            },
          ],
          stateTransitions: [
            {
              from: ResourceState.DRAFT,
              to: ResourceState.IN_PROGRESS,
              allowedRoles: [],
            },
            {
              from: ResourceState.IN_PROGRESS,
              to: '' as ResourceState, // Invalid
              allowedRoles: [],
            },
          ],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual({
          field: 'stateTransitions[1].to',
          message: 'Target state required',
        });
      });
    });

    describe('Locked States Validation', () => {
      it('should accept empty lockedStates array', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [
            {
              type: SubResourceType.MAIN,
              displayName: 'Main',
              concurrency: { maxEditors: 1, maxViewers: 0 },
              editRoles: [],
              viewRoles: [],
              requiresLock: false,
            },
          ],
          stateTransitions: [],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(true);
      });

      it('should accept valid locked states', () => {
        const config: ResourceConfig = {
          type: ResourceType.SURGERY,
          displayName: 'Surgery',
          concurrency: { maxEditors: 1, maxViewers: 0 },
          subResources: [
            {
              type: SubResourceType.MAIN,
              displayName: 'Main',
              concurrency: { maxEditors: 1, maxViewers: 0 },
              editRoles: [],
              viewRoles: [],
              requiresLock: false,
            },
          ],
          stateTransitions: [],
          lockedStates: [
            ResourceState.APPROVED,
            ResourceState.ARCHIVED,
            ResourceState.DELETED,
          ],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(true);
      });
    });

    describe('Complex Validation Scenarios', () => {
      it('should accumulate multiple validation errors', () => {
        const config: ResourceConfig = {
          type: '' as ResourceType, // Error 1
          displayName: '', // Error 2
          concurrency: {
            maxEditors: -1, // Error 3
            maxViewers: 0,
          },
          subResources: [], // Error 4
          stateTransitions: [
            {
              from: '' as ResourceState, // Error 5
              to: ResourceState.APPROVED,
              allowedRoles: [],
            },
          ],
          lockedStates: [],
        };

        const result = service.validate(config);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(4);
      });

      it('should validate SURGERY_CONFIG from types', () => {
        const result = service.validate(SURGERY_CONFIG);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });
});
