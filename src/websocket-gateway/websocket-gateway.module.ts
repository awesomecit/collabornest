import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtMockService } from './auth';
import { WebSocketGatewayConfigService } from './config/gateway-config.service';
import { JwtConfigKey } from './constants';
import { RedisModule } from './redis/redis.module';
import { RedisLockService } from './services/redis-lock.service';
import { WebSocketGateway } from './websocket-gateway.gateway';
import { WebSocketStatsController } from './websocket-stats.controller';

/**
 * WebSocket Gateway Module
 *
 * Provides WebSocket server for real-time collaboration.
 * Implements BE-001.1: WebSocket Connection Management.
 *
 * Features:
 * - JWT authentication (HS256 for dev, RS256 for production)
 * - Connection pool tracking
 * - Heartbeat ping/pong mechanism
 * - Max connections per user enforcement
 *
 * Resource Hierarchy (SSOT):
 * - Root resource: "resourceType:identifier" (e.g., "surgery-management:abc-123")
 * - Sub-resource (1-level): "resourceType:id/subType:subId" (e.g., "surgery-management:abc-123/field:notes")
 * - Room: Socket.IO channel where roomId === resourceId for direct mapping
 *
 * Configuration:
 * - Uses @nestjs/config for environment variables
 * - See WebSocketGatewayConfigService for all settings
 *
 * Usage in AppModule:
 * ```typescript
 * @Module({
 *   imports: [WebSocketGatewayModule],
 * })
 * export class AppModule {}
 * ```
 *
 * @see EPIC-001-websocket-gateway.md BE-001.1
 * @see types/resource.types.ts for resource ID parsing utilities
 */
@Module({
  imports: [
    ConfigModule,
    RedisModule, // Provides Redis client for locks and presence
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(JwtConfigKey.SECRET),
        // Verification options only (signOptions not needed for validation)
        verifyOptions: {
          algorithms: ['HS256'] as const,
        },
      }),
    }),
  ],
  controllers: [WebSocketStatsController],
  providers: [
    WebSocketGateway,
    WebSocketGatewayConfigService,
    JwtMockService,
    RedisLockService,
  ],
  exports: [
    WebSocketGateway,
    WebSocketGatewayConfigService,
    JwtMockService,
    RedisLockService,
  ],
})
export class WebSocketGatewayModule {}
