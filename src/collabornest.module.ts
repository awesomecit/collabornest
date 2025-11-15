import { DynamicModule, Module } from '@nestjs/common';
import { CollaborNestConfigModule } from './config/config.module';
import { PresenceService } from './presence/presence.service';
import { LockingService } from './locking/locking.service';
import { RolesService } from './roles/roles.service';
import { ResourceService } from './resources/resource.service';
import { ReconciliationService, MonitoringService } from './reconciliation/reconciliation.service';
import { CollaborationGateway } from './collaboration.gateway';
import { CollaborNestConfig } from './interfaces';

@Module({})
export class CollaborNestModule {
  static forRoot(config: CollaborNestConfig): DynamicModule {
    return {
      module: CollaborNestModule,
      imports: [CollaborNestConfigModule.forRoot(config)],
      providers: [
        PresenceService,
        LockingService,
        RolesService,
        ResourceService,
        ReconciliationService,
        MonitoringService,
        CollaborationGateway,
      ],
      exports: [
        PresenceService,
        LockingService,
        RolesService,
        ResourceService,
        ReconciliationService,
        MonitoringService,
      ],
    };
  }
}
