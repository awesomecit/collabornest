import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    // Given: Setup test module with AppService
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  describe('getHello', () => {
    it('should return "Hello World!" message', () => {
      // Given: Service is instantiated and ready

      // When: Calling getHello method
      const result = service.getHello();

      // Then: Should return expected greeting message
      expect(result).toBe('Hello World!');
    });

    it('should return string type', () => {
      // Given: Service method available

      // When: Calling getHello
      const result = service.getHello();

      // Then: Should return string type
      expect(typeof result).toBe('string');
    });

    it('should return consistent result on multiple calls', () => {
      // Given: Service ready for multiple invocations

      // When: Calling getHello multiple times
      const firstCall = service.getHello();
      const secondCall = service.getHello();
      const thirdCall = service.getHello();

      // Then: All calls should return identical result
      expect(firstCall).toBe(secondCall);
      expect(secondCall).toBe(thirdCall);
      expect(firstCall).toBe('Hello World!');
    });

    it('should not return null or undefined', () => {
      // Given: Service instance is available

      // When: Getting hello message
      const result = service.getHello();

      // Then: Result should be defined and not null
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      expect(result).toBeTruthy();
    });

    it('should return non-empty string', () => {
      // Given: Service ready to provide greeting

      // When: Requesting hello message
      const result = service.getHello();

      // Then: Should return non-empty string
      expect(result.length).toBeGreaterThan(0);
      expect(result.trim()).toBe(result); // No leading/trailing whitespace
    });
  });

  describe('Service instantiation', () => {
    it('should be defined after module compilation', () => {
      // Given: Module has been compiled with AppService

      // When: Retrieving service instance
      // (service is already retrieved in beforeEach)

      // Then: Service should be properly instantiated
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(AppService);
    });

    it('should have getHello method available', () => {
      // Given: Service instance exists

      // When: Checking for method availability
      const hasMethod = typeof service.getHello === 'function';

      // Then: getHello should be a callable method
      expect(hasMethod).toBe(true);
      expect(service.getHello).toBeDefined();
    });
  });

  describe('Error scenarios', () => {
    it('should handle service method calls without crashing', () => {
      // Given: Service in normal state

      // When: Making rapid successive calls
      const rapidCalls = Array.from({ length: 100 }, () => service.getHello());

      // Then: All calls should succeed with same result
      rapidCalls.forEach(result => {
        expect(result).toBe('Hello World!');
      });
    });
  });
});
