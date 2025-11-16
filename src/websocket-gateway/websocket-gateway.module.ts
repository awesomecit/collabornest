import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WebSocketGateway } from './websocket-gateway.gateway';
import { WebSocketGatewayConfigService } from './config/gateway-config.service';

/**
 * WebSocket Gateway Module
 *
 * Provides WebSocket server for real-time collaboration.
 * Implements BE-001.1: WebSocket Connection Management.
 *
 * Features:
 * - JWT authentication
 * - Connection pool tracking
 * - Heartbeat ping/pong mechanism
 * - Max connections per user enforcement
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
 */
@Module({
  imports: [ConfigModule],
  providers: [WebSocketGateway, WebSocketGatewayConfigService],
  exports: [WebSocketGateway, WebSocketGatewayConfigService],
})
export class WebSocketGatewayModule {}
