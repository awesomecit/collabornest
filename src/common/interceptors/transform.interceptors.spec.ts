import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { ApiResponse, TransformInterceptor } from './transform.interceptors';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  // Mock per il contesto di esecuzione
  const mockExecutionContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn(),
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
    url: '/api/test',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformInterceptor],
    }).compile();

    interceptor = module.get<TransformInterceptor<any>>(TransformInterceptor);

    // Reset mocks
    jest.clearAllMocks();

    // Setup dei mock
    (
      mockExecutionContext.switchToHttp().getRequest as jest.Mock
    ).mockReturnValue(mockRequest);
  });

  it('dovrebbe essere definito', () => {
    expect(interceptor).toBeDefined();
  });

  it('dovrebbe trasformare la risposta con i metadati richiesti', done => {
    // Arrange
    const testData = { message: 'Test response' };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(testData));

    // Act
    const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

    // Assert
    result.subscribe({
      next: (transformedResponse: ApiResponse<any>) => {
        // Verifica che la risposta sia stata trasformata correttamente
        expect(transformedResponse).toMatchObject({
          success: true,
          data: testData,
          path: '/api/test',
        });

        // Verifica che il timestamp sia una stringa ISO valida
        expect(typeof transformedResponse.timestamp).toBe('string');
        expect(() => new Date(transformedResponse.timestamp)).not.toThrow();

        done();
      },
      error: done,
    });
  });

  it('dovrebbe gestire correttamente richieste senza URL', done => {
    // Arrange
    const incompleteRequest = {};
    (
      mockExecutionContext.switchToHttp().getRequest as jest.Mock
    ).mockReturnValue(incompleteRequest);
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of({ test: 'data' }));

    // Act
    const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

    // Assert
    result.subscribe({
      next: (transformedResponse: ApiResponse<any>) => {
        expect(transformedResponse.path).toBe('Unknown');
        done();
      },
      error: done,
    });
  });

  it('dovrebbe gestire correttamente dati null', done => {
    // Arrange
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(null));

    // Act
    const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

    // Assert
    result.subscribe({
      next: (transformedResponse: ApiResponse<any>) => {
        expect(transformedResponse.data).toBeNull();
        expect(transformedResponse.success).toBe(true);
        done();
      },
      error: done,
    });
  });

  it('dovrebbe mantenere la struttura della risposta originale nei dati', done => {
    // Arrange
    const complexData = {
      users: [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' },
      ],
      pagination: {
        page: 1,
        total: 10,
      },
    };
    (mockCallHandler.handle as jest.Mock).mockReturnValue(of(complexData));

    // Act
    const result = interceptor.intercept(mockExecutionContext, mockCallHandler);

    // Assert
    result.subscribe({
      next: (transformedResponse: ApiResponse<any>) => {
        expect(transformedResponse.data).toEqual(complexData);
        done();
      },
      error: done,
    });
  });
});
