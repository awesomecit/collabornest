import { Test, TestingModule } from '@nestjs/testing';
import { ResourceService } from './resource.service';
import { COLLABORNEST_CONFIG } from '../config/config.module';
import { ResourceType } from '../interfaces';

describe('ResourceService', () => {
  let service: ResourceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourceService,
        {
          provide: COLLABORNEST_CONFIG,
          useValue: {
            redis: {
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379'),
              keyPrefix: 'test:',
            },
          },
        },
      ],
    }).compile();

    service = module.get<ResourceService>(ResourceService);
  });

  afterEach(async () => {
    await service.cleanup();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a root resource', async () => {
    const resource = await service.createResource('Test Resource', ResourceType.ROOT);

    expect(resource).toBeDefined();
    expect(resource.name).toBe('Test Resource');
    expect(resource.resourceType).toBe(ResourceType.ROOT);
    expect(resource.parentId).toBeUndefined();
  });

  it('should create a child resource', async () => {
    const parent = await service.createResource('Parent', ResourceType.ROOT);
    const child = await service.createResource('Child', ResourceType.CHILD, parent.resourceId);

    expect(child).toBeDefined();
    expect(child.parentId).toBe(parent.resourceId);
  });

  it('should get resource by id', async () => {
    const created = await service.createResource('Test', ResourceType.ROOT);
    const retrieved = await service.getResource(created.resourceId);

    expect(retrieved).toBeDefined();
    expect(retrieved?.resourceId).toBe(created.resourceId);
  });

  it('should update a resource', async () => {
    const resource = await service.createResource('Original', ResourceType.ROOT);
    const updated = await service.updateResource(resource.resourceId, {
      name: 'Updated',
    });

    expect(updated).toBeDefined();
    expect(updated?.name).toBe('Updated');
  });

  it('should get children of a resource', async () => {
    const parent = await service.createResource('Parent', ResourceType.ROOT);
    await service.createResource('Child 1', ResourceType.CHILD, parent.resourceId);
    await service.createResource('Child 2', ResourceType.CHILD, parent.resourceId);

    const children = await service.getChildren(parent.resourceId);

    expect(children).toHaveLength(2);
  });

  it('should get parent of a resource', async () => {
    const parent = await service.createResource('Parent', ResourceType.ROOT);
    const child = await service.createResource('Child', ResourceType.CHILD, parent.resourceId);

    const retrievedParent = await service.getParent(child.resourceId);

    expect(retrievedParent).toBeDefined();
    expect(retrievedParent?.resourceId).toBe(parent.resourceId);
  });

  it('should delete a resource', async () => {
    const resource = await service.createResource('To Delete', ResourceType.ROOT);
    const deleted = await service.deleteResource(resource.resourceId);

    expect(deleted).toBeTruthy();

    const retrieved = await service.getResource(resource.resourceId);
    expect(retrieved).toBeNull();
  });

  it('should delete resource with children', async () => {
    const parent = await service.createResource('Parent', ResourceType.ROOT);
    const child = await service.createResource('Child', ResourceType.CHILD, parent.resourceId);

    await service.deleteResource(parent.resourceId);

    const retrievedParent = await service.getResource(parent.resourceId);
    const retrievedChild = await service.getResource(child.resourceId);

    expect(retrievedParent).toBeNull();
    expect(retrievedChild).toBeNull();
  });

  it('should get root resources', async () => {
    await service.createResource('Root 1', ResourceType.ROOT);
    await service.createResource('Root 2', ResourceType.ROOT);

    const roots = await service.getRootResources();

    expect(roots.length).toBeGreaterThanOrEqual(2);
    expect(roots.every((r) => r.resourceType === ResourceType.ROOT)).toBeTruthy();
  });
});
