import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { IResourceValidationService, IResourceEntity } from './interfaces/resource-validation.interface';
import { SurgeryManagementStatus } from '../surgery-management-revision/entities/surgery-management-revision.entity';

/**
 * Centralized Test Mocks for Socket Gateway Unit Tests
 * 
 * This file provides type-safe mocks for all dependencies required by
 * CollaborationSocketGateway to avoid DI resolution errors in unit tests.
 * 
 * Following DRY principle - single source of truth for test mocks.
 * 
 * Note: Uses IResourceValidationService interface instead of concrete service
 * to follow Dependency Inversion Principle (SOLID).
 */

// ============================================================================
// Mock Configuration Service (Type-Safe)
// ============================================================================

/**
 * Creates a complete mock of SocketGatewayConfigService
 * Implements ALL methods required by the interface
 * 
 * @returns Type-safe partial mock with jest.fn() for all methods
 */
export function createMockConfigService(): SocketGatewayConfigService {
  return {
    isEnabled: jest.fn().mockReturnValue(true),
    getPort: jest.fn().mockReturnValue(3001),
    getNamespace: jest.fn().mockReturnValue('/surgery-collaboration'),
    getCorsConfig: jest.fn().mockReturnValue({
      origin: ['http://localhost:3000'],
      credentials: true,
    }),
    getTransports: jest.fn().mockReturnValue(['websocket', 'polling']),
    getPingInterval: jest.fn().mockReturnValue(25000),
    getPingTimeout: jest.fn().mockReturnValue(20000),
    getRoomLimits: jest.fn().mockReturnValue({
      surgery: 20,
      admin_panel: 5,
      chat: 100,
      default: 50,
    }),
    getMaxConnectionsPerUser: jest.fn().mockReturnValue(10),
    validateConfig: jest.fn(),
    getConfig: jest.fn().mockReturnValue({
      port: 3001,
      namespace: '/surgery-collaboration',
      cors: {
        origin: ['http://localhost:3000'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    }),
    // Legacy logging methods (still used by base-socket-gateway.ts)
    logClientConnected: jest.fn(),
    logClientDisconnected: jest.fn(),
    logError: jest.fn(),
  } as any;
}

// ============================================================================
// Mock Resource Validation Service (Type-Safe)
// ============================================================================

/**
 * Creates a complete mock of IResourceValidationService
 * Implements validation methods required by Area 7.1 (business logic)
 * 
 * Uses interface instead of concrete service (Dependency Inversion Principle)
 * 
 * @returns Type-safe partial mock with jest.fn() for all methods
 */
export function createMockResourceValidationService(): IResourceValidationService {
  return {
    // Area 7.1: Business validation for resource collaboration
    findOne: jest.fn((uuid: string): Promise<IResourceEntity | null> => {
      // Mock successful resource lookup
      return Promise.resolve({
        uuid,
        status: SurgeryManagementStatus.CONFIRMED,
        patient: { uuid: 'patient-001' },
        // Add other fields as needed by tests
      } as IResourceEntity);
    }),
    
    isResourceOpen: jest.fn((resource: IResourceEntity): boolean => {
      // Mock: Only CONFIRMED resources are open
      return resource.status === SurgeryManagementStatus.CONFIRMED;
    }),
    
    canJoinResource: jest.fn((uuid: string, userId: string): Promise<boolean> => {
      // Mock: Allow join by default
      return Promise.resolve(true);
    }),
  };
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use createMockResourceValidationService() instead
 */
export function createMockSurgeryService(): IResourceValidationService {
  return createMockResourceValidationService();
}

// ============================================================================
// Mock Factories with Custom Behavior
// ============================================================================

/**
 * Creates a mock ConfigService that returns disabled gateway
 * Useful for testing "gateway disabled" scenarios
 */
export function createMockConfigServiceDisabled(): Partial<SocketGatewayConfigService> {
  const mock = createMockConfigService();
  mock.isEnabled = jest.fn(() => false);
  return mock;
}

/**
 * Creates a mock validation service that returns resource not found
 * Useful for testing resource:join rejection scenarios
 */
export function createMockResourceValidationServiceNotFound(): IResourceValidationService {
  return {
    findOne: jest.fn(() => Promise.resolve(null)),
    isResourceOpen: jest.fn(() => false),
    canJoinResource: jest.fn(() => Promise.resolve(false)),
  };
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use createMockResourceValidationServiceNotFound() instead
 */
export function createMockSurgeryServiceNotFound(): IResourceValidationService {
  return createMockResourceValidationServiceNotFound();
}

/**
 * Creates a mock validation service that returns closed resource (VALIDATED status)
 * Useful for testing resource:join rejection due to closed status
 */
export function createMockResourceValidationServiceClosed(): IResourceValidationService {
  return {
    findOne: jest.fn((uuid: string): Promise<IResourceEntity | null> => 
      Promise.resolve({
        uuid,
        status: SurgeryManagementStatus.VALIDATED, // Closed status
        patient: { uuid: 'patient-001' },
      } as IResourceEntity)
    ),
    isResourceOpen: jest.fn((resource: IResourceEntity) => {
      return resource.status === SurgeryManagementStatus.CONFIRMED;
    }),
    canJoinResource: jest.fn(() => Promise.resolve(false)),
  };
}

/**
 * Legacy alias for backward compatibility
 * @deprecated Use createMockResourceValidationServiceClosed() instead
 */
export function createMockSurgeryServiceClosed(): IResourceValidationService {
  return createMockResourceValidationServiceClosed();
}

// ============================================================================
// Exports for convenience
// ============================================================================

export const mockDefaults = {
  config: createMockConfigService(),
  resourceValidation: createMockResourceValidationService(),
  // Legacy aliases
  surgeryService: createMockSurgeryService(),
};
