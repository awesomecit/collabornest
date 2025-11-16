import { Injectable } from '@nestjs/common';
import { SurgeryManagementService } from '../../surgery-management/surgery-management.service';
import { SurgeryManagementStatus } from '../../surgery-management-revision/entities/surgery-management-revision.entity';
import {
  IResourceValidationService,
  IResourceEntity,
} from '../interfaces/resource-validation.interface';

/**
 * Surgery Management Validation Adapter
 * 
 * Adapts SurgeryManagementService to IResourceValidationService interface.
 * Follows Adapter Pattern to decouple Socket Gateway from concrete service implementation.
 * 
 * This allows Socket Gateway to validate surgery resources without direct dependency
 * on SurgeryManagementService internal implementation.
 */
@Injectable()
export class SurgeryManagementValidationAdapter
  implements IResourceValidationService
{
  constructor(
    private readonly surgeryManagementService: SurgeryManagementService,
  ) {}

  /**
   * Find a surgery resource by UUID
   * 
   * @param uuid - Surgery UUID
   * @returns Surgery entity or null if not found
   */
  async findOne(uuid: string): Promise<IResourceEntity | null> {
    try {
      const surgery = await this.surgeryManagementService.findOne(uuid);
      if (!surgery) {
        return null;
      }
      // Cast to unknown first to satisfy TypeScript
      return surgery as unknown as IResourceEntity;
    } catch (error) {
      // Log error but don't throw - return null for not found
      return null;
    }
  }

  /**
   * Validate if surgery resource is open for collaboration
   * 
   * Business Rule: Only CONFIRMED surgeries are open for collaboration.
   * - DRAFT: Not ready yet
   * - IN_PROGRESS: Already being processed
   * - VALIDATED: Closed, read-only
   * - CANCELLED: Closed, no access
   * 
   * @param resource - Surgery resource entity
   * @returns true if surgery is CONFIRMED (open for collaboration)
   */
  isResourceOpen(resource: IResourceEntity): boolean {
    return resource.status === SurgeryManagementStatus.CONFIRMED;
  }

  /**
   * Validate if user can join surgery room
   * 
   * Future: Add user permission checks, role validation, etc.
   * For now, delegates to isResourceOpen (status check only)
   * 
   * @param uuid - Surgery UUID
   * @param userId - User attempting to join
   * @returns true if user can join
   */
  async canJoinResource(uuid: string, userId: string): Promise<boolean> {
    const resource = await this.findOne(uuid);
    if (!resource) {
      return false;
    }

    // For now, only check resource status
    // Future: Add user permission checks here
    return this.isResourceOpen(resource);
  }
}
