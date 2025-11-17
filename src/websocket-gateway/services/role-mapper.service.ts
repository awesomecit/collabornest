/**
 * Role Mapper Service
 *
 * Maps JWT token claims to UserRole enum values.
 * Supports project-specific custom mappings or strict default mapping.
 *
 * @see EPIC-004: Resource Configuration Management
 */

import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '../config/resource-config.types';

/**
 * Custom role mapping configuration
 * Maps JWT claim values to UserRole enum
 */
export interface RoleMappingConfig {
  /**
   * JWT claim field to extract role from
   * @default 'role'
   * @example 'realm_access.roles' for Keycloak
   * @example 'roles' for simple JWT
   */
  claimPath: string;

  /**
   * Custom mappings (JWT value → UserRole)
   * If not provided, uses strict 1:1 mapping
   * @example { 'surgeon_role': UserRole.SURGEON, 'admin_role': UserRole.ADMIN }
   */
  customMappings?: Record<string, UserRole>;

  /**
   * Default role if JWT claim not found or unmapped
   * @default UserRole.GUEST
   */
  defaultRole?: UserRole;

  /**
   * Allow multiple roles in JWT (array of roles)
   * If true, returns first mapped role
   * @default false
   */
  allowMultipleRoles?: boolean;

  /**
   * Case-insensitive role matching
   * @default true
   */
  caseInsensitive?: boolean;
}

/**
 * Default strict mapping (JWT claim value === UserRole enum value)
 */
const DEFAULT_STRICT_MAPPING: Record<string, UserRole> = {
  admin: UserRole.ADMIN,
  surgeon: UserRole.SURGEON,
  anesthesiologist: UserRole.ANESTHESIOLOGIST,
  nurse: UserRole.NURSE,
  viewer: UserRole.VIEWER,
  guest: UserRole.GUEST,
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<RoleMappingConfig> = {
  claimPath: 'role',
  customMappings: DEFAULT_STRICT_MAPPING,
  defaultRole: UserRole.GUEST,
  allowMultipleRoles: false,
  caseInsensitive: true,
};

@Injectable()
export class RoleMapperService {
  private readonly logger = new Logger(RoleMapperService.name);
  private config: Required<RoleMappingConfig>;

  constructor(customConfig?: Partial<RoleMappingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...customConfig };

    // Merge custom mappings with defaults if provided
    if (customConfig?.customMappings) {
      this.config.customMappings = {
        ...DEFAULT_STRICT_MAPPING,
        ...customConfig.customMappings,
      };
    }

    this.logger.log(
      `Initialized with claimPath='${this.config.claimPath}', ` +
        `defaultRole='${this.config.defaultRole}', ` +
        `caseInsensitive=${this.config.caseInsensitive}`,
    );
  }

  /**
   * Extract role from JWT token payload
   * @param jwtPayload - Decoded JWT token
   * @returns Mapped UserRole
   */
  mapRole(jwtPayload: Record<string, unknown>): UserRole {
    // Extract claim value using path (supports nested properties)
    const claimValue = this.getNestedProperty(
      jwtPayload,
      this.config.claimPath,
    );

    if (claimValue === null || claimValue === undefined) {
      this.logger.warn(
        `JWT claim '${this.config.claimPath}' not found, using default role '${this.config.defaultRole}'`,
      );
      return this.config.defaultRole;
    }

    // Handle multiple roles (array)
    if (Array.isArray(claimValue)) {
      if (!this.config.allowMultipleRoles) {
        this.logger.warn(
          `JWT claim contains multiple roles but allowMultipleRoles=false, using default role`,
        );
        return this.config.defaultRole;
      }

      // Map first valid role
      for (const role of claimValue) {
        const mapped = this.mapSingleRole(String(role));
        if (mapped !== this.config.defaultRole) {
          return mapped;
        }
      }

      this.logger.warn(`No valid roles found in JWT array, using default role`);
      return this.config.defaultRole;
    }

    // Single role
    return this.mapSingleRole(String(claimValue));
  }

  /**
   * Map single role value
   * @param roleValue - JWT role claim value
   * @returns Mapped UserRole
   */
  private mapSingleRole(roleValue: string): UserRole {
    let normalizedValue = roleValue.trim();

    // Case-insensitive matching
    if (this.config.caseInsensitive) {
      normalizedValue = normalizedValue.toLowerCase();
    }

    // Check custom mappings
    for (const [jwtRole, userRole] of Object.entries(
      this.config.customMappings,
    )) {
      const normalizedKey = this.config.caseInsensitive
        ? jwtRole.toLowerCase()
        : jwtRole;

      if (normalizedValue === normalizedKey) {
        return userRole;
      }
    }

    // No mapping found
    this.logger.warn(
      `JWT role '${roleValue}' not mapped, using default role '${this.config.defaultRole}'`,
    );
    return this.config.defaultRole;
  }

  /**
   * Get nested property from object using dot notation
   * @param obj - Object to traverse
   * @param path - Property path (e.g., 'realm_access.roles')
   * @returns Property value or null
   */
  private getNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== 'object'
      ) {
        return null;
      }

      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Validate role against configuration
   * @param role - UserRole to validate
   * @returns True if role is valid
   */
  isValidRole(role: UserRole): boolean {
    return Object.values(UserRole).includes(role);
  }

  /**
   * Get current configuration
   * @returns Current role mapping config
   */
  getConfig(): Readonly<Required<RoleMappingConfig>> {
    return { ...this.config };
  }

  /**
   * Update configuration at runtime
   * @param newConfig - Partial config to merge
   */
  updateConfig(newConfig: Partial<RoleMappingConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.customMappings) {
      this.config.customMappings = {
        ...DEFAULT_STRICT_MAPPING,
        ...newConfig.customMappings,
      };
    }

    this.logger.log(`Configuration updated: ${JSON.stringify(newConfig)}`);
  }
}
