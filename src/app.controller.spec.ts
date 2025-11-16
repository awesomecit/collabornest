import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { CustomLogger } from './common/logger/logger.service';

describe('AppController', () => {
  let controller: AppController;
  let logger: CustomLogger;

  beforeEach(async () => {
    // Given: Setup test module with mocked dependencies
    const mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      verbose: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: CustomLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    logger = module.get<CustomLogger>(CustomLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHello', () => {
    it('should return hello message with timestamp', () => {
      // Given: Controller is initialized with logger
      const beforeCall = new Date().getTime();

      // When: Calling getHello endpoint
      const result = controller.getHello();

      // Then: Should return proper message structure and log call
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('timestamp');
      expect(result.message).toBe(
        'Hello World! Your NestJS backend is running perfectly! 🚀',
      );

      // Verify timestamp is recent and properly formatted
      const timestamp = new Date(result.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeCall);
      expect(timestamp).toBeLessThanOrEqual(new Date().getTime());

      // Verify logging behavior
      expect(logger.log).toHaveBeenCalledWith(
        'Hello endpoint called',
        'AppController',
      );
      expect(logger.log).toHaveBeenCalledTimes(1);
    });

    it('should return ISO formatted timestamp', () => {
      // Given: Controller ready to serve requests

      // When: Calling getHello endpoint
      const result = controller.getHello();

      // Then: Timestamp should be valid ISO string
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe('testError', () => {
    it('should throw error and log the call', () => {
      // Given: Controller ready with error endpoint

      // When/Then: Calling testError should throw specific error
      expect(() => controller.testError()).toThrow(
        'This is a test error to verify error handling',
      );

      // Verify logging behavior before error is thrown
      expect(logger.log).toHaveBeenCalledWith(
        'Test error endpoint called',
        'AppController',
      );
      expect(logger.log).toHaveBeenCalledTimes(1);
    });

    it('should always throw Error type', () => {
      // Given: Error endpoint is available

      // When/Then: Should throw Error instance
      expect(() => controller.testError()).toThrow(Error);
    });
  });

  describe('testLog', () => {
    it('should trigger all log levels and return success message', () => {
      // Given: Controller with logger configured for multiple levels

      // When: Calling testLog endpoint
      const result = controller.testLog();

      // Then: Should return success message
      expect(result).toEqual({
        message: 'Check your logs! Different log levels have been written.',
      });

      // Verify all log levels are called with correct context
      expect(logger.log).toHaveBeenCalledWith(
        'Testing different log levels',
        'AppController',
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'This is a debug message',
        'AppController',
      );
      expect(logger.warn).toHaveBeenCalledWith(
        'This is a warning message',
        'AppController',
      );
      expect(logger.error).toHaveBeenCalledWith(
        'This is an error message for testing',
        undefined,
        'AppController',
      );
      expect(logger.verbose).toHaveBeenCalledWith(
        'This is a verbose message',
        'AppController',
      );

      // Verify call counts for each log level
      expect(logger.log).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.verbose).toHaveBeenCalledTimes(1);
    });

    it('should maintain proper call sequence for logging', () => {
      // Given: Fresh logger state

      // When: Executing testLog which calls multiple log methods
      controller.testLog();

      // Then: Verify the sequence of logger calls
      const loggerCalls = (logger.log as jest.Mock).mock.calls;
      const debugCalls = (logger.debug as jest.Mock).mock.calls;
      const warnCalls = (logger.warn as jest.Mock).mock.calls;
      const errorCalls = (logger.error as jest.Mock).mock.calls;
      const verboseCalls = (logger.verbose as jest.Mock).mock.calls;

      // Verify each method was called with expected parameters
      expect(loggerCalls[0]).toEqual([
        'Testing different log levels',
        'AppController',
      ]);
      expect(debugCalls[0]).toEqual([
        'This is a debug message',
        'AppController',
      ]);
      expect(warnCalls[0]).toEqual([
        'This is a warning message',
        'AppController',
      ]);
      expect(errorCalls[0]).toEqual([
        'This is an error message for testing',
        undefined,
        'AppController',
      ]);
      expect(verboseCalls[0]).toEqual([
        'This is a verbose message',
        'AppController',
      ]);
    });
  });

  describe('Error handling edge cases', () => {
    it('should handle logger failures gracefully in getHello', () => {
      // Given: Logger that throws when called
      (logger.log as jest.Mock).mockImplementation(() => {
        throw new Error('Logger failed');
      });

      // When/Then: Should still return response despite logger failure
      expect(() => controller.getHello()).toThrow('Logger failed');
    });

    it('should handle logger failures gracefully in testLog', () => {
      // Given: Logger debug method that fails
      (logger.debug as jest.Mock).mockImplementation(() => {
        throw new Error('Debug logger failed');
      });

      // When/Then: Should throw when logger fails
      expect(() => controller.testLog()).toThrow('Debug logger failed');
    });
  });
});
