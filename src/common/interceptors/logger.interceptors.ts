import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CustomLogger } from '../logger/logger.service';
import { Response, Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method || 'Unknown';
    const url = request.url || 'Unknown';
    const ip = request.ip || 'Unknown';
    const userAgent = request.get('User-Agent') || 'Unknown';
    const startTime = Date.now();

    this.logger.log(`${method} ${url} - ${ip} - ${userAgent}`, 'HTTP');

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const statusCode =
            response.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
          const duration = Date.now() - startTime;

          this.logger.log(
            `${method} ${url} - ${statusCode} - ${duration}ms`,
            'HTTP',
          );
        },
        error: (error: Error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `${method} ${url} - Error after ${duration}ms`,
            error.stack || 'No stack trace available',
            'HTTP',
          );
        },
      }),
    );
  }
}
