import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ClassConstructor, instanceToPlain } from 'class-transformer';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interceptor for transforming entity responses to DTOs
 * Automatically converts snake_case to camelCase and excludes sensitive fields
 */
@Injectable()
export class TransformResponseInterceptor<T, R>
  implements NestInterceptor<T, R>
{
  constructor(private readonly dtoClass: ClassConstructor<R>) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<R> {
    return next.handle().pipe(
      map(data => {
        if (!data) {
          return data;
        }

        // Handle arrays
        if (Array.isArray(data)) {
          return data.map(item => this.transformObject(item)) as unknown as R;
        }

        // Handle single objects
        return this.transformObject(data) as unknown as R;
      }),
    );
  }

  private transformObject<T>(obj: unknown): T | unknown {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    // Convert to DTO using class-transformer
    return instanceToPlain(new this.dtoClass(obj), {
      excludeExtraneousValues: true,
    });
  }
}
