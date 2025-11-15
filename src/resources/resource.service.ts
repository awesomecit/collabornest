import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { COLLABORNEST_CONFIG } from '../config/config.module';
import { CollaborNestConfig, Resource, ResourceType } from '../interfaces';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ResourceService {
  private redis: Redis;
  private readonly keyPrefix: string;

  constructor(@Inject(COLLABORNEST_CONFIG) private config: CollaborNestConfig) {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db || 0,
    });
    this.keyPrefix = config.redis.keyPrefix || 'collabornest:';
  }

  async createResource(
    name: string,
    resourceType: ResourceType,
    parentId?: string,
    metadata?: Record<string, any>,
  ): Promise<Resource> {
    const resource: Resource = {
      resourceId: uuidv4(),
      resourceType,
      parentId,
      name,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const key = `${this.keyPrefix}resource:${resource.resourceId}`;
    await this.redis.set(key, JSON.stringify(resource));

    // If has parent, add to parent's children
    if (parentId) {
      await this.redis.sadd(`${this.keyPrefix}resource:${parentId}:children`, resource.resourceId);
    }

    // Add to resources set
    await this.redis.sadd(`${this.keyPrefix}resources`, resource.resourceId);

    return resource;
  }

  async getResource(resourceId: string): Promise<Resource | null> {
    const key = `${this.keyPrefix}resource:${resourceId}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data);
  }

  async updateResource(
    resourceId: string,
    updates: Partial<Omit<Resource, 'resourceId' | 'createdAt'>>,
  ): Promise<Resource | null> {
    const resource = await this.getResource(resourceId);

    if (!resource) {
      return null;
    }

    const updatedResource: Resource = {
      ...resource,
      ...updates,
      updatedAt: new Date(),
    };

    const key = `${this.keyPrefix}resource:${resourceId}`;
    await this.redis.set(key, JSON.stringify(updatedResource));

    return updatedResource;
  }

  async deleteResource(resourceId: string): Promise<boolean> {
    const resource = await this.getResource(resourceId);

    if (!resource) {
      return false;
    }

    // Delete all children first
    const children = await this.getChildren(resourceId);
    for (const child of children) {
      await this.deleteResource(child.resourceId);
    }

    // Remove from parent's children
    if (resource.parentId) {
      await this.redis.srem(`${this.keyPrefix}resource:${resource.parentId}:children`, resourceId);
    }

    // Delete resource
    const key = `${this.keyPrefix}resource:${resourceId}`;
    await this.redis.del(key);

    // Remove from resources set
    await this.redis.srem(`${this.keyPrefix}resources`, resourceId);

    // Clean up children set
    await this.redis.del(`${this.keyPrefix}resource:${resourceId}:children`);

    return true;
  }

  async getChildren(resourceId: string): Promise<Resource[]> {
    const childIds = await this.redis.smembers(`${this.keyPrefix}resource:${resourceId}:children`);
    const children: Resource[] = [];

    for (const childId of childIds) {
      const child = await this.getResource(childId);
      if (child) {
        children.push(child);
      }
    }

    return children;
  }

  async getParent(resourceId: string): Promise<Resource | null> {
    const resource = await this.getResource(resourceId);

    if (!resource || !resource.parentId) {
      return null;
    }

    return this.getResource(resource.parentId);
  }

  async getAllResources(): Promise<Resource[]> {
    const resourceIds = await this.redis.smembers(`${this.keyPrefix}resources`);
    const resources: Resource[] = [];

    for (const resourceId of resourceIds) {
      const resource = await this.getResource(resourceId);
      if (resource) {
        resources.push(resource);
      }
    }

    return resources;
  }

  async getRootResources(): Promise<Resource[]> {
    const allResources = await this.getAllResources();
    return allResources.filter((r) => r.resourceType === ResourceType.ROOT);
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}
