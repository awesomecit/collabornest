import { Test, TestingModule } from '@nestjs/testing';
import { WebSocketGateway } from './websocket-gateway.gateway';
import { WebSocketGatewayConfigService } from './config/gateway-config.service';
import { INestApplication } from '@nestjs/common';
import { io, Socket } from 'socket.io-client';

/**
 * BE-001.1: WebSocket Connection Management - TDD Tests
 *
 * TASK: WebSocket Gateway JWT Authentication & Connection Pool
 * Epic: EPIC-001-websocket-gateway.md
 *
 * BDD Scenarios (from EPIC-001):
 * - Scenario 1: Valid JWT token authentication
 * - Scenario 2: Expired JWT token rejection
 * - Scenario 3: Connection pool tracking
 * - Scenario 4: Heartbeat ping/pong mechanism
 * - Scenario 5: Pong timeout disconnection
 * - Scenario 6: Max connections per user enforcement
 *
 * Test Strategy:
 * - Unit tests for connection pool logic
 * - Integration tests for JWT validation
 * - E2E tests for heartbeat mechanism (future)
 *
 * Test Runner: Jest
 * Framework: NestJS Testing Module + Socket.IO Client
 */

describe('WebSocketGateway - BE-001.1 Connection Management (TDD)', () => {
  let app: INestApplication;
  let gateway: WebSocketGateway;
  let configService: WebSocketGatewayConfigService;

  // Test configuration
  const TEST_PORT = 3001;
  const TEST_NAMESPACE = '/collaboration';
  const VALID_JWT_SECRET = 'test-secret-key-for-jwt-validation';

  // Helper: Create valid JWT token (mock implementation)
  const createValidJWT = (userId: string, expiresIn = 3600): string => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64');
    const payload = Buffer.from(
      JSON.stringify({
        sub: userId,
        preferred_username: `user_${userId}`,
        given_name: 'Test',
        family_name: 'User',
        email: `${userId}@example.com`,
        realm_access: { roles: ['user'] },
        exp: Math.floor(Date.now() / 1000) + expiresIn,
      }),
    ).toString('base64');
    const signature = 'mock-signature';

    return `${header}.${payload}.${signature}`;
  };

  // Helper: Create expired JWT token
  const createExpiredJWT = (userId: string): string => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64');
    const payload = Buffer.from(
      JSON.stringify({
        sub: userId,
        preferred_username: `user_${userId}`,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      }),
    ).toString('base64');
    const signature = 'mock-signature';

    return `${header}.${payload}.${signature}`;
  };

  beforeEach(async () => {
    // TODO: Mock ConfigService with test values
    const mockConfigService = {
      getPort: jest.fn().mockReturnValue(TEST_PORT),
      getNamespace: jest.fn().mockReturnValue(TEST_NAMESPACE),
      getPingInterval: jest.fn().mockReturnValue(25000), // 25s
      getPingTimeout: jest.fn().mockReturnValue(20000), // 20s
      getMaxConnectionsPerUser: jest.fn().mockReturnValue(5),
      isEnabled: jest.fn().mockReturnValue(true),
      getCorsConfig: jest
        .fn()
        .mockReturnValue({ origin: '*', credentials: true }),
      getTransports: jest.fn().mockReturnValue(['websocket', 'polling']),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebSocketGateway,
        {
          provide: WebSocketGatewayConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    gateway = module.get<WebSocketGateway>(WebSocketGateway);
    configService = module.get<WebSocketGatewayConfigService>(
      WebSocketGatewayConfigService,
    );

    await app.init();
    // Note: WebSocket server needs explicit listen() for real connections
    // await app.listen(TEST_PORT);
    // For unit tests, we test gateway logic directly without real server
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Scenario 1: Valid JWT Token Authentication', () => {
    it('should authenticate client with valid JWT token', done => {
      // GIVEN a client with valid JWT token
      const validToken = createValidJWT('user123');
      console.log('[DEBUG][WS][Test] Creating client with valid JWT token:', {
        userId: 'user123',
        tokenPreview: validToken.substring(0, 50) + '...',
      });

      const client: Socket = io(
        `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
        {
          auth: { token: validToken },
          transports: ['websocket'],
          reconnection: false,
        },
      );

      // WHEN client connects
      client.on('connect', () => {
        console.log('[DEBUG][WS][Test] Client connected successfully:', {
          socketId: client.id,
          connected: client.connected,
        });

        // THEN connection should be established
        expect(client.connected).toBe(true);
        expect(client.id).toBeDefined();

        client.disconnect();
        done();
      });

      // THEN connection should not fail
      client.on('connect_error', error => {
        console.error('[DEBUG][WS][Test] Connection error:', error);
        done.fail(`Connection should succeed with valid JWT: ${error.message}`);
      });
    });

    it('should extract user information from JWT payload', done => {
      // GIVEN a client with valid JWT containing user info
      const validToken = createValidJWT('user456');

      const client: Socket = io(
        `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
        {
          auth: { token: validToken },
          transports: ['websocket'],
          reconnection: false,
        },
      );

      client.on('connect', () => {
        console.log('[DEBUG][WS][Test] User info extraction test - connected');

        // WHEN connection is established
        // THEN user information should be available in connection pool
        const connectionInfo = gateway.getConnectionInfo(client.id!);

        console.log(
          '[DEBUG][WS][Test] Connection info retrieved:',
          connectionInfo,
        );

        expect(connectionInfo).toBeDefined();
        expect(connectionInfo!.userId).toBe('user456');
        expect(connectionInfo!.username).toBe('user_user456');
        expect(connectionInfo!.email).toBe('user456@example.com');

        client.disconnect();
        done();
      });

      client.on('connect_error', error => {
        done.fail(`Connection failed: ${error.message}`);
      });
    });
  });

  describe('Scenario 2: Expired JWT Token Rejection', () => {
    it('should reject connection with expired JWT token', done => {
      // GIVEN a client with expired JWT token
      const expiredToken = createExpiredJWT('user789');
      console.log('[DEBUG][WS][Test] Creating client with expired JWT token');

      const client: Socket = io(
        `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
        {
          auth: { token: expiredToken },
          transports: ['websocket'],
          reconnection: false,
        },
      );

      // WHEN client attempts to connect
      client.on('connect', () => {
        console.error(
          '[DEBUG][WS][Test] ERROR: Expired token should not connect!',
        );
        client.disconnect();
        done.fail('Connection should be rejected with expired JWT token');
      });

      // THEN connection should fail with authentication error
      client.on('connect_error', error => {
        console.log('[DEBUG][WS][Test] Connection correctly rejected:', {
          errorMessage: error.message,
          expectedBehavior: 'JWT token expired',
        });

        expect(error.message).toContain('JWT'); // Error message should mention JWT
        done();
      });
    });

    it('should reject connection without JWT token', done => {
      // GIVEN a client without authentication token
      console.log('[DEBUG][WS][Test] Creating client without JWT token');

      const client: Socket = io(
        `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
        {
          transports: ['websocket'],
          reconnection: false,
        },
      );

      // WHEN client attempts to connect
      client.on('connect', () => {
        console.error(
          '[DEBUG][WS][Test] ERROR: Unauthenticated client should not connect!',
        );
        client.disconnect();
        done.fail('Connection should be rejected without JWT token');
      });

      // THEN connection should fail
      client.on('connect_error', error => {
        console.log(
          '[DEBUG][WS][Test] Connection correctly rejected (no token):',
          error.message,
        );

        expect(error.message).toBeDefined();
        done();
      });
    });
  });

  describe('Scenario 3: Connection Pool Tracking', () => {
    it('should add connection to pool on connect', done => {
      // GIVEN a valid client
      const validToken = createValidJWT('pool-user-1');

      const client: Socket = io(
        `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
        {
          auth: { token: validToken },
          transports: ['websocket'],
          reconnection: false,
        },
      );

      client.on('connect', () => {
        console.log(
          '[DEBUG][WS][Test] Connection pool tracking - client connected',
        );

        // WHEN connection is established
        const poolSize = gateway.getConnectionPoolSize();
        const hasConnection = gateway.hasConnection(client.id!);

        console.log('[DEBUG][WS][Test] Connection pool state:', {
          poolSize,
          hasConnection,
          socketId: client.id,
        });

        // THEN connection should be tracked in pool
        expect(poolSize).toBeGreaterThan(0);
        expect(hasConnection).toBe(true);

        client.disconnect();
        done();
      });

      client.on('connect_error', error => {
        done.fail(`Connection failed: ${error.message}`);
      });
    });

    it('should remove connection from pool on disconnect', done => {
      // GIVEN a connected client
      const validToken = createValidJWT('pool-user-2');

      const client: Socket = io(
        `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
        {
          auth: { token: validToken },
          transports: ['websocket'],
          reconnection: false,
        },
      );

      let socketId: string = '';

      client.on('connect', () => {
        socketId = client.id!;
        console.log(
          '[DEBUG][WS][Test] Connection pool removal - client connected:',
          socketId,
        );

        // WHEN client disconnects
        client.disconnect();
      });

      client.on('disconnect', () => {
        console.log(
          '[DEBUG][WS][Test] Client disconnected, checking pool removal',
        );

        // THEN connection should be removed from pool
        setTimeout(() => {
          const hasConnection = gateway.hasConnection(socketId);
          console.log('[DEBUG][WS][Test] Pool state after disconnect:', {
            hasConnection,
          });

          expect(hasConnection).toBe(false);
          done();
        }, 100); // Small delay for async cleanup
      });

      client.on('connect_error', error => {
        done.fail(`Connection failed: ${error.message}`);
      });
    });

    it('should track multiple connections per user', done => {
      // GIVEN same user with multiple connections
      const validToken = createValidJWT('multi-conn-user');

      const client1: Socket = io(
        `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
        {
          auth: { token: validToken },
          transports: ['websocket'],
          reconnection: false,
        },
      );

      const client2: Socket = io(
        `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
        {
          auth: { token: validToken },
          transports: ['websocket'],
          reconnection: false,
        },
      );

      let connectedCount = 0;

      const onConnect = () => {
        connectedCount++;

        if (connectedCount === 2) {
          console.log(
            '[DEBUG][WS][Test] Both clients connected, checking pool',
          );

          // WHEN both clients are connected
          const userConnections =
            gateway.getConnectionsByUserId('multi-conn-user');

          console.log('[DEBUG][WS][Test] User connections:', {
            userId: 'multi-conn-user',
            connectionCount: userConnections.length,
            socketIds: userConnections.map(c => c.socketId),
          });

          // THEN both connections should be tracked
          expect(userConnections.length).toBe(2);

          client1.disconnect();
          client2.disconnect();
          done();
        }
      };

      client1.on('connect', onConnect);
      client2.on('connect', onConnect);

      client1.on('connect_error', error => {
        done.fail(`Client 1 connection failed: ${error.message}`);
      });
      client2.on('connect_error', error => {
        done.fail(`Client 2 connection failed: ${error.message}`);
      });
    });
  });

  describe('Scenario 4: Heartbeat Ping/Pong Mechanism', () => {
    it('should send ping every configured interval (25s)', done => {
      // GIVEN a connected client
      const validToken = createValidJWT('heartbeat-user');

      const client: Socket = io(
        `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
        {
          auth: { token: validToken },
          transports: ['websocket'],
          reconnection: false,
        },
      );

      let pingCount = 0;

      client.on('connect', () => {
        console.log('[DEBUG][WS][Test] Heartbeat test - client connected');

        // WHEN waiting for ping events
        client.on('ping', () => {
          pingCount++;
          console.log('[DEBUG][WS][Test] Ping received:', {
            pingCount,
            timestamp: new Date().toISOString(),
          });

          // THEN ping should be received
          expect(pingCount).toBeGreaterThan(0);

          if (pingCount === 1) {
            client.disconnect();
            done();
          }
        });
      });

      client.on('connect_error', error => {
        done.fail(`Connection failed: ${error.message}`);
      });

      // Increase timeout for heartbeat test
    }, 30000); // 30s timeout for heartbeat interval

    it('should respond to ping with pong', done => {
      // GIVEN a connected client
      const validToken = createValidJWT('pong-user');

      const client: Socket = io(
        `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
        {
          auth: { token: validToken },
          transports: ['websocket'],
          reconnection: false,
        },
      );

      client.on('connect', () => {
        console.log('[DEBUG][WS][Test] Pong response test - client connected');

        // WHEN ping is received
        client.on('ping', () => {
          console.log(
            '[DEBUG][WS][Test] Ping received, pong should be automatic',
          );

          // THEN client should automatically send pong (handled by socket.io)
          // We just verify the connection remains alive
          setTimeout(() => {
            expect(client.connected).toBe(true);
            client.disconnect();
            done();
          }, 1000);
        });
      });

      client.on('connect_error', error => {
        done.fail(`Connection failed: ${error.message}`);
      });
    }, 30000);
  });

  describe('Scenario 5: Pong Timeout Disconnection', () => {
    it('should disconnect client after pong timeout (20s)', done => {
      // GIVEN a client that stops responding to pings
      const validToken = createValidJWT('timeout-user');

      const client: Socket = io(
        `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
        {
          auth: { token: validToken },
          transports: ['websocket'],
          reconnection: false,
        },
      );

      client.on('connect', () => {
        console.log('[DEBUG][WS][Test] Pong timeout test - client connected');

        // WHEN client stops sending pong responses
        // (Simulate by monitoring disconnect event)

        // THEN client should be disconnected after timeout
        client.on('disconnect', reason => {
          console.log('[DEBUG][WS][Test] Client disconnected due to timeout:', {
            reason,
            expectedReason: 'ping timeout',
          });

          expect(reason).toContain('ping timeout');
          done();
        });

        // Mock: Force client to stop responding (actual implementation needed)
        // For now, we just verify the mechanism exists
        console.log(
          '[DEBUG][WS][Test] Pong timeout test - monitoring disconnect events',
        );
      });

      client.on('connect_error', error => {
        done.fail(`Connection failed: ${error.message}`);
      });
    }, 45000); // 45s timeout to allow for ping timeout
  });

  describe('Scenario 6: Max Connections Per User Enforcement', () => {
    it('should enforce max connections per user limit (5)', done => {
      // GIVEN a user with maximum allowed connections
      const validToken = createValidJWT('max-conn-user');
      const maxConnections = 5;
      const clients: Socket[] = [];

      console.log(
        '[DEBUG][WS][Test] Max connections test - creating multiple clients',
      );

      let connectedCount = 0;
      let rejectedCount = 0;

      const attemptConnection = (index: number) => {
        const client: Socket = io(
          `http://localhost:${TEST_PORT}${TEST_NAMESPACE}`,
          {
            auth: { token: validToken },
            transports: ['websocket'],
            reconnection: false,
          },
        );

        client.on('connect', () => {
          connectedCount++;
          clients.push(client);

          console.log('[DEBUG][WS][Test] Connection accepted:', {
            index,
            connectedCount,
            maxConnections,
          });

          // If we're at max, try one more to trigger rejection
          if (connectedCount === maxConnections) {
            attemptConnection(maxConnections + 1);
          }
        });

        client.on('connect_error', error => {
          rejectedCount++;

          console.log('[DEBUG][WS][Test] Connection rejected (expected):', {
            index,
            connectedCount,
            rejectedCount,
            errorMessage: error.message,
          });

          // THEN 6th connection should be rejected
          if (index === maxConnections + 1) {
            expect(connectedCount).toBe(maxConnections);
            expect(rejectedCount).toBe(1);
            expect(error.message).toContain('max connections');

            // Cleanup
            clients.forEach(c => c.disconnect());
            done();
          }
        });
      };

      // WHEN user attempts to create more than max connections
      for (let i = 1; i <= maxConnections; i++) {
        attemptConnection(i);
      }
    }, 10000); // 10s timeout for multiple connection attempts
  });
});
