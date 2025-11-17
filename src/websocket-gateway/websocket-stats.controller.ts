import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebSocketGateway } from './websocket-gateway.gateway';

/**
 * WebSocket Stats Controller
 *
 * Exposes real-time metrics about WebSocket connections for UI monitoring.
 * Public endpoint (no JWT required) - returns aggregate stats only, no sensitive data.
 *
 * @public
 */
@ApiTags('websocket')
@Controller('api/websocket')
export class WebSocketStatsController {
  constructor(private readonly gateway: WebSocketGateway) {}

  /**
   * Get WebSocket pool statistics
   *
   * Returns real-time metrics about active connections, users, and transports.
   * Rate limit: 1 request per second per user (enforced by client).
   *
   * @returns Pool statistics object
   *
   * @example
   * ```typescript
   * // Response example
   * {
   *   totalConnections: 5,
   *   uniqueUsers: 3,
   *   byTransport: { websocket: 4, polling: 1 },
   *   staleConnections: 0
   * }
   * ```
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get WebSocket connection statistics',
    description:
      'Returns real-time metrics: total connections, unique users, transport breakdown, stale connections',
  })
  @ApiResponse({
    status: 200,
    description: 'Pool statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalConnections: {
          type: 'number',
          description: 'Total active WebSocket connections across all users',
          example: 5,
        },
        uniqueUsers: {
          type: 'number',
          description: 'Number of unique users connected',
          example: 3,
        },
        byTransport: {
          type: 'object',
          description: 'Connection breakdown by transport type',
          properties: {
            websocket: { type: 'number', example: 4 },
            polling: { type: 'number', example: 1 },
          },
        },
        staleConnections: {
          type: 'number',
          description:
            'Number of stale connections (inactive > 2x pingTimeout)',
          example: 0,
        },
      },
    },
  })
  getPoolStats() {
    return this.gateway.getPoolStats();
  }
}
