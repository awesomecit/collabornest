import { Controller, Get } from '@nestjs/common';
import { CustomLogger } from './common/logger/logger.service';

@Controller()
export class AppController {
  constructor(private readonly logger: CustomLogger) {}

  @Get()
  getHello(): { message: string; timestamp: string } {
    this.logger.log('Hello endpoint called', 'AppController');
    return {
      message: 'Hello World! Your NestJS backend is running perfectly! 🚀',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-error')
  testError(): never {
    this.logger.log('Test error endpoint called', 'AppController');
    throw new Error('This is a test error to verify error handling');
  }

  @Get('test-log')
  testLog(): { message: string } {
    this.logger.log('Testing different log levels', 'AppController');
    this.logger.debug('This is a debug message', 'AppController');
    this.logger.warn('This is a warning message', 'AppController');
    this.logger.error(
      'This is an error message for testing',
      undefined,
      'AppController',
    );
    this.logger.verbose('This is a verbose message', 'AppController');

    return {
      message: 'Check your logs! Different log levels have been written.',
    };
  }
}
