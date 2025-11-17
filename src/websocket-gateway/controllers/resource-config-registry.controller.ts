/**
 * Resource Configuration Registry Controller
 *
 * REST API for registering and managing custom resource schemas.
 *
 * @see EPIC-004: Resource Configuration Management
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResourceConfig, ResourceType } from '../config/resource-config.types';
import {
  ConfigSource,
  ResourceConfigRegistryService,
  ValidationResult,
} from '../services/resource-config-registry.service';

/**
 * Register resource config DTO
 */
class RegisterResourceConfigDto {
  config: ResourceConfig;
  registeredBy?: string;
}

@ApiTags('resource-config')
@Controller('api/resource-config')
export class ResourceConfigRegistryController {
  constructor(
    private readonly registryService: ResourceConfigRegistryService,
  ) {}

  /**
   * List all registered resource types
   * @returns Array of resource types
   */
  @Get()
  @ApiOperation({ summary: 'List all registered resource types' })
  @ApiResponse({
    status: 200,
    description: 'List of resource types',
    schema: {
      type: 'object',
      properties: {
        resourceTypes: {
          type: 'array',
          items: { type: 'string' },
          example: ['SURGERY', 'PATIENT', 'REPORT'],
        },
        count: { type: 'number', example: 3 },
      },
    },
  })
  listResourceTypes() {
    const types = this.registryService.listTypes();
    return {
      resourceTypes: types,
      count: types.length,
    };
  }

  /**
   * Get specific resource configuration
   * @param resourceType - Resource type
   * @returns Resource configuration
   */
  @Get(':resourceType')
  @ApiOperation({ summary: 'Get resource configuration' })
  @ApiResponse({ status: 200, description: 'Resource configuration' })
  @ApiResponse({ status: 404, description: 'Resource type not found' })
  getResourceConfig(@Param('resourceType') resourceType: ResourceType) {
    const config = this.registryService.get(resourceType);

    if (!config) {
      throw new NotFoundException(
        `Resource type '${resourceType}' not registered`,
      );
    }

    const metadata = this.registryService.getMetadata(resourceType);

    return {
      config,
      metadata: {
        source: metadata?.source,
        registeredAt: metadata?.registeredAt,
        registeredBy: metadata?.registeredBy,
      },
    };
  }

  /**
   * Get all resource configurations
   * @returns All configurations
   */
  @Get('all/configurations')
  @ApiOperation({ summary: 'Get all resource configurations' })
  @ApiResponse({ status: 200, description: 'All configurations' })
  getAllConfigurations() {
    const configs = this.registryService.getAll();
    const types = this.registryService.listTypes();

    return {
      configurations: configs,
      resourceTypes: types,
      count: types.length,
    };
  }

  /**
   * Register a new resource configuration
   * @param dto - Registration data
   * @returns Validation result
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register custom resource configuration' })
  @ApiBody({ type: RegisterResourceConfigDto })
  @ApiResponse({
    status: 201,
    description: 'Configuration registered successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid configuration' })
  registerResourceConfig(@Body() dto: RegisterResourceConfigDto) {
    const validation = this.registryService.register(
      dto.config,
      ConfigSource.RUNTIME,
      dto.registeredBy,
    );

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Invalid resource configuration',
        errors: validation.errors,
      });
    }

    return {
      message: `Resource type '${dto.config.type}' registered successfully`,
      resourceType: dto.config.type,
      validation,
    };
  }

  /**
   * Validate resource configuration (dry-run)
   * @param config - Resource configuration
   * @returns Validation result
   */
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate resource configuration (dry-run)' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  validateConfig(@Body() config: ResourceConfig): ValidationResult {
    return this.registryService.validate(config);
  }

  /**
   * Unregister resource configuration
   * @param resourceType - Resource type
   * @returns Deletion result
   */
  @Delete(':resourceType')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unregister resource configuration' })
  @ApiResponse({ status: 200, description: 'Configuration unregistered' })
  @ApiResponse({ status: 404, description: 'Resource type not found' })
  unregisterResourceConfig(@Param('resourceType') resourceType: ResourceType) {
    const removed = this.registryService.unregister(resourceType);

    if (!removed) {
      throw new NotFoundException(
        `Resource type '${resourceType}' not registered`,
      );
    }

    return {
      message: `Resource type '${resourceType}' unregistered successfully`,
    };
  }
}
