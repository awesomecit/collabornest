import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  /**
   * Schema di esempio per risposte di successo health check
   */
  private static getSuccessSchema() {
    return {
      example: {
        status: 'ok',
        info: {
          database: { status: 'up' },
          memory_heap: { status: 'up' },
          storage: { status: 'up' },
        },
        error: {},
        details: {
          database: { status: 'up' },
          memory_heap: { status: 'up' },
          storage: { status: 'up' },
        },
      },
    };
  }

  /**
   * Schema di esempio per risposte di errore health check
   */
  private static getErrorSchema() {
    return {
      example: {
        status: 'error',
        info: {},
        error: {
          database: {
            status: 'down',
            message: 'Database connection failed',
          },
        },
        details: {
          database: {
            status: 'down',
            message: 'Database connection failed',
          },
          memory_heap: { status: 'up' },
          storage: { status: 'up' },
        },
      },
    };
  }

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: "Controlla lo stato di salute dell'applicazione",
    description:
      "Verifica database, memoria e spazio su disco dell'applicazione",
  })
  @ApiResponse({
    status: 200,
    description: "L'applicazione è in salute",
    schema: HealthController.getSuccessSchema(),
  })
  @ApiResponse({
    status: 503,
    description: 'Uno o più servizi non sono disponibili',
    schema: HealthController.getErrorSchema(),
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }
}
