/**
 * WebSocket Test Utilities
 *
 * Centralizza la logica di test per WebSocket Gateway per evitare duplicazione
 * e garantire consistency nei test E2E e di integrazione.
 *
 * Pattern: Factory + Helper functions
 * Ispirato a: reference/gatawey-    // E2E test config: SHORT timeouts for fast tests (not production values)
    const mockConfigService = {
      getPort: jest.fn().mockReturnValue(3001),
      getNamespace: jest.fn().mockReturnValue('/collaboration'),
      getPingInterval: jest.fn().mockReturnValue(2000), // 2s for E2E tests (production: 25s)
      getPingTimeout: jest.fn().mockReturnValue(5000),  // 5s for E2E tests (production: 20s)
      getMaxConnectionsPerUser: jest.fn().mockReturnValue(5),
      isEnabled: jest.fn().mockReturnValue(true),
      getCorsConfig: jest
        .fn()
        .mockReturnValue({ origin: '*', credentials: true }),
      getTransports: jest.fn().mockReturnValue(['websocket', 'polling']),
    };ateway/socket-gateway.test-utils.ts
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import * as jwt from 'jsonwebtoken';
import { WebSocketGatewayConfigService } from './config/gateway-config.service';
import { WebSocketGateway } from './websocket-gateway.gateway';
import { JwtMockService } from './auth/jwt-mock.service';

/**
 * JWT Token Factory
 *
 * Creates properly signed JWT tokens for testing using jsonwebtoken library
 */
export class JWTTokenFactory {
  private static readonly DEFAULT_SECRET = 'test-secret-key';

  /**
   * Create a valid JWT token with custom payload
   *
   * @param userId - User ID (becomes 'sub' claim)
   * @param expiresIn - Seconds until expiration (default: 3600 = 1 hour)
   * @param customClaims - Additional claims to include in payload
   * @param secret - Secret key for signing (default: 'test-secret-key')
   * @returns Signed JWT token string
   */
  static createValid(
    userId: string,
    expiresIn = 3600,
    customClaims: Record<string, any> = {},
    secret = this.DEFAULT_SECRET,
  ): string {
    const payload = {
      sub: userId,
      preferred_username: customClaims.preferred_username || `user_${userId}`,
      given_name: customClaims.given_name || 'Test',
      family_name: customClaims.family_name || 'User',
      email: customClaims.email || `${userId}@example.com`,
      realm_access: customClaims.realm_access || { roles: ['user'] },
      ...customClaims,
    };

    return jwt.sign(payload, secret, {
      expiresIn,
      algorithm: 'HS256',
    });
  }

  /**
   * Create an expired JWT token
   *
   * @param userId - User ID
   * @param expiredSecondsAgo - How many seconds ago it expired (default: 3600 = 1 hour ago)
   * @param secret - Secret key for signing
   * @returns Expired JWT token
   */
  static createExpired(
    userId: string,
    expiredSecondsAgo = 3600,
    secret = this.DEFAULT_SECRET,
  ): string {
    const payload = {
      sub: userId,
      preferred_username: `user_${userId}`,
    };

    // Create token that expired in the past
    return jwt.sign(payload, secret, {
      expiresIn: -expiredSecondsAgo, // Negative = expired
      algorithm: 'HS256',
    });
  }

  /**
   * Crea un JWT malformato (formato invalido)
   *
   * @returns JWT malformato (meno di 3 parti)
   */
  static createMalformed(): string {
    return 'invalid.token';
  }
}

/**
 * WebSocket Client Factory
 *
 * Crea client Socket.IO per test E2E con configurazione consistente
 */
export class WebSocketClientFactory {
  private clients: Socket[] = [];
  private serverUrl: string;

  constructor(port: number, namespace: string = '/collaboration') {
    this.serverUrl = `http://localhost:${port}${namespace}`;
  }

