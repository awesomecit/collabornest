import { Module } from '@nestjs/common';
import { CollaborNestModule } from '../src';

@Module({
  imports: [
    CollaborNestModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        keyPrefix: 'collabornest:',
      },
      rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
        exchange: 'collabornest.events',
        queue: 'collabornest.reconciliation',
      },
      presence: {
        heartbeatInterval: 30000,
        timeout: 60000,
      },
      locking: {
        defaultTimeout: 300000,
        maxTimeout: 3600000,
      },
      monitoring: {
        enabled: true,
        metricsInterval: 60000,
      },
    }),
  ],
})
export class ExampleAppModule {}
