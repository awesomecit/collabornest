import { Test, TestingModule } from '@nestjs/testing';
import { CustomLogger } from '../logger/logger.service';
import {
  RootWildcardController,
  WildcardController,
} from './wildcard.controller';

describe('WildcardController', () => {
  let controller: WildcardController;
  let logger: CustomLogger;

  beforeEach(async () => {
    // Given: Setup test module with mocked logger
    const mockLogger = {
      warn: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WildcardController],
      providers: [
        {
          provide: CustomLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<WildcardController>(WildcardController);
    logger = module.get<CustomLogger>(CustomLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleApiWildcard', () => {
    it('should handle API wildcard with specific path', () => {
      // Given: A request to non-existent API path
      const testPath = 'nonexistent/endpoint';

      // When: Handling wildcard API request
      const result = controller.handleApiWildcard(testPath);

      // Then: Should return proper error response
      expect(result).toEqual({
        message: 'Percorso API non trovato',
        path: `/api/v1/${testPath}`,
        availableEndpoints: ['/api/v1/health'],
        documentation:
          'Per la documentazione completa delle API, contatta il team di sviluppo',
      });

      // Verify logging behavior
      expect(logger.warn).toHaveBeenCalledWith(
        `Richiesta a percorso API non gestito: ${testPath}`,
        'WildcardController',
      );
    });

    it('should handle API wildcard with empty path', () => {
      // Given: A request to API root with empty path
      const emptyPath = '';

      // When: Handling wildcard with empty path
      const result = controller.handleApiWildcard(emptyPath);

      // Then: Should return root path response
      expect(result).toEqual({
        message: 'Percorso API non trovato',
        path: '/api/v1',
        availableEndpoints: ['/api/v1/health'],
        documentation:
          'Per la documentazione completa delle API, contatta il team di sviluppo',
      });

      // Verify logging for root path
      expect(logger.warn).toHaveBeenCalledWith(
        'Richiesta a percorso API non gestito: root',
        'WildcardController',
      );
    });

    it('should handle API wildcard with undefined path', () => {
      // Given: A request with undefined path parameter
      const undefinedPath = undefined;

      // When: Handling wildcard with undefined path
      const result = controller.handleApiWildcard(undefinedPath as any);

      // Then: Should treat as root path
      expect(result.path).toBe('/api/v1');
      expect(logger.warn).toHaveBeenCalledWith(
        'Richiesta a percorso API non gestito: root',
        'WildcardController',
      );
    });

    it('should handle nested path structures', () => {
      // Given: A request to deeply nested non-existent path
      const nestedPath = 'users/123/profiles/settings';

      // When: Processing nested wildcard request
      const result = controller.handleApiWildcard(nestedPath);

      // Then: Should maintain full path in response
      expect(result.path).toBe(`/api/v1/${nestedPath}`);
      expect(logger.warn).toHaveBeenCalledWith(
        `Richiesta a percorso API non gestito: ${nestedPath}`,
        'WildcardController',
      );
    });
  });

  describe('handleApiRoot', () => {
    it('should return API information for root access', () => {
      // Given: Request to API root endpoint

      // When: Accessing API root
      const result = controller.handleApiRoot();

      // Then: Should return API metadata
      expect(result).toEqual({
        message: 'API REST NestJS',
        version: '1.0.0',
        availableEndpoints: ['/api/v1/health'],
        documentation:
          'Per la documentazione completa delle API, contatta il team di sviluppo',
      });

      // Verify info logging
      expect(logger.info).toHaveBeenCalledWith(
        'Accesso alla root API',
        'WildcardController',
      );
    });

    it('should log API root access', () => {
      // Given: Controller ready to handle root access

      // When: Calling handleApiRoot
      controller.handleApiRoot();

      // Then: Should log the access appropriately
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        'Accesso alla root API',
        'WildcardController',
      );
    });
  });
});

describe('RootWildcardController', () => {
  let controller: RootWildcardController;
  let logger: CustomLogger;

  beforeEach(async () => {
    // Given: Setup test module for root wildcard controller
    const mockLogger = {
      warn: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RootWildcardController],
      providers: [
        {
          provide: CustomLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<RootWildcardController>(RootWildcardController);
    logger = module.get<CustomLogger>(CustomLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleHealthCheck', () => {
    it('should redirect health check to proper endpoint', () => {
      // Given: Request to health check from root

      // When: Handling health check redirect
      const result = controller.handleHealthCheck();

      // Then: Should provide redirect information
      expect(result).toEqual({
        message: "Per usare l'health check, vai a /api/v1/health",
      });

      // Verify redirect logging
      expect(logger.info).toHaveBeenCalledWith(
        'Redirecting health check from root to /api/v1/health',
        'RootWildcardController',
      );
    });
  });

  describe('handleAll', () => {
    it('should handle non-API paths with specific path', () => {
      // Given: Request to non-API path
      const testPath = 'some/random/path';

      // When: Handling non-API wildcard request
      const result = controller.handleAll(testPath);

      // Then: Should return appropriate error response
      expect(result).toEqual({
        message: 'Percorso non trovato',
        path: `/${testPath}`,
        suggestion: 'Le API sono disponibili su /api/v1',
      });

      // Verify warning logging
      expect(logger.warn).toHaveBeenCalledWith(
        `Richiesta a percorso non API: ${testPath}`,
        'RootWildcardController',
      );
    });

    it('should handle empty non-API path', () => {
      // Given: Request to root with empty path
      const emptyPath = '';

      // When: Handling empty path request
      const result = controller.handleAll(emptyPath);

      // Then: Should return root path response
      expect(result).toEqual({
        message: 'Percorso non trovato',
        path: '/',
        suggestion: 'Le API sono disponibili su /api/v1',
      });

      // Verify root logging
      expect(logger.warn).toHaveBeenCalledWith(
        'Richiesta a percorso non API: root',
        'RootWildcardController',
      );
    });

    it('should handle undefined path parameter', () => {
      // Given: Request with undefined path
      const undefinedPath = undefined;

      // When: Processing undefined path
      const result = controller.handleAll(undefinedPath as any);

      // Then: Should default to root handling
      expect(result.path).toBe('/');
      expect(logger.warn).toHaveBeenCalledWith(
        'Richiesta a percorso non API: root',
        'RootWildcardController',
      );
    });

    it('should handle special characters in path', () => {
      // Given: Request with special characters
      const specialPath = 'path-with_special.chars?query=test';

      // When: Processing path with special characters
      const result = controller.handleAll(specialPath);

      // Then: Should preserve path structure
      expect(result.path).toBe(`/${specialPath}`);
      expect(logger.warn).toHaveBeenCalledWith(
        `Richiesta a percorso non API: ${specialPath}`,
        'RootWildcardController',
      );
    });
  });

  describe('Error handling scenarios', () => {
    it('should handle logger failures in health check', () => {
      // Given: Logger that fails on info call
      (logger.info as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failed');
      });

      // When/Then: Should throw when logger fails
      expect(() => controller.handleHealthCheck()).toThrow('Logger failed');
    });

    it('should handle logger failures in wildcard handler', () => {
      // Given: Logger that fails on warn call
      (logger.warn as jest.Mock).mockImplementation(() => {
        throw new Error('Logger warn failed');
      });

      // When/Then: Should throw when logger fails
      expect(() => controller.handleAll('test')).toThrow('Logger warn failed');
    });
  });
});
