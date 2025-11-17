import { Test, TestingModule } from '@nestjs/testing';
import { WebSocketStatsController } from './websocket-stats.controller';
import { WebSocketGateway } from './websocket-gateway.gateway';

describe('WebSocketStatsController', () => {
  let controller: WebSocketStatsController;
  let gateway: WebSocketGateway;

  const mockGateway = {
    getPoolStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebSocketStatsController],
      providers: [
        {
          provide: WebSocketGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    controller = module.get<WebSocketStatsController>(WebSocketStatsController);
    gateway = module.get<WebSocketGateway>(WebSocketGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPoolStats', () => {
    it('should return pool statistics from gateway', () => {
      const mockStats = {
        totalConnections: 5,
        uniqueUsers: 3,
        byTransport: { websocket: 4, polling: 1 },
        staleConnections: 0,
      };

      mockGateway.getPoolStats.mockReturnValue(mockStats);

      const result = controller.getPoolStats();

      expect(result).toEqual(mockStats);
      expect(gateway.getPoolStats).toHaveBeenCalledTimes(1);
    });

    it('should return zero stats when no connections', () => {
      const mockStats = {
        totalConnections: 0,
        uniqueUsers: 0,
        byTransport: {},
        staleConnections: 0,
      };

      mockGateway.getPoolStats.mockReturnValue(mockStats);

      const result = controller.getPoolStats();

      expect(result.totalConnections).toBe(0);
      expect(result.uniqueUsers).toBe(0);
    });

    it('should handle multiple transports', () => {
      const mockStats = {
        totalConnections: 10,
        uniqueUsers: 5,
        byTransport: {
          websocket: 7,
          polling: 2,
          webtransport: 1,
        },
        staleConnections: 2,
      };

      mockGateway.getPoolStats.mockReturnValue(mockStats);

      const result = controller.getPoolStats();

      expect(result.byTransport).toHaveProperty('websocket', 7);
      expect(result.byTransport).toHaveProperty('polling', 2);
      expect(result.byTransport).toHaveProperty('webtransport', 1);
    });
  });
});