  /**
   * Crea un client WebSocket con JWT valido
   *
   * @param userId - User ID per il token JWT
   * @param options - Opzioni aggiuntive Socket.IO
   * @returns Promise che resolve con il client connesso
   */
  createAuthenticatedClient(
    userId: string,
    options: {
      transports?: string[];
      reconnection?: boolean;
      forceNew?: boolean;
    } = {},
  ): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const token = JWTTokenFactory.createValid(userId);

      const client = io(this.serverUrl, {
        auth: { token },
        transports: options.transports || ['websocket'],
        reconnection: options.reconnection ?? false,
        forceNew: options.forceNew ?? true,
      });

      this.clients.push(client);

      // Timeout after 5 seconds
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      client.on('connect', () => {
        clearTimeout(timeout);
        resolve(client);
      });

      client.on('connect_error', error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Crea un client non autenticato (senza token)
   *
   * @returns Promise con client (che verrà rifiutato dal server)
   */
  createUnauthenticatedClient(): Promise<Socket> {
    return new Promise(resolve => {
      const client = io(this.serverUrl, {
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        // No auth provided
      });

      this.clients.push(client);

      // Timeout fallback
      const timeout = setTimeout(() => resolve(client), 2000);

      // Server disconnects client on auth failure
      client.on('disconnect', () => {
        clearTimeout(timeout);
        resolve(client);
      });
    });
  }

  /**
   * Crea un client con token scaduto (per test expiration)
   *
   * @param userId - User ID
   * @returns Promise con client (che verrà rifiutato)
   */
  createExpiredTokenClient(userId: string): Promise<Socket> {
    return new Promise(resolve => {
      const token = JWTTokenFactory.createExpired(userId);

      const client = io(this.serverUrl, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });

      this.clients.push(client);

      // Server disconnects client on auth failure
      client.on('disconnect', () => resolve(client));

      // Timeout fallback
      setTimeout(() => resolve(client), 2000);
    });
  }

  /**
   * Cleanup: disconnette tutti i client creati
   */
  disconnectAll(): void {
    this.clients.forEach(client => {
      if (client.connected) {
        client.disconnect();
      }
    });
    this.clients = [];
  }

  /**
   * Ottiene il numero di client attivi
   */
  getActiveCount(): number {
    return this.clients.filter(c => c.connected).length;
  }
}

/**
 * WebSocket Test Setup
 *
 * Setup completo per test E2E WebSocket Gateway
 * Include bootstrap NestJS app + cleanup automatico
 */
export class WebSocketTestSetup {
  private app!: INestApplication;
  private gateway!: WebSocketGateway;
  private configService!: WebSocketGatewayConfigService;
  private clientFactory!: WebSocketClientFactory;

  constructor(
    private port: number = 3001,
    private namespace: string = '/collaboration',
  ) {}

  private createMockConfigService() {
    return {
      getPort: jest.fn().mockReturnValue(this.port),
      getNamespace: jest.fn().mockReturnValue(this.namespace),
      getPingInterval: jest.fn().mockReturnValue(25000),
      getPingTimeout: jest.fn().mockReturnValue(20000),
      getMaxConnectionsPerUser: jest.fn().mockReturnValue(5),
      isEnabled: jest.fn().mockReturnValue(true),
      getCorsConfig: jest
        .fn()
        .mockReturnValue({ origin: '*', credentials: true }),
      getTransports: jest.fn().mockReturnValue(['websocket', 'polling']),
    };
  }

