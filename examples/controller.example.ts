import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import {
  PresenceService,
  LockingService,
  RolesService,
  ResourceService,
  ReconciliationService,
  MonitoringService,
  UserRole,
  ResourceType,
  PresenceStatus,
} from '../src';

@Controller('api')
export class ExampleController {
  constructor(
    private readonly presenceService: PresenceService,
    private readonly lockingService: LockingService,
    private readonly rolesService: RolesService,
    private readonly resourceService: ResourceService,
    private readonly reconciliationService: ReconciliationService,
    private readonly monitoringService: MonitoringService,
  ) {}

  // Presence endpoints
  @Post('presence/join')
  async joinResource(
    @Body() data: { userId: string; resourceId: string; role: UserRole },
  ) {
    return this.presenceService.joinResource(
      data.userId,
      data.resourceId,
      data.role,
    );
  }

  @Post('presence/leave')
  async leaveResource(
    @Body() data: { userId: string; resourceId: string },
  ) {
    await this.presenceService.leaveResource(data.userId, data.resourceId);
    return { success: true };
  }

  @Post('presence/heartbeat')
  async updateHeartbeat(
    @Body() data: { userId: string; resourceId: string },
  ) {
    await this.presenceService.updateHeartbeat(data.userId, data.resourceId);
    return { success: true };
  }

  @Get('presence/:resourceId')
  async getPresence(@Param('resourceId') resourceId: string) {
    return this.presenceService.getResourcePresence(resourceId);
  }

  @Post('presence/status')
  async updateStatus(
    @Body() data: { userId: string; resourceId: string; status: PresenceStatus },
  ) {
    await this.presenceService.updateStatus(data.userId, data.resourceId, data.status);
    return { success: true };
  }

  // Locking endpoints
  @Post('lock/acquire')
  async acquireLock(
    @Body() data: { userId: string; resourceId: string; timeout?: number },
  ) {
    const lock = await this.lockingService.acquireLock(
      data.resourceId,
      data.userId,
      data.timeout,
    );
    return lock ? { success: true, lock } : { success: false, message: 'Already locked' };
  }

  @Post('lock/release')
  async releaseLock(
    @Body() data: { userId: string; resourceId: string },
  ) {
    const success = await this.lockingService.releaseLock(data.resourceId, data.userId);
    return { success };
  }

  @Get('lock/:resourceId')
  async getLock(@Param('resourceId') resourceId: string) {
    return this.lockingService.getLock(resourceId);
  }

  @Post('lock/renew')
  async renewLock(
    @Body() data: { userId: string; resourceId: string; timeout?: number },
  ) {
    const lock = await this.lockingService.renewLock(
      data.resourceId,
      data.userId,
      data.timeout,
    );
    return lock ? { success: true, lock } : { success: false };
  }

  // Resource endpoints
  @Post('resource')
  async createResource(
    @Body() data: { name: string; type: ResourceType; parentId?: string },
  ) {
    return this.resourceService.createResource(
      data.name,
      data.type,
      data.parentId,
    );
  }

  @Get('resource/:resourceId')
  async getResource(@Param('resourceId') resourceId: string) {
    return this.resourceService.getResource(resourceId);
  }

  @Delete('resource/:resourceId')
  async deleteResource(@Param('resourceId') resourceId: string) {
    const success = await this.resourceService.deleteResource(resourceId);
    return { success };
  }

  @Get('resource/:resourceId/children')
  async getChildren(@Param('resourceId') resourceId: string) {
    return this.resourceService.getChildren(resourceId);
  }

  @Get('resources/roots')
  async getRootResources() {
    return this.resourceService.getRootResources();
  }

  // Roles endpoints
  @Post('role/assign')
  async assignRole(
    @Body() data: { userId: string; resourceId: string; role: UserRole },
  ) {
    await this.rolesService.assignRole(data.userId, data.resourceId, data.role);
    return { success: true };
  }

  @Get('role/:resourceId/:userId')
  async getRole(
    @Param('resourceId') resourceId: string,
    @Param('userId') userId: string,
  ) {
    return this.rolesService.getRole(userId, resourceId);
  }

  // Reconciliation endpoints
  @Post('event/publish')
  async publishEvent(
    @Body() data: { userId: string; resourceId: string; eventType: string; data: any },
  ) {
    return this.reconciliationService.publishEvent(
      data.resourceId,
      data.userId,
      data.eventType,
      data.data,
    );
  }

  @Get('event/:resourceId')
  async getEvents(@Param('resourceId') resourceId: string) {
    return this.reconciliationService.getEvents(resourceId);
  }

  @Get('event/:resourceId/unreconciled')
  async getUnreconciledEvents(@Param('resourceId') resourceId: string) {
    return this.reconciliationService.getUnreconciledEvents(resourceId);
  }

  // Monitoring endpoints
  @Get('metrics')
  async getMetrics() {
    return this.monitoringService.getMetrics();
  }

  @Get('metrics/history')
  async getMetricsHistory() {
    return this.monitoringService.getMetricsHistory(24);
  }
}
