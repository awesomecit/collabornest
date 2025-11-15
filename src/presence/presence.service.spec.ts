import { Test, TestingModule } from '@nestjs/testing';
import { PresenceService } from './presence.service';
import { COLLABORNEST_CONFIG } from '../config/config.module';
import { UserRole, PresenceStatus } from '../interfaces';

describe('PresenceService', () => {
  let service: PresenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PresenceService,
        {
          provide: COLLABORNEST_CONFIG,
          useValue: {
            redis: {
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379'),
              keyPrefix: 'test:',
            },
            presence: {
              heartbeatInterval: 30000,
              timeout: 60000,
            },
          },
        },
      ],
    }).compile();

    service = module.get<PresenceService>(PresenceService);
  });

  afterEach(async () => {
    await service.cleanup();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should join a resource', async () => {
    const presence = await service.joinResource('user-1', 'resource-1', UserRole.EDITOR);

    expect(presence).toBeDefined();
    expect(presence.userId).toBe('user-1');
    expect(presence.resourceId).toBe('resource-1');
    expect(presence.role).toBe(UserRole.EDITOR);
    expect(presence.status).toBe(PresenceStatus.ONLINE);
  });

  it('should get resource presence', async () => {
    await service.joinResource('user-1', 'resource-1', UserRole.EDITOR);
    await service.joinResource('user-2', 'resource-1', UserRole.VIEWER);

    const presences = await service.getResourcePresence('resource-1');

    expect(presences).toHaveLength(2);
    expect(presences.some((p) => p.userId === 'user-1')).toBeTruthy();
    expect(presences.some((p) => p.userId === 'user-2')).toBeTruthy();
  });

  it('should leave a resource', async () => {
    await service.joinResource('user-1', 'resource-1', UserRole.EDITOR);
    await service.leaveResource('user-1', 'resource-1');

    const presence = await service.getPresence('user-1', 'resource-1');
    expect(presence).toBeNull();
  });

  it('should update heartbeat', async () => {
    const initial = await service.joinResource('user-1', 'resource-1', UserRole.EDITOR);

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 100));

    await service.updateHeartbeat('user-1', 'resource-1');
    const updated = await service.getPresence('user-1', 'resource-1');

    expect(updated).toBeDefined();
    expect(new Date(updated!.lastHeartbeat).getTime()).toBeGreaterThan(
      new Date(initial.lastHeartbeat).getTime(),
    );
  });

  it('should update status', async () => {
    await service.joinResource('user-1', 'resource-1', UserRole.EDITOR);
    await service.updateStatus('user-1', 'resource-1', PresenceStatus.AWAY);

    const presence = await service.getPresence('user-1', 'resource-1');
    expect(presence?.status).toBe(PresenceStatus.AWAY);
  });
});
