import { Module, forwardRef } from '@nestjs/common';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { WebSocketAdminController } from './websocket-admin.controller';
import { SurgeryManagementModule } from '../surgery-management/surgery-management.module';

/**
 * Socket Gateway Module
 * 
 * TASK 1.1: Module Configuration
 * TASK 1.2.1: Enhanced disconnection logging (infrastructure only)
 * AREA 7.1: Surgery collaboration - imports SurgeryManagementModule
 * AREA 7.8: Save/Revision Events - circular dependency with SurgeryManagementModule resolved via forwardRef
 * 
 * This module provides:
 * 1. SocketGatewayConfigService - Configuration management
 * 2. CollaborationSocketGateway - WebSocket gateway with surgery business logic
 * 
 * Module Characteristics:
 * - Exports both providers for use in other modules
 * - Imports SurgeryManagementModule for business validation (Area 7.1)
 * - forwardRef() resolves circular dependency (Area 7.8: SurgeryManagementController needs SocketGatewayConfigService)
 * - No external dependencies (Redis, RabbitMQ will be added later)
 * 
 * Usage in AppModule:
 * ```typescript
 * @Module({
 *   imports: [SocketGatewayModule],
 *   // ...
 * })
 * export class AppModule {}
 * ```
 * 
 * @module SocketGatewayModule
 */
@Module({
  imports: [
    forwardRef(() => SurgeryManagementModule), // AREA 7.1 + 7.8: forwardRef resolves circular dependency
  ],
  controllers: [
    WebSocketAdminController, // AREA 7.6: Admin/Monitoring REST API
  ],
  providers: [
    SocketGatewayConfigService,
    CollaborationSocketGateway,
  ],
  exports: [
    SocketGatewayConfigService,
    CollaborationSocketGateway,
  ],
})
export class SocketGatewayModule {}
