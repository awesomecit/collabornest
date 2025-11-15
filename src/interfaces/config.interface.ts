export interface CollaborNestConfig {
  redis: RedisConfig;
  rabbitmq?: RabbitMQConfig;
  presence?: PresenceConfig;
  locking?: LockingConfig;
  monitoring?: MonitoringConfig;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface RabbitMQConfig {
  url: string;
  exchange?: string;
  queue?: string;
}

export interface PresenceConfig {
  heartbeatInterval?: number; // milliseconds, default: 30000
  timeout?: number; // milliseconds, default: 60000
}

export interface LockingConfig {
  defaultTimeout?: number; // milliseconds, default: 300000 (5 minutes)
  maxTimeout?: number; // milliseconds, default: 3600000 (1 hour)
}

export interface MonitoringConfig {
  enabled?: boolean;
  metricsInterval?: number; // milliseconds, default: 60000
}
