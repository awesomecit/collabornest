import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PresenceService } from './presence/presence.service';
import { LockingService } from './locking/locking.service';
import { RolesService } from './roles/roles.service';
import { ReconciliationService } from './reconciliation/reconciliation.service';
import { UserRole, PresenceStatus } from './interfaces';

interface JoinResourcePayload {
  userId: string;
  resourceId: string;
  role: UserRole;
  metadata?: Record<string, any>;
}

interface LockPayload {
  userId: string;
  resourceId: string;
  timeout?: number;
}

interface EventPayload {
  userId: string;
  resourceId: string;
  eventType: string;
  data: any;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets: Map<string, Socket> = new Map();

  constructor(
    private readonly presenceService: PresenceService,
    private readonly lockingService: LockingService,
    private readonly rolesService: RolesService,
    private readonly reconciliationService: ReconciliationService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);

    // Clean up user presence
    const userId = client.data.userId;
    const resourceId = client.data.resourceId;

    if (userId && resourceId) {
      await this.presenceService.leaveResource(userId, resourceId);
      this.server.to(resourceId).emit('userLeft', { userId, resourceId });
    }

    this.userSockets.delete(userId);
  }

  @SubscribeMessage('joinResource')
  async handleJoinResource(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinResourcePayload,
  ) {
    const { userId, resourceId, role, metadata } = payload;

    // Store user info in socket
    client.data.userId = userId;
    client.data.resourceId = resourceId;

    // Join resource room
    client.join(resourceId);

    // Track socket
    this.userSockets.set(userId, client);

    // Register presence
    const presence = await this.presenceService.joinResource(userId, resourceId, role, metadata);

    // Assign role
    await this.rolesService.assignRole(userId, resourceId, role);

    // Get all users in resource
    const allPresence = await this.presenceService.getResourcePresence(resourceId);

    // Notify others
    client.to(resourceId).emit('userJoined', presence);

    // Send current state to joining user
    return {
      success: true,
      presence,
      allUsers: allPresence,
    };
  }

  @SubscribeMessage('leaveResource')
  async handleLeaveResource(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: string; resourceId: string },
  ) {
    const { userId, resourceId } = payload;

    await this.presenceService.leaveResource(userId, resourceId);
    client.leave(resourceId);
    this.userSockets.delete(userId);

    this.server.to(resourceId).emit('userLeft', { userId, resourceId });

    return { success: true };
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: string; resourceId: string },
  ) {
    const { userId, resourceId } = payload;
    await this.presenceService.updateHeartbeat(userId, resourceId);
    return { success: true };
  }

  @SubscribeMessage('updateStatus')
  async handleUpdateStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: string; resourceId: string; status: PresenceStatus },
  ) {
    const { userId, resourceId, status } = payload;
    await this.presenceService.updateStatus(userId, resourceId, status);

    this.server.to(resourceId).emit('statusChanged', { userId, status });

    return { success: true };
  }

  @SubscribeMessage('acquireLock')
  async handleAcquireLock(@ConnectedSocket() client: Socket, @MessageBody() payload: LockPayload) {
    const { userId, resourceId, timeout } = payload;

    const lock = await this.lockingService.acquireLock(resourceId, userId, timeout);

    if (lock) {
      this.server.to(resourceId).emit('lockAcquired', lock);
      return { success: true, lock };
    }

    return { success: false, message: 'Resource is already locked' };
  }

  @SubscribeMessage('releaseLock')
  async handleReleaseLock(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: string; resourceId: string },
  ) {
    const { userId, resourceId } = payload;

    const released = await this.lockingService.releaseLock(resourceId, userId);

    if (released) {
      this.server.to(resourceId).emit('lockReleased', { resourceId, userId });
      return { success: true };
    }

    return { success: false, message: 'Failed to release lock' };
  }

  @SubscribeMessage('publishEvent')
  async handlePublishEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: EventPayload,
  ) {
    const { userId, resourceId, eventType, data } = payload;

    const event = await this.reconciliationService.publishEvent(
      resourceId,
      userId,
      eventType,
      data,
    );

    // Broadcast event to all users in resource
    this.server.to(resourceId).emit('eventPublished', event);

    return { success: true, event };
  }

  @SubscribeMessage('getPresence')
  async handleGetPresence(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { resourceId: string },
  ) {
    const presence = await this.presenceService.getResourcePresence(payload.resourceId);
    return { success: true, presence };
  }

  @SubscribeMessage('getLock')
  async handleGetLock(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { resourceId: string },
  ) {
    const lock = await this.lockingService.getLock(payload.resourceId);
    return { success: true, lock };
  }
}
