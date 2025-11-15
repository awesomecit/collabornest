import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { COLLABORNEST_CONFIG } from '../config/config.module';
import { CollaborNestConfig, UserRole } from '../interfaces';

@Injectable()
export class RolesService {
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

  async assignRole(userId: string, resourceId: string, role: UserRole): Promise<void> {
    const key = `${this.keyPrefix}role:${resourceId}:${userId}`;
    await this.redis.set(key, role);
  }

  async getRole(userId: string, resourceId: string): Promise<UserRole | null> {
    const key = `${this.keyPrefix}role:${resourceId}:${userId}`;
    const role = await this.redis.get(key);
    return role as UserRole | null;
  }

  async removeRole(userId: string, resourceId: string): Promise<void> {
    const key = `${this.keyPrefix}role:${resourceId}:${userId}`;
    await this.redis.del(key);
  }

  async isEditor(userId: string, resourceId: string): Promise<boolean> {
    const role = await this.getRole(userId, resourceId);
    return role === UserRole.EDITOR;
  }

  async isViewer(userId: string, resourceId: string): Promise<boolean> {
    const role = await this.getRole(userId, resourceId);
    return role === UserRole.VIEWER;
  }

  async getEditors(resourceId: string): Promise<string[]> {
    const pattern = `${this.keyPrefix}role:${resourceId}:*`;
    const keys = await this.redis.keys(pattern);
    const editors: string[] = [];

    for (const key of keys) {
      const role = await this.redis.get(key);
      if (role === UserRole.EDITOR) {
        const userId = key.split(':').pop();
        if (userId) {
          editors.push(userId);
        }
      }
    }

    return editors;
  }

  async getViewers(resourceId: string): Promise<string[]> {
    const pattern = `${this.keyPrefix}role:${resourceId}:*`;
    const keys = await this.redis.keys(pattern);
    const viewers: string[] = [];

    for (const key of keys) {
      const role = await this.redis.get(key);
      if (role === UserRole.VIEWER) {
        const userId = key.split(':').pop();
        if (userId) {
          viewers.push(userId);
        }
      }
    }

    return viewers;
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
  }
}
