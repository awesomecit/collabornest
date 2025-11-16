import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { CustomLogger } from '../common/logger/logger.service';
import { setupSwagger } from './swagger.config';

// Mock SwaggerModule
jest.mock('@nestjs/swagger', () => ({
  DocumentBuilder: jest.fn().mockReturnValue({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setVersion: jest.fn().mockReturnThis(),
    addBearerAuth: jest.fn().mockReturnThis(),
    addTag: jest.fn().mockReturnThis(),
    addServer: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({}),
  }),
  SwaggerModule: {
    createDocument: jest.fn().mockReturnValue({
      paths: {},
    }),
    setup: jest.fn(),
  },
}));

describe('SwaggerConfig', () => {
  let app: INestApplication;
  let logger: CustomLogger;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: CustomLogger,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    logger = moduleRef.get<CustomLogger>(CustomLogger);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('setupSwagger', () => {
    it('should set up swagger documentation with correct options', () => {
      // Arrange
      const mockDocument = {
        paths: {
          '/health': {}, // Simulating that health path is already defined
        },
      };

      (SwaggerModule.createDocument as jest.Mock).mockReturnValue(mockDocument);

      // Act
      const result = setupSwagger(app, logger);

      // Assert
      expect(SwaggerModule.createDocument).toHaveBeenCalledWith(
        app,
        expect.any(Object),
        {
          deepScanRoutes: true,
          ignoreGlobalPrefix: false,
        },
      );
      expect(SwaggerModule.setup).toHaveBeenCalledWith(
        'api-docs',
        app,
        mockDocument,
        expect.any(Object),
      );
      expect(logger.log).toHaveBeenCalledWith(
        'Swagger documentation available',
        'Swagger',
      );
      expect(result).toBeDefined();
    });

    it('should add health endpoint manually if not found', () => {
      // Arrange
      const mockDocument = {
        paths: {}, // Health path is not defined
      };

      (SwaggerModule.createDocument as jest.Mock).mockReturnValue(mockDocument);

      // Act
      const result = setupSwagger(app, logger);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        'Health endpoint non trovato in Swagger',
        'Swagger',
      );
      expect(mockDocument.paths['/health']).toBeDefined();
      expect(mockDocument.paths['/health'].get).toBeDefined();
      expect(mockDocument.paths['/health'].get.tags).toContain('health');
    });

    it('should use custom port if provided', () => {
      // Arrange
      const customPort = 4000;
      const { DocumentBuilder } = require('@nestjs/swagger');

      // Act
      setupSwagger(app, logger, customPort);

      // Assert
      expect(DocumentBuilder().addServer).toHaveBeenCalledWith(
        `http://localhost:${customPort}`,
      );
    });

    it('should use default port if not provided', () => {
      // Arrange
      const { DocumentBuilder } = require('@nestjs/swagger');

      // Act
      setupSwagger(app, logger);

      // Assert
      expect(DocumentBuilder().addServer).toHaveBeenCalledWith(
        'http://localhost:3000',
      );
    });
  });
});
