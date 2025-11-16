import { Test, TestingModule } from '@nestjs/testing';
import { SocketGatewayModule } from './socket-gateway.module';
import { SocketGatewayConfigService } from './socket-gateway-config.service';

describe('SocketGatewayModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    // TEST RED: Questo test deve fallire perché il modulo non esiste ancora
    module = await Test.createTestingModule({
      imports: [SocketGatewayModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide SocketGatewayConfigService', () => {
    const configService = module.get<SocketGatewayConfigService>(
      SocketGatewayConfigService,
    );
    expect(configService).toBeDefined();
  });

  it('should load configuration on module initialization', () => {
    const configService = module.get<SocketGatewayConfigService>(
      SocketGatewayConfigService,
    );
    const config = configService.getConfig();

    expect(config).toBeDefined();
    expect(config).toHaveProperty('port');
    expect(config).toHaveProperty('namespace');
    expect(config).toHaveProperty('cors');
    expect(config).toHaveProperty('transports');
  });

  it('should validate configuration if gateway is enabled', () => {
    const configService = module.get<SocketGatewayConfigService>(
      SocketGatewayConfigService,
    );
    const isEnabled = configService.isEnabled();

    if (isEnabled) {
      const config = configService.getConfig();
      expect(config.port).toBeGreaterThan(0);
      expect(config.port).toBeLessThanOrEqual(65535);
      expect(config.namespace).toMatch(/^\//);
      expect(config.cors.origin).toBeTruthy();
      expect(config.transports.length).toBeGreaterThan(0);
    } else {
      expect(isEnabled).toBe(false);
    }
  });

  it('should expose SOCKET_GATEWAY_ENABLED flag', () => {
    const configService = module.get<SocketGatewayConfigService>(
      SocketGatewayConfigService,
    );
    const isEnabled = configService.isEnabled();

    expect(typeof isEnabled).toBe('boolean');
  });

  it('should have valid port configuration', () => {
    const configService = module.get<SocketGatewayConfigService>(
      SocketGatewayConfigService,
    );
    const config = configService.getConfig();

    expect(typeof config.port).toBe('number');
    expect(config.port).toBeGreaterThan(0);
    expect(config.port).toBeLessThanOrEqual(65535);
  });

  it('should have valid namespace configuration', () => {
    const configService = module.get<SocketGatewayConfigService>(
      SocketGatewayConfigService,
    );
    const config = configService.getConfig();

    expect(typeof config.namespace).toBe('string');
    expect(config.namespace).toMatch(/^\//);
  });

  it('should have cors configuration with origin', () => {
    const configService = module.get<SocketGatewayConfigService>(
      SocketGatewayConfigService,
    );
    const config = configService.getConfig();

    expect(config.cors).toBeDefined();
    expect(config.cors).toHaveProperty('origin');
    expect(config.cors.origin).toBeTruthy();
  });

  it('should have transports array', () => {
    const configService = module.get<SocketGatewayConfigService>(
      SocketGatewayConfigService,
    );
    const config = configService.getConfig();

    expect(Array.isArray(config.transports)).toBe(true);
    expect(config.transports.length).toBeGreaterThan(0);
  });

  describe('Error Handling - Configuration Validation', () => {
    // Questi test verificano che il service gestisca correttamente
    // configurazioni valide e fornisca metodi per la validazione

    it('should validate PORT is within valid range (1-65535)', () => {
      const configService = module.get<SocketGatewayConfigService>(
        SocketGatewayConfigService,
      );
      const port = configService.getPort();

      expect(port).toBeGreaterThan(0);
      expect(port).toBeLessThanOrEqual(65535);
    });

    it('should validate NAMESPACE starts with /', () => {
      const configService = module.get<SocketGatewayConfigService>(
        SocketGatewayConfigService,
      );
      const namespace = configService.getNamespace();

      expect(namespace).toMatch(/^\//);
      expect(namespace.length).toBeGreaterThan(1);
    });

    it('should validate CORS origin is not empty', () => {
      const configService = module.get<SocketGatewayConfigService>(
        SocketGatewayConfigService,
      );
      const corsConfig = configService.getCorsConfig();

      expect(corsConfig).toBeDefined();
      expect(corsConfig.origin).toBeDefined();
      
      if (Array.isArray(corsConfig.origin)) {
        expect(corsConfig.origin.length).toBeGreaterThan(0);
      } else {
        expect(corsConfig.origin).toBeTruthy();
      }
    });

    it('should validate TRANSPORTS array is not empty', () => {
      const configService = module.get<SocketGatewayConfigService>(
        SocketGatewayConfigService,
      );
      const transports = configService.getTransports();

      expect(Array.isArray(transports)).toBe(true);
      expect(transports.length).toBeGreaterThan(0);
      expect(transports.every(t => typeof t === 'string')).toBe(true);
    });

    it('should provide a validation method to check config integrity', () => {
      const configService = module.get<SocketGatewayConfigService>(
        SocketGatewayConfigService,
      );

      // TEST RED: il metodo validateConfig() non esiste ancora
      expect(configService.validateConfig).toBeDefined();
      expect(typeof configService.validateConfig).toBe('function');
    });

    it('should return validation result with details', () => {
      const configService = module.get<SocketGatewayConfigService>(
        SocketGatewayConfigService,
      );

      // TEST RED: il metodo validateConfig() deve restituire un oggetto con valid e errors
      const validationResult = configService.validateConfig();
      
      expect(validationResult).toBeDefined();
      expect(validationResult).toHaveProperty('valid');
      expect(validationResult).toHaveProperty('errors');
      expect(typeof validationResult.valid).toBe('boolean');
      expect(Array.isArray(validationResult.errors)).toBe(true);
    });

    it('should have no validation errors with current valid config', () => {
      const configService = module.get<SocketGatewayConfigService>(
        SocketGatewayConfigService,
      );

      const validationResult = configService.validateConfig();
      
      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors.length).toBe(0);
    });
  });

  describe('Configuration Service Error Handling', () => {
    it('should provide meaningful error messages', () => {
      const configService = module.get<SocketGatewayConfigService>(
        SocketGatewayConfigService,
      );

      // Verifica che il service sia in uno stato valido
      expect(configService).toBeDefined();
      expect(() => configService.getConfig()).not.toThrow();
    });

    it('should handle missing configuration gracefully when disabled', () => {
      const configService = module.get<SocketGatewayConfigService>(
        SocketGatewayConfigService,
      );

      if (!configService.isEnabled()) {
        // Se disabilitato, dovrebbe comunque fornire una config di default
        const config = configService.getConfig();
        expect(config).toBeDefined();
        expect(config.port).toBeDefined();
      }
    });
  });
});
