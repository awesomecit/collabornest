import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { Observable, of, throwError } from 'rxjs';
import { CustomLogger } from '../logger/logger.service';
import { LoggingInterceptor } from './logger.interceptors';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logger: CustomLogger;

  // Mock per il contesto di esecuzione
  const mockExecutionContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn(),
      getResponse: jest.fn(),
    }),
    getClass: jest.fn(),
    getHandler: jest.fn(),
    getType: jest.fn(),
    getArgs: jest.fn(),
  } as unknown as ExecutionContext;

  // Mock per il call handler
  const mockCallHandler = {
    handle: jest.fn(),
  } as unknown as CallHandler;

  // Mock per la richiesta
  const mockRequest = {
    method: 'GET',
    url: '/api/test',
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('Test User Agent'),
  } as unknown as Request;

  // Mock per la risposta
  const mockResponse = {
    statusCode: 200,
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingInterceptor,
        {
          provide: CustomLogger,
          useFactory: () => ({
            log: jest.fn(),
            error: jest.fn(),
          }),
        },
      ],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
    logger = module.get<CustomLogger>(CustomLogger);

    // Reset mocks
    jest.clearAllMocks();

    // Setup dei mock
    (
      mockExecutionContext.switchToHttp().getRequest as jest.Mock
    ).mockReturnValue(mockRequest);
    (
      mockExecutionContext.switchToHttp().getResponse as jest.Mock
    ).mockReturnValue(mockResponse);
  });

  it('dovrebbe essere definito', () => {
    expect(interceptor).toBeDefined();
  });

  it("dovrebbe loggare l'inizio e la fine della richiesta per una risposta di successo", done => {
    // Arrange
    (mockCallHandler.handle as jest.Mock).mockReturnValue(
      of({ data: 'success' }),
    );

    // Act
    const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

    // Assert
    expect(result).toBeInstanceOf(Observable);
    expect(logger.log).toHaveBeenCalledTimes(1); // Solo la prima chiamata di log all'inizio

    result.subscribe({
      next: () => {
        expect(logger.log).toHaveBeenCalledTimes(2); // Una chiamata all'inizio e una alla fine

        // Verifica prima chiamata log (inizio richiesta)
        expect(logger.log).toHaveBeenNthCalledWith(
          1,
          'GET /api/test - 127.0.0.1 - Test User Agent',
          'HTTP',
        );

        // Verifica seconda chiamata log (fine richiesta)
        expect(logger.log).toHaveBeenNthCalledWith(
          2,
          expect.stringMatching(/GET \/api\/test - 200 - \d+ms/),
          'HTTP',
        );

        done();
      },
      error: done,
    });
  });

  it('dovrebbe loggare un errore se la richiesta fallisce', done => {
    // Arrange
    const testError = new Error('Test error');
    (mockCallHandler.handle as jest.Mock).mockReturnValue(
      throwError(() => testError),
    );

    // Act
    const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

    // Assert
    expect(result).toBeInstanceOf(Observable);

    result.subscribe({
      next: () => done.fail('Non dovrebbe arrivare qui'),
      error: error => {
        expect(error).toBe(testError);
        expect(logger.log).toHaveBeenCalledTimes(1); // Chiamata all'inizio
        expect(logger.error).toHaveBeenCalledTimes(1); // Chiamata di errore

        // Verifica chiamata error
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringMatching(/GET \/api\/test - Error after \d+ms/),
          testError.stack,
          'HTTP',
        );

        done();
      },
    });
  });

  it('dovrebbe gestire correttamente request senza method o url', done => {
    // Arrange
    const incompleteRequest = {
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Test User Agent'),
    };
    (
      mockExecutionContext.switchToHttp().getRequest as jest.Mock
    ).mockReturnValue(incompleteRequest);
    (mockCallHandler.handle as jest.Mock).mockReturnValue(
      of({ data: 'success' }),
    );

    // Act
    const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

    // Assert
    result.subscribe({
      next: () => {
        expect(logger.log).toHaveBeenNthCalledWith(
          1,
          'Unknown Unknown - 127.0.0.1 - Test User Agent',
          'HTTP',
        );
        done();
      },
      error: done,
    });
  });

  it('dovrebbe gestire correttamente errori senza stack trace', done => {
    // Arrange
    const errorWithoutStack = new Error('No stack');
    delete errorWithoutStack.stack;
    (mockCallHandler.handle as jest.Mock).mockReturnValue(
      throwError(() => errorWithoutStack),
    );

    // Act
    const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

    // Assert
    result.subscribe({
      next: () => done.fail('Non dovrebbe arrivare qui'),
      error: () => {
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringMatching(/GET \/api\/test - Error after \d+ms/),
          'No stack trace available',
          'HTTP',
        );
        done();
      },
    });
  });
});