  private createMockJwtService() {
    return {
      validateToken: jest.fn().mockImplementation(async (token: string) => {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT format');

        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          throw new Error('JWT expired');
        }

        return {
          userId: payload.sub,
          username: payload.preferred_username,
          email: payload.email,
        };
      }),
    };
  }

  private async configureSocketIOEngine(mockConfigService: any) {
    // Wait for Socket.IO engine (lazy initialization)
    await new Promise(resolve => setTimeout(resolve, 100));

    if (this.gateway.server?.engine?.opts) {
      const pingInterval = mockConfigService.getPingInterval();
      const pingTimeout = mockConfigService.getPingTimeout();

      this.gateway.server.engine.opts.pingInterval = pingInterval;
      this.gateway.server.engine.opts.pingTimeout = pingTimeout;

      console.log(
        '[DEBUG][WS][E2E] Socket.IO engine configured with E2E timing:',
        { pingInterval, pingTimeout, engineReady: true },
      );
    } else {
      console.warn(
        '[DEBUG][WS][E2E] Socket.IO engine not ready, using production defaults (25s/20s)',
      );
    }
  }

  /**
   * Inizializza l'app NestJS e avvia il server WebSocket
   */
  async initialize(): Promise<{
    app: INestApplication;
    gateway: WebSocketGateway;
    configService: WebSocketGatewayConfigService;
    clientFactory: WebSocketClientFactory;
  }> {
    const mockConfigService = this.createMockConfigService();
    const mockJwtService = this.createMockJwtService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketGateway,
        {
          provide: WebSocketGatewayConfigService,
          useValue: mockConfigService,
        },
        {
          provide: JwtMockService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    this.app = module.createNestApplication();
    this.gateway = module.get<WebSocketGateway>(WebSocketGateway);
    this.configService = module.get<WebSocketGatewayConfigService>(
      WebSocketGatewayConfigService,
    );

    await this.app.init();
    await this.app.listen(this.port);

    await this.configureSocketIOEngine(mockConfigService);

    this.clientFactory = new WebSocketClientFactory(this.port, this.namespace);

    return {
      app: this.app,
      gateway: this.gateway,
      configService: this.configService,
      clientFactory: this.clientFactory,
    };
  }

  /**
   * Cleanup dopo ogni test: disconnette tutti i client
   */
  cleanupClients(): void {
    if (this.clientFactory) {
      this.clientFactory.disconnectAll();
    }
  }

  /**
   * Cleanup finale: chiude l'app NestJS
   */
  async cleanup(): Promise<void> {
    this.cleanupClients();
    if (this.app) {
      await this.app.close();
    }
  }
}

/**
 * Test Assertions Helpers
 *
 * Helper per assertion comuni nei test WebSocket
 */
export class WebSocketAssertions {
  /**
   * Verifica che un client sia connesso con successo
   */
  static expectConnected(client: Socket): void {
    expect(client.connected).toBe(true);
    expect(client.id).toBeDefined();
  }

  /**
   * Verifica che un client sia disconnesso
   */
  static expectDisconnected(client: Socket): void {
    expect(client.connected).toBe(false);
  }

  /**
   * Attende un evento con timeout
   *
   * @param client - Socket client
   * @param eventName - Nome evento da attendere
   * @param timeout - Timeout in ms (default: 5000)
   * @returns Promise che resolve con i dati dell'evento
   */
  static waitForEvent<T = any>(
    client: Socket,
    eventName: string,
    timeout = 5000,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(`Event '${eventName}' not received within ${timeout}ms`),
        );
      }, timeout);

      client.once(eventName, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  /**
   * Verifica che il connection pool abbia una size specifica
   *
   * @param gateway - Gateway instance
   * @param expectedSize - Size atteso
   */
  static expectConnectionPoolSize(
    gateway: WebSocketGateway,
    expectedSize: number,
  ): void {
    expect(gateway.getConnectionPoolSize()).toBe(expectedSize);
  }

  /**
   * Verifica che un utente abbia un numero specifico di connessioni
   *
   * @param gateway - Gateway instance
   * @param userId - User ID
   * @param expectedCount - Numero connessioni atteso
   */
  static expectUserConnectionCount(
    gateway: WebSocketGateway,
    userId: string,
    expectedCount: number,
  ): void {
    const connections = gateway.getConnectionsByUserId(userId);
    expect(connections).toHaveLength(expectedCount);
  }
}

/**
 * Helper functions for backward compatibility
 */
export const createValidJWT = (userId: string): string =>
  JWTTokenFactory.createValid(userId);

export const createExpiredJWT = (userId: string): string =>
  JWTTokenFactory.createExpired(userId);
