/**
 * Interface that adapters must implement to integrate with CollaborNest
 */
export interface IResourceAdapter<T = any> {
  /**
   * Find a resource by its ID
   */
  findOne(resourceId: string): Promise<T | null>;

  /**
   * Find a child resource (optional)
   */
  findChild?(resourceId: string, childId: string): Promise<any | null>;

  /**
   * Save a new revision for a resource
   */
  saveRevision(
    resourceId: string,
    payload: {
      revisionId?: string;
      patch?: any;
      metadata?: any;
    },
  ): Promise<{ revisionId: string }>;

  /**
   * Apply a patch to current state (optional)
   */
  applyPatch?(current: any, patch: any): Promise<any>;

  /**
   * Generate a unique ID (optional)
   */
  createId?(): string;
}
