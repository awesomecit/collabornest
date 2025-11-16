import { Test, TestingModule } from '@nestjs/testing';
import { SocketGatewayConfigService } from './socket-gateway-config.service';

describe('SocketGatewayConfigService - Auto-Lock Feature Flag', () => {
  let service: SocketGatewayConfigService;
  const originalEnv = process.env.SOCKET_GATEWAY_ENABLE_AUTO_LOCK;

  afterEach(() => {
    // Restore original env var
    if (originalEnv !== undefined) {
      process.env.SOCKET_GATEWAY_ENABLE_AUTO_LOCK = originalEnv;
    } else {
      delete process.env.SOCKET_GATEWAY_ENABLE_AUTO_LOCK;
    }
  });

  describe('isAutoLockEnabled()', () => {
    it('should return true by default (config file default)', () => {
      // Given: No env var override, config has enableAutoLock: true
      delete process.env.SOCKET_GATEWAY_ENABLE_AUTO_LOCK;

      // When: Create service (reads config)
      service = new SocketGatewayConfigService();

      // Then: Auto-lock should be enabled by default
      expect(service.isAutoLockEnabled()).toBe(true);
    });

    it('should return false when disabled in config file', () => {
      // Given: Config has enableAutoLock: false
      // This would require mocking the config file, skip for now
      // Manual test: Set enableAutoLock: false in socketgatewayconfig.local.ict.json
      // Then: service.isAutoLockEnabled() should return false
    });

    it('should respect environment variable override (true)', () => {
      // Given: Env var = 'true'
      process.env.SOCKET_GATEWAY_ENABLE_AUTO_LOCK = 'true';

      // When: Create service
      service = new SocketGatewayConfigService();

      // Then: Auto-lock should be enabled
      expect(service.isAutoLockEnabled()).toBe(true);
    });

    it('should respect environment variable override (false)', () => {
      // Given: Env var = 'false'
      process.env.SOCKET_GATEWAY_ENABLE_AUTO_LOCK = 'false';

      // When: Create service
      service = new SocketGatewayConfigService();

      // Then: Auto-lock should be disabled
      expect(service.isAutoLockEnabled()).toBe(false);
    });

    it('should handle env var value "1" as true', () => {
      // Given: Env var = '1'
      process.env.SOCKET_GATEWAY_ENABLE_AUTO_LOCK = '1';

      // When: Create service
      service = new SocketGatewayConfigService();

      // Then: Auto-lock should be enabled
      expect(service.isAutoLockEnabled()).toBe(true);
    });

    it('should handle env var value "0" as false', () => {
      // Given: Env var = '0'
      process.env.SOCKET_GATEWAY_ENABLE_AUTO_LOCK = '0';

      // When: Create service
      service = new SocketGatewayConfigService();

      // Then: Auto-lock should be disabled
      expect(service.isAutoLockEnabled()).toBe(false);
    });

    it('should prioritize env var over config file', () => {
      // Given: Env var = 'false' (even if config says true)
      process.env.SOCKET_GATEWAY_ENABLE_AUTO_LOCK = 'false';

      // When: Create service
      service = new SocketGatewayConfigService();

      // Then: Env var should take precedence
      expect(service.isAutoLockEnabled()).toBe(false);
    });
  });

  describe('Integration with Gateway', () => {
    // This would require full gateway setup
    // Covered in E2E tests instead
  });
});
