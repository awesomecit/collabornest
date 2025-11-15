import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { CollaborNestModule } from '../src';
import { ExampleController } from './controller.example';

@Module({
  imports: [
    CollaborNestModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
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
  controllers: [ExampleController],
})
export class ExampleAppModule {}

async function bootstrap() {
  const app = await NestFactory.create(ExampleAppModule);
  
  // Enable CORS for development
  app.enableCors();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`CollaborNest Example App listening on port ${port}`);
  console.log(`WebSocket server ready at ws://localhost:${port}`);
  console.log(`\nEndpoints available:`);
  console.log(`  POST /api/presence/join - Join a resource`);
  console.log(`  POST /api/lock/acquire - Acquire a lock`);
  console.log(`  POST /api/resource - Create a resource`);
  console.log(`  GET  /api/metrics - Get system metrics`);
  console.log(`\nWebSocket events:`);
  console.log(`  joinResource, acquireLock, publishEvent`);
}

// Uncomment to run the example server
// bootstrap();
