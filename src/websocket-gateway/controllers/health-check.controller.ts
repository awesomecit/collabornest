/**
 * Health Check Controller
 *
 * Exposes health endpoints for API readiness, resource availability,
 * and configuration validation.
 *
 * @see EPIC-004: Resource Configuration Management
 */

import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheckService } from '../services/health-check.service';

@ApiTags('health')
@Controller('health')
export class HealthCheckController {
  constructor(private readonly healthCheckService: HealthCheckService) {}

  /**
   * Basic health check (liveness probe)
   * @returns Service status
   */
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  check() {
    return this.healthCheckService.basicCheck();
  }

  /**
   * Readiness check (readiness probe)
   * Verifies all dependencies are available
   * @returns Readiness status
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness check' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service not ready' })
  async ready() {
    return this.healthCheckService.readinessCheck();
  }

  /**
   * Resource configuration check
   * Returns all resource configurations and their states
   * @returns Resource configurations
   */
  @Get('resources')
  @ApiOperation({ summary: 'Resource configuration check' })
  @ApiResponse({ status: 200, description: 'Resource configurations' })
  async resources() {
    return this.healthCheckService.resourceConfigCheck();
  }

  /**
   * API capabilities
   * Returns supported features, event protocols, etc.
   * @returns API capabilities
   */
  @Get('capabilities')
  @ApiOperation({ summary: 'API capabilities' })
  @ApiResponse({ status: 200, description: 'API capabilities' })
  capabilities() {
    return this.healthCheckService.capabilitiesCheck();
  }
}
