import { DynamicModule, Module, Global } from '@nestjs/common';
import { CollaborNestConfig } from '../interfaces';

export const COLLABORNEST_CONFIG = 'COLLABORNEST_CONFIG';

@Global()
@Module({})
export class CollaborNestConfigModule {
  static forRoot(config: CollaborNestConfig): DynamicModule {
    return {
      module: CollaborNestConfigModule,
      providers: [
        {
          provide: COLLABORNEST_CONFIG,
          useValue: config,
        },
      ],
      exports: [COLLABORNEST_CONFIG],
    };
  }
}
