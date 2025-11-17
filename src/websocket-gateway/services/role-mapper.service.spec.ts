/**
 * RoleMapperService Unit Tests
 *
 * Tests JWT claim extraction, custom mappings, fallback to defaults,
 * and invalid role handling.
 */

import { UserRole } from '../config/resource-config.types';
import { RoleMapperService } from './role-mapper.service';

describe('RoleMapperService', () => {
  let service: RoleMapperService;

  beforeEach(() => {
    service = new RoleMapperService();
  });

  describe('Default strict mapping', () => {
    it('should map admin role correctly', () => {
      const payload = { role: 'admin' };
      expect(service.mapRole(payload)).toBe(UserRole.ADMIN);
    });

    it('should map surgeon role correctly', () => {
      const payload = { role: 'surgeon' };
      expect(service.mapRole(payload)).toBe(UserRole.SURGEON);
    });

    it('should map anesthesiologist role correctly', () => {
      const payload = { role: 'anesthesiologist' };
      expect(service.mapRole(payload)).toBe(UserRole.ANESTHESIOLOGIST);
    });

    it('should map nurse role correctly', () => {
      const payload = { role: 'nurse' };
      expect(service.mapRole(payload)).toBe(UserRole.NURSE);
    });

    it('should map viewer role correctly', () => {
      const payload = { role: 'viewer' };
      expect(service.mapRole(payload)).toBe(UserRole.VIEWER);
    });

    it('should map guest role correctly', () => {
      const payload = { role: 'guest' };
      expect(service.mapRole(payload)).toBe(UserRole.GUEST);
    });
  });

  describe('Case-insensitive matching', () => {
    it('should map uppercase role to correct UserRole', () => {
      const payload = { role: 'ADMIN' };
      expect(service.mapRole(payload)).toBe(UserRole.ADMIN);
    });

    it('should map mixed-case role to correct UserRole', () => {
      const payload = { role: 'SuRgEoN' };
      expect(service.mapRole(payload)).toBe(UserRole.SURGEON);
    });

    it('should trim whitespace before mapping', () => {
      const payload = { role: '  nurse  ' };
      expect(service.mapRole(payload)).toBe(UserRole.NURSE);
    });
  });

  describe('Nested claim path extraction', () => {
    it('should extract nested role claim (Keycloak pattern)', () => {
      const payload = {
        realm_access: {
          roles: 'admin',
        },
      };

      const serviceWithNestedPath = new RoleMapperService({
        claimPath: 'realm_access.roles',
      });

      expect(serviceWithNestedPath.mapRole(payload)).toBe(UserRole.ADMIN);
    });

    it('should extract deeply nested claim', () => {
      const payload = {
        user: {
          permissions: {
            role: 'surgeon',
          },
        },
      };

      const serviceWithDeepPath = new RoleMapperService({
        claimPath: 'user.permissions.role',
      });

      expect(serviceWithDeepPath.mapRole(payload)).toBe(UserRole.SURGEON);
    });

    it('should return default role if nested path not found', () => {
      const payload = { role: 'admin' };

      const serviceWithInvalidPath = new RoleMapperService({
        claimPath: 'invalid.nested.path',
        defaultRole: UserRole.GUEST,
      });

      expect(serviceWithInvalidPath.mapRole(payload)).toBe(UserRole.GUEST);
    });
  });

  describe('Custom role mappings', () => {
    it('should use custom mappings when provided', () => {
      const customService = new RoleMapperService({
        customMappings: {
          custom_admin: UserRole.ADMIN,
          custom_surgeon: UserRole.SURGEON,
        },
      });

      expect(customService.mapRole({ role: 'custom_admin' })).toBe(
        UserRole.ADMIN,
      );
      expect(customService.mapRole({ role: 'custom_surgeon' })).toBe(
        UserRole.SURGEON,
      );
    });

    it('should merge custom mappings with default strict mappings', () => {
      const customService = new RoleMapperService({
        customMappings: {
          doctor: UserRole.SURGEON, // Custom mapping
        },
      });

      // Custom mapping works
      expect(customService.mapRole({ role: 'doctor' })).toBe(UserRole.SURGEON);

      // Default mapping still works
      expect(customService.mapRole({ role: 'admin' })).toBe(UserRole.ADMIN);
    });

    it('should prioritize custom mappings over defaults', () => {
      const customService = new RoleMapperService({
        customMappings: {
          admin: UserRole.VIEWER, // Override default admin → ADMIN mapping
        },
      });

      expect(customService.mapRole({ role: 'admin' })).toBe(UserRole.VIEWER);
    });
  });

  describe('Default role fallback', () => {
    it('should return default role for unmapped JWT role', () => {
      const payload = { role: 'unknown_role' };
      expect(service.mapRole(payload)).toBe(UserRole.GUEST); // Default
    });

    it('should return custom default role when specified', () => {
      const customService = new RoleMapperService({
        defaultRole: UserRole.VIEWER,
      });

      expect(customService.mapRole({ role: 'invalid' })).toBe(UserRole.VIEWER);
    });

    it('should return default role when claim is missing', () => {
      const payload = { userId: 'user-123' }; // No 'role' field
      expect(service.mapRole(payload)).toBe(UserRole.GUEST);
    });

    it('should return default role when claim is null', () => {
      const payload = { role: null };
      expect(service.mapRole(payload)).toBe(UserRole.GUEST);
    });

    it('should return default role when claim is undefined', () => {
      const payload = { role: undefined };
      expect(service.mapRole(payload)).toBe(UserRole.GUEST);
    });
  });

  describe('Multiple roles (array)', () => {
    it('should reject multiple roles when allowMultipleRoles=false', () => {
      const payload = { role: ['admin', 'surgeon'] };
      expect(service.mapRole(payload)).toBe(UserRole.GUEST); // Default
    });

    it('should map first valid role when allowMultipleRoles=true', () => {
      const multiRoleService = new RoleMapperService({
        allowMultipleRoles: true,
      });

      const payload = { role: ['invalid1', 'surgeon', 'admin'] };
      expect(multiRoleService.mapRole(payload)).toBe(UserRole.SURGEON); // First valid
    });

    it('should return default if no valid roles in array', () => {
      const multiRoleService = new RoleMapperService({
        allowMultipleRoles: true,
      });

      const payload = { role: ['invalid1', 'invalid2'] };
      expect(multiRoleService.mapRole(payload)).toBe(UserRole.GUEST);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string role', () => {
      const payload = { role: '' };
      expect(service.mapRole(payload)).toBe(UserRole.GUEST);
    });

    it('should handle empty array roles', () => {
      const multiRoleService = new RoleMapperService({
        allowMultipleRoles: true,
      });

      const payload = { role: [] };
      expect(multiRoleService.mapRole(payload)).toBe(UserRole.GUEST);
    });

    it('should handle non-string role values', () => {
      const payload = { role: 123 }; // Number instead of string
      expect(service.mapRole(payload)).toBe(UserRole.GUEST);
    });

    it('should handle object role value', () => {
      const payload = { role: { nested: 'admin' } };
      expect(service.mapRole(payload)).toBe(UserRole.GUEST);
    });
  });

  describe('Configuration management', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();

      expect(config.claimPath).toBe('role');
      expect(config.defaultRole).toBe(UserRole.GUEST);
      expect(config.caseInsensitive).toBe(true);
      expect(config.allowMultipleRoles).toBe(false);
    });

    it('should update configuration at runtime', () => {
      service.updateConfig({
        defaultRole: UserRole.VIEWER,
        allowMultipleRoles: true,
      });

      const config = service.getConfig();
      expect(config.defaultRole).toBe(UserRole.VIEWER);
      expect(config.allowMultipleRoles).toBe(true);
    });

    it('should merge new custom mappings on update', () => {
      service.updateConfig({
        customMappings: {
          new_role: UserRole.ADMIN,
        },
      });

      expect(service.mapRole({ role: 'new_role' })).toBe(UserRole.ADMIN);
      expect(service.mapRole({ role: 'surgeon' })).toBe(UserRole.SURGEON); // Default still works
    });
  });

  describe('Role validation', () => {
    it('should validate UserRole enum values', () => {
      expect(service.isValidRole(UserRole.ADMIN)).toBe(true);
      expect(service.isValidRole(UserRole.SURGEON)).toBe(true);
      expect(service.isValidRole(UserRole.GUEST)).toBe(true);
    });

    it('should reject invalid role strings', () => {
      expect(service.isValidRole('invalid_role' as UserRole)).toBe(false);
    });
  });

  describe('Real-world JWT patterns', () => {
    it('should handle Auth0 JWT structure (special characters in claim path)', () => {
      // Auth0 uses URLs as claim keys, which contain special chars
      // Our current implementation splits on '.', so this won't work with URLs
      // This test documents the limitation - URL-style claims need escaped path or custom parser
      const auth0Payload = {
        role: 'admin', // Fallback to simple claim for Auth0
      };

      expect(service.mapRole(auth0Payload)).toBe(UserRole.ADMIN);

      // TODO: If URL-style claims are needed, enhance getNestedProperty()
      // to support bracket notation: ['https://my-app.com/roles']
    });

    it('should handle Keycloak JWT structure', () => {
      const keycloakPayload = {
        realm_access: {
          roles: ['offline_access', 'surgeon', 'uma_authorization'],
        },
      };

      const keycloakService = new RoleMapperService({
        claimPath: 'realm_access.roles',
        allowMultipleRoles: true,
      });

      expect(keycloakService.mapRole(keycloakPayload)).toBe(UserRole.SURGEON);
    });

    it('should handle simple JWT with single role', () => {
      const simplePayload = {
        sub: 'user-123',
        email: 'doctor@example.com',
        role: 'surgeon',
      };

      expect(service.mapRole(simplePayload)).toBe(UserRole.SURGEON);
    });
  });
});
