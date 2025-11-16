/**
 * Resource Validation Interface
 * 
 * Abstraction layer for resource validation in Socket Gateway.
 * Follows Dependency Inversion Principle (SOLID) - depend on abstractions, not concretions.
 * 
 * This allows Socket Gateway to validate resources without tight coupling to specific services.
 */

import { SurgeryManagementStatus } from '../../surgery-management-revision/entities/surgery-management-revision.entity';

/**
 * Generic Resource Entity
 * Represents any resource that can be validated by the gateway
 */
export interface IResourceEntity {
  uuid: string;
  status: SurgeryManagementStatus; // TODO: Generalize to ResourceStatus if needed
  [key: string]: any; // Allow additional properties
}

/**
 * Resource Validation Service Interface
 * 
 * Any service that implements this interface can be used by Socket Gateway
 * to validate resource access during collaboration sessions.
 * 
 * Example implementations:
 * - SurgeryManagementValidationAdapter (wraps SurgeryManagementService)
 * - PatientRecordValidationAdapter (future)
 * - DiagnosisValidationAdapter (future)
 */
export interface IResourceValidationService {
  /**
   * Find a resource by UUID
   * 
   * @param uuid - Resource unique identifier
   * @returns Resource entity or null if not found
   * @throws Never throws - returns null on not found
   */
  findOne(uuid: string): Promise<IResourceEntity | null>;

  /**
   * Validate if user can join resource room
   * 
   * @param uuid - Resource unique identifier
   * @param userId - User attempting to join
   * @returns true if access is allowed, false otherwise
   * @throws Never throws - returns false on validation failure
   */
  canJoinResource?(uuid: string, userId: string): Promise<boolean>;

  /**
   * Validate if resource is in a state that allows collaboration
   * 
   * @param resource - Resource entity
   * @returns true if resource is open for collaboration
   */
  isResourceOpen(resource: IResourceEntity): boolean;
}

/**
 * Resource Validation Result
 * Returned by validation methods to provide structured feedback
 */
export interface IResourceValidationResult {
  allowed: boolean;
  reason?: string;
  resource?: IResourceEntity;
}
