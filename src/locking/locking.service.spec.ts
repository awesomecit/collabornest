import { Test, TestingModule } from '@nestjs/testing';
import { LockingService } from './locking.service';
import { COLLABORNEST_CONFIG } from '../config/config.module';

describe('LockingService', () => {
  let service: LockingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LockingService,
        {
          provide: COLLABORNEST_CONFIG,
          useValue: {
            redis: {
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379'),
              keyPrefix: 'test:',
            },
            locking: {
              defaultTimeout: 300000,
              maxTimeout: 3600000,
            },
          },
        },
      ],
    }).compile();

    service = module.get<LockingService>(LockingService);
  });

  afterEach(async () => {
    await service.cleanup();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should acquire a lock', async () => {
    const lock = await service.acquireLock('resource-1', 'user-1');

    expect(lock).toBeDefined();
    expect(lock?.resourceId).toBe('resource-1');
    expect(lock?.userId).toBe('user-1');
  });

  it('should not acquire lock when already locked', async () => {
    await service.acquireLock('resource-1', 'user-1');
    const secondLock = await service.acquireLock('resource-1', 'user-2');

    expect(secondLock).toBeNull();
  });

  it('should release a lock', async () => {
    await service.acquireLock('resource-1', 'user-1');
    const released = await service.releaseLock('resource-1', 'user-1');

    expect(released).toBeTruthy();
  });

  it('should not release lock by different user', async () => {
    await service.acquireLock('resource-1', 'user-1');
    const released = await service.releaseLock('resource-1', 'user-2');

    expect(released).toBeFalsy();
  });

  it('should get lock status', async () => {
    const lock = await service.acquireLock('resource-1', 'user-1');
    const retrieved = await service.getLock('resource-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.lockId).toBe(lock?.lockId);
  });

  it('should check if resource is locked', async () => {
    await service.acquireLock('resource-1', 'user-1');
    const isLocked = await service.isLocked('resource-1');

    expect(isLocked).toBeTruthy();
  });

  it('should check if resource is locked by specific user', async () => {
    await service.acquireLock('resource-1', 'user-1');
    const isLockedByUser = await service.isLockedByUser('resource-1', 'user-1');
    const isLockedByOther = await service.isLockedByUser('resource-1', 'user-2');

    expect(isLockedByUser).toBeTruthy();
    expect(isLockedByOther).toBeFalsy();
  });

  it('should renew a lock', async () => {
    const initial = await service.acquireLock('resource-1', 'user-1', 1000);
    const renewed = await service.renewLock('resource-1', 'user-1', 2000);

    expect(renewed).toBeDefined();
    expect(new Date(renewed!.expiresAt).getTime()).toBeGreaterThan(
      new Date(initial!.expiresAt).getTime(),
    );
  });
});
