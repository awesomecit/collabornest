import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Expose } from 'class-transformer';
import { of } from 'rxjs';
import { TransformResponseInterceptor } from './transform-response.interceptor';

// Mock DTO class for testing
class MockDto {
  @Expose()
  public id: number;

  @Expose()
  public name: string;

  constructor(obj: any) {
    this.id = obj?.id;
    this.name = obj?.name;
  }
}

describe('TransformResponseInterceptor', () => {
  let interceptor: TransformResponseInterceptor<any, MockDto>;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    // Given: Setup interceptor with mock DTO class
    interceptor = new TransformResponseInterceptor(MockDto);

    mockExecutionContext = {} as ExecutionContext;
    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  describe('intercept', () => {
    it('should transform single object to DTO', done => {
      // Given: Response data with additional fields
      const responseData = {
        id: 1,
        name: 'Test Name',
        sensitiveField: 'should be excluded',
        extraField: 'not in DTO',
      };

      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(responseData));

      // When: Intercepting the response
      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Then: Should return transformed DTO
      result$.subscribe(result => {
        expect(result).toHaveProperty('id', 1);
        expect(result).toHaveProperty('name', 'Test Name');
        // Sensitive fields should be excluded by class-transformer
        expect(result).not.toHaveProperty('sensitiveField');
        expect(result).not.toHaveProperty('extraField');
        done();
      });
    });

    it('should transform array of objects to DTOs', done => {
      // Given: Array response data
      const responseData = [
        { id: 1, name: 'First', extra: 'exclude' },
        { id: 2, name: 'Second', extra: 'exclude' },
      ];

      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(responseData));

      // When: Intercepting array response
      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Then: Should transform each item in array
      result$.subscribe(result => {
        expect(Array.isArray(result)).toBe(true);
        expect((result as any).length).toBe(2);
        expect((result as any)[0]).toHaveProperty('id', 1);
        expect((result as any)[0]).toHaveProperty('name', 'First');
        expect((result as any)[1]).toHaveProperty('id', 2);
        expect((result as any)[1]).toHaveProperty('name', 'Second');
        done();
      });
    });

    it('should handle null/undefined responses', done => {
      // Given: Null response
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(null));

      // When: Intercepting null response
      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Then: Should return null as-is
      result$.subscribe(result => {
        expect(result).toBeNull();
        done();
      });
    });

    it('should handle undefined responses', done => {
      // Given: Undefined response
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(undefined));

      // When: Intercepting undefined response
      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Then: Should return undefined as-is
      result$.subscribe(result => {
        expect(result).toBeUndefined();
        done();
      });
    });

    it('should handle empty array responses', done => {
      // Given: Empty array response
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of([]));

      // When: Intercepting empty array
      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Then: Should return empty array
      result$.subscribe(result => {
        expect(Array.isArray(result)).toBe(true);
        expect((result as any).length).toBe(0);
        done();
      });
    });

    it('should handle non-object array items', done => {
      // Given: Array with primitive values
      const responseData = [1, 'string', true, null];

      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(responseData));

      // When: Intercepting array with primitives
      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Then: Should handle primitives correctly
      result$.subscribe(result => {
        expect(Array.isArray(result)).toBe(true);
        expect((result as any).length).toBe(4);
        done();
      });
    });
  });

  describe('transformObject', () => {
    it('should handle primitive values', done => {
      // Given: String response
      (mockCallHandler.handle as jest.Mock).mockReturnValue(
        of('simple string'),
      );

      // When: Intercepting primitive response
      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Then: Should return primitive as-is
      result$.subscribe(result => {
        expect(result).toBe('simple string');
        done();
      });
    });

    it('should handle number responses', done => {
      // Given: Number response
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(42));

      // When: Intercepting number response
      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Then: Should return number as-is
      result$.subscribe(result => {
        expect(result).toBe(42);
        done();
      });
    });

    it('should handle boolean responses', done => {
      // Given: Boolean response
      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(true));

      // When: Intercepting boolean response
      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Then: Should return boolean as-is
      result$.subscribe(result => {
        expect(result).toBe(true);
        done();
      });
    });
  });

  describe('constructor', () => {
    it('should initialize with DTO class', () => {
      // Given: DTO class constructor

      // When: Creating interceptor instance
      const instance = new TransformResponseInterceptor(MockDto);

      // Then: Should be properly instantiated
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(TransformResponseInterceptor);
    });
  });

  describe('error scenarios', () => {
    it('should handle malformed objects gracefully', done => {
      // Given: Object with circular reference
      const circularObj: any = { id: 1 };
      circularObj.self = circularObj;

      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(circularObj));

      // When: Intercepting circular object
      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Then: Should handle gracefully
      result$.subscribe(result => {
        expect(result).toBeDefined();
        done();
      });
    });

    it('should handle objects with null properties', done => {
      // Given: Object with null properties
      const objWithNulls = {
        id: 1,
        name: null,
        description: undefined,
      };

      (mockCallHandler.handle as jest.Mock).mockReturnValue(of(objWithNulls));

      // When: Intercepting object with nulls
      const result$ = interceptor.intercept(
        mockExecutionContext,
        mockCallHandler,
      );

      // Then: Should transform properly
      result$.subscribe(result => {
        expect(result).toHaveProperty('id', 1);
        done();
      });
    });
  });
});
