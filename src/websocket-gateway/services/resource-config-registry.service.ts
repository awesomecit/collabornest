/**
 * Resource Configuration Registry Service
 *
 * Allows external APIs to register custom resource schemas at runtime.
 * Supports dynamic configuration loading from files, database, or HTTP.
 *
 * @see EPIC-004: Resource Configuration Management
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  ResourceConfig,
  ResourceType,
  StateTransition,
  SubResourceConfig,
  SURGERY_CONFIG,
} from '../config/resource-config.types';

/**
 * Resource configuration map (type-safe registry)
 */
export type ResourceConfigMap = Record<ResourceType, ResourceConfig>;

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Configuration source (where config was loaded from)
 */
export enum ConfigSource {
  /** Built-in default configurations */
  BUILTIN = 'builtin',

  /** Loaded from config file (JSON/YAML) */
  FILE = 'file',

  /** Loaded from database */
  DATABASE = 'database',

  /** Registered via API at runtime */
  RUNTIME = 'runtime',
}

/**
 * Registered configuration metadata
 */
export interface RegisteredConfig {
  config: ResourceConfig;
  source: ConfigSource;
  registeredAt: Date;
  registeredBy?: string;
}

@Injectable()
export class ResourceConfigRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ResourceConfigRegistryService.name);
  private readonly registry = new Map<ResourceType, RegisteredConfig>();

  /**
   * Initialize with built-in configurations
   */
  async onModuleInit() {
    // Register built-in configs
    this.register(SURGERY_CONFIG, ConfigSource.BUILTIN);

    // TODO: Load from config files
    // await this.loadFromFiles();

    // TODO: Load from database
    // await this.loadFromDatabase();

    this.logger.log(
      `Initialized with ${this.registry.size} resource configuration(s)`,
    );
  }

  /**
   * Register a new resource configuration
   * @param config - Resource configuration
   * @param source - Configuration source
   * @param registeredBy - User who registered (optional)
   * @returns Validation result
   */
  register(
    config: ResourceConfig,
    source: ConfigSource = ConfigSource.RUNTIME,
    registeredBy?: string,
  ): ValidationResult {
    // Validate configuration
    const validation = this.validate(config);
    if (!validation.valid) {
      this.logger.warn(
        `Failed to register ${config.type}: ${JSON.stringify(validation.errors)}`,
      );
      return validation;
    }

    // Check for conflicts
    if (this.registry.has(config.type)) {
      const existing = this.registry.get(config.type)!;
      this.logger.warn(
        `Overwriting existing ${config.type} config (source: ${existing.source})`,
      );
    }

    // Register
    this.registry.set(config.type, {
      config,
      source,
      registeredAt: new Date(),
      registeredBy,
    });

    this.logger.log(
      `Registered ${config.type} (source: ${source}, by: ${registeredBy || 'system'})`,
    );

    return { valid: true, errors: [] };
  }

  /**
   * Get resource configuration
   * @param resourceType - Resource type
   * @returns Resource configuration or null
   */
  get(resourceType: ResourceType): ResourceConfig | null {
    const entry = this.registry.get(resourceType);
    return entry ? entry.config : null;
  }

  /**
   * Get all registered configurations
   * @returns Resource configuration map
   */
  getAll(): ResourceConfigMap {
    const map: Partial<ResourceConfigMap> = {};
    for (const [type, entry] of this.registry.entries()) {
      map[type] = entry.config;
    }
    return map as ResourceConfigMap;
  }

  /**
   * Get metadata for registered configuration
   * @param resourceType - Resource type
   * @returns Metadata or null
   */
  getMetadata(resourceType: ResourceType): RegisteredConfig | null {
    return this.registry.get(resourceType) || null;
  }

  /**
   * List all registered resource types
   * @returns Array of resource types
   */
  listTypes(): ResourceType[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Unregister a resource configuration
   * @param resourceType - Resource type
   * @returns True if removed
   */
  unregister(resourceType: ResourceType): boolean {
    const existed = this.registry.has(resourceType);
    this.registry.delete(resourceType);

    if (existed) {
      this.logger.log(`Unregistered ${resourceType}`);
    }

    return existed;
  }

  /**
   * Validate resource configuration
   * @param config - Resource configuration
   * @returns Validation result
   */
  validate(config: ResourceConfig): ValidationResult {
    const errors: ValidationError[] = [];

    this.validateBasicFields(config, errors);
    this.validateConcurrencyConfig(config, errors);
    this.validateSubResourcesArray(config, errors);
    this.validateStateTransitionsArray(config, errors);
    this.validateLockedStates(config, errors);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private validateBasicFields(
    config: ResourceConfig,
    errors: ValidationError[],
  ): void {
    if (!config.type) {
      errors.push({ field: 'type', message: 'Resource type required' });
    }

    if (!config.displayName || config.displayName.trim().length === 0) {
      errors.push({ field: 'displayName', message: 'Display name required' });
    }
  }

  private validateConcurrencyConfig(
    config: ResourceConfig,
    errors: ValidationError[],
  ): void {
    if (!config.concurrency) {
      errors.push({
        field: 'concurrency',
        message: 'Concurrency config required',
      });
      return;
    }

    if (config.concurrency.maxEditors < 0) {
      errors.push({
        field: 'concurrency.maxEditors',
        message: 'maxEditors must be >= 0',
      });
    }

    if (config.concurrency.maxViewers < 0) {
      errors.push({
        field: 'concurrency.maxViewers',
        message: 'maxViewers must be >= 0',
      });
    }
  }

  private validateSubResourcesArray(
    config: ResourceConfig,
    errors: ValidationError[],
  ): void {
    if (
      !Array.isArray(config.subResources) ||
      config.subResources.length === 0
    ) {
      errors.push({
        field: 'subResources',
        message: 'At least one sub-resource required',
      });
      return;
    }

    config.subResources.forEach((subResource, index) => {
      const subErrors = this.validateSubResource(subResource);
      errors.push(
        ...subErrors.map(e => ({
          field: `subResources[${index}].${e.field}`,
          message: e.message,
        })),
      );
    });
  }

  private validateStateTransitionsArray(
    config: ResourceConfig,
    errors: ValidationError[],
  ): void {
    if (!Array.isArray(config.stateTransitions)) {
      errors.push({
        field: 'stateTransitions',
        message: 'State transitions array required',
      });
      return;
    }

    config.stateTransitions.forEach((transition, index) => {
      const transErrors = this.validateStateTransition(transition);
      errors.push(
        ...transErrors.map(e => ({
          field: `stateTransitions[${index}].${e.field}`,
          message: e.message,
        })),
      );
    });
  }

  private validateLockedStates(
    config: ResourceConfig,
    errors: ValidationError[],
  ): void {
    if (config.lockedStates && !Array.isArray(config.lockedStates)) {
      errors.push({
        field: 'lockedStates',
        message: 'lockedStates must be array',
      });
    }
  }

  /**
   * Validate sub-resource configuration
   * @param subResource - Sub-resource config
   * @returns Validation errors
   */
  private validateSubResource(
    subResource: SubResourceConfig,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!subResource.type) {
      errors.push({ field: 'type', message: 'Sub-resource type required' });
    }

    if (
      !subResource.displayName ||
      subResource.displayName.trim().length === 0
    ) {
      errors.push({ field: 'displayName', message: 'Display name required' });
    }

    // Empty arrays are valid (public access), but must be arrays
    if (!Array.isArray(subResource.editRoles)) {
      errors.push({ field: 'editRoles', message: 'editRoles must be array' });
    }

    if (!Array.isArray(subResource.viewRoles)) {
      errors.push({ field: 'viewRoles', message: 'viewRoles must be array' });
    }

    if (typeof subResource.requiresLock !== 'boolean') {
      errors.push({
        field: 'requiresLock',
        message: 'requiresLock must be boolean',
      });
    }

    return errors;
  }

  /**
   * Validate state transition
   * @param transition - State transition
   * @returns Validation errors
   */
  private validateStateTransition(
    transition: StateTransition,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!transition.from) {
      errors.push({ field: 'from', message: 'Source state required' });
    }

    if (!transition.to) {
      errors.push({ field: 'to', message: 'Target state required' });
    }

    // Empty allowedRoles[] is valid (public access), but must be array
    if (!Array.isArray(transition.allowedRoles)) {
      errors.push({
        field: 'allowedRoles',
        message: 'allowedRoles must be array',
      });
    }

    return errors;
  }

  /**
   * Load configurations from JSON/YAML files
   * (TODO: Implement based on project needs)
   */
  private async loadFromFiles(): Promise<void> {
    // Example implementation:
    // const configDir = path.join(process.cwd(), 'config/resources');
    // const files = await fs.readdir(configDir);
    // for (const file of files) {
    //   const content = await fs.readFile(path.join(configDir, file), 'utf-8');
    //   const config = JSON.parse(content);
    //   this.register(config, ConfigSource.FILE);
    // }
  }

  /**
   * Load configurations from database
   * (TODO: Implement based on project needs)
   */
  private async loadFromDatabase(): Promise<void> {
    // Example implementation:
    // const configs = await this.configRepository.findAll();
    // for (const config of configs) {
    //   this.register(config, ConfigSource.DATABASE);
    // }
  }
}
