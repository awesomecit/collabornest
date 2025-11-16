/**
 * Socket Gateway - Test Utilities
 * 
 * Centralized mock factory functions for testing Socket Gateway.
 * 
 * @see SOCKET_DOCUMENTATION_AND_REFACTORING_TASKS.md - Task REF.1
 */

import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { Server } from 'socket.io';

/**
 * Creates a standard mock for SocketGatewayConfigService
 * 
 * This factory provides a consistent baseline configuration for all tests,
 * reducing duplication and improving maintainability.
 * 
 * @param overrides - Partial overrides for specific test scenarios
 * @returns Jest-mocked SocketGatewayConfigService with sensible defaults
 * 
 * @example
 * ```typescript
 * // Basic usage - default config
 * const mockConfigService = createMockConfigService();
 * 
 * // Override specific methods for test scenario
 * const mockConfigService = createMockConfigService({
 *   isEnabled: jest.fn().mockReturnValue(false),
 *   getMaxConnectionsPerUser: jest.fn().mockReturnValue(3),
 * });
 * ```
 */
export function createMockConfigService(
  overrides?: Partial<jest.Mocked<SocketGatewayConfigService>>
): jest.Mocked<SocketGatewayConfigService> {
  const defaultMock = {
    // ============================================================================
    // Private Properties (required by TypeScript)
    // ============================================================================
    logger: {} as any,
    config: {} as any,
    enabled: true,
    
    // ============================================================================
    // Basic Configuration
    // ============================================================================
    isEnabled: jest.fn().mockReturnValue(true),
    getConfig: jest.fn().mockReturnValue({}),
    getPort: jest.fn().mockReturnValue(3000),
    getNamespace: jest.fn().mockReturnValue('/api/n/ws'),
    
    // ============================================================================
    // CORS & Transport Configuration
    // ============================================================================
    getCorsConfig: jest.fn().mockReturnValue({ 
      origin: '*', 
      credentials: true 
    }),
    getTransports: jest.fn().mockReturnValue(['websocket']),
    
    // ============================================================================
    // Heartbeat Configuration (Task 1.2.2)
    // ============================================================================
    getPingInterval: jest.fn().mockReturnValue(25000),
    getPingTimeout: jest.fn().mockReturnValue(20000),
    
    // ============================================================================
    // Logging Methods
    // ============================================================================
    logClientConnected: jest.fn(),
    logClientDisconnected: jest.fn(),
    logUnexpectedDisconnection: jest.fn(),
    logError: jest.fn(),
    
    // ============================================================================
    // Validation Methods
    // ============================================================================
    validateConfig: jest.fn().mockReturnValue({ valid: true, errors: [] }),
    
    // ============================================================================
    // Resource Limits (Task 10.1)
    // ============================================================================
    getMaxConnectionsPerUser: jest.fn().mockReturnValue(999), // High limit for tests
    
    // ============================================================================
    // Graceful Shutdown Configuration (Task 1.2.6)
    // ============================================================================
    getShutdownTimeout: jest.fn().mockReturnValue(5000),
    
    // ============================================================================
    // Future Configurations (uncomment when implemented)
    // ============================================================================
    // JWT Config (Task 1.2.4) - if needed in future
    // getJwtSecret: jest.fn().mockReturnValue('test-secret'),
    
    // Room Limits (Task 10.2) - TODO: uncomment when implemented
    // getMaxUsersPerRoom: jest.fn().mockReturnValue(999),
    
    // Rate Limiting (Task 1.2.7) - TODO: uncomment when implemented
    // getMaxConnectionsPerIp: jest.fn().mockReturnValue(10),
    // getRateLimitWindow: jest.fn().mockReturnValue(60000),
    
  } as any;

  return {
    ...defaultMock,
    ...overrides,
  };
}

/**
 * Creates a mock Socket.IO Server with typical test setup
 * 
 * Provides a consistent server mock with engine configuration,
 * event emission, and room management.
 * 
 * @param overrides - Partial overrides for server properties
 * @returns Mock Socket.IO Server
 * 
 * @example
 * ```typescript
 * const mockServer = createMockServer();
 * 
 * // With custom sockets
 * const mockServer = createMockServer({
 *   sockets: {
 *     sockets: new Map([['socket-123', mockClient]]),
 *   },
 * });
 * ```
 */
export function createMockServer(overrides?: Partial<Server>): Partial<Server> {
  return {
    engine: {
      opts: {},
    } as any,
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    sockets: {
      sockets: new Map(),
    } as any,
    ...overrides,
  };
}

/**
 * Type guard to check if an object is a jest mock function
 */
function isMockFunction(obj: any): obj is jest.Mock {
  return typeof obj === 'function' && 'mock' in obj;
}

/**
 * Helper to reset all mocks in a config service
 * 
 * Useful for cleaning up between tests without recreating the mock.
 * 
 * @param mockConfigService - Mock config service to reset
 * 
 * @example
 * ```typescript
 * beforeEach(() => {
 *   resetMockConfigService(mockConfigService);
 * });
 * ```
 */
export function resetMockConfigService(
  mockConfigService: jest.Mocked<SocketGatewayConfigService>
): void {
  Object.values(mockConfigService).forEach((value) => {
    if (isMockFunction(value)) {
      value.mockClear();
    }
  });
}

/**
 * Helper to verify config service method calls
 * 
 * Common assertions for config service interactions.
 * 
 * @example
 * ```typescript
 * verifyConfigServiceCalls(mockConfigService, {
 *   isEnabled: 1,
 *   getPort: 1,
 *   logClientConnected: 2,
 * });
 * ```
 */
export function verifyConfigServiceCalls(
  mockConfigService: jest.Mocked<SocketGatewayConfigService>,
  expectedCalls: Partial<Record<keyof SocketGatewayConfigService, number>>
): void {
  Object.entries(expectedCalls).forEach(([method, times]) => {
    const mockMethod = mockConfigService[method as keyof SocketGatewayConfigService];
    if (isMockFunction(mockMethod)) {
      expect(mockMethod).toHaveBeenCalledTimes(times);
    }
  });
}
