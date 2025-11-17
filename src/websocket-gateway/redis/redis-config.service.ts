import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Redis configuration keys (Single Source of Truth)
 */
export enum RedisConfigKey {
  HOST = 'REDIS_HOST',
  PORT = 'REDIS_PORT',
  DB = 'REDIS_DB',
  PASSWORD = 'REDIS_PASSWORD',
}

/**
 * Redis Configuration Interface
 */
export interface RedisConfig {
  host: string;
  port: number;
  db: number;
  password?: string;
}

/**
 * Redis Configuration Service
 *
 * Centralizes Redis connection configuration for WebSocket Gateway.
 * Separates Redis config from WebSocket config for better modularity.
 *
 * Environment Variables:
 * - REDIS_HOST: Redis server hostname (default: localhost)
 * - REDIS_PORT: Redis server port (default: 6379)
 * - REDIS_DB: Redis database number (default: 0 for production, 15 for tests)
 * - REDIS_PASSWORD: Redis authentication password (optional)
 *
 * Usage:
 * ```typescript
 * const config = redisConfigService.getRedisConfig();
 * const redis = new Redis(config);
 * ```
 */
@Injectable()
export class RedisConfigService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Get complete Redis configuration
   * @returns Redis connection configuration object
   */
  getRedisConfig(): RedisConfig {
    return {
      host: this.getHost(),
      port: this.getPort(),
      db: this.getDb(),
      password: this.getPassword(),
    };
  }

  /**
   * Get Redis host
   * @returns Redis server hostname
   */
  getHost(): string {
    return this.configService.get<string>(RedisConfigKey.HOST, 'localhost');
  }

  /**
   * Get Redis port
   * @returns Redis server port number
   */
  getPort(): number {
    return this.configService.get<number>(RedisConfigKey.PORT, 6379);
  }

  /**
   * Get Redis database number
   * @returns Redis database index (0-15)
   */
  getDb(): number {
    return this.configService.get<number>(RedisConfigKey.DB, 0);
  }

  /**
   * Get Redis password
   * @returns Redis authentication password or undefined
   */
  getPassword(): string | undefined {
    return this.configService.get<string>(RedisConfigKey.PASSWORD);
  }
}
