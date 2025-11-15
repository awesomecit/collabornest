import { io, Socket } from 'socket.io-client';
import { UserRole } from '../src';

// Example client demonstrating how to use CollaborNest WebSocket features
class CollaborNestClient {
  private socket: Socket;
  private userId: string;

  constructor(serverUrl: string, userId: string) {
    this.userId = userId;
    this.socket = io(serverUrl);

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('userJoined', (data) => {
      console.log('User joined:', data);
    });

    this.socket.on('userLeft', (data) => {
      console.log('User left:', data);
    });

    this.socket.on('statusChanged', (data) => {
      console.log('Status changed:', data);
    });

    this.socket.on('lockAcquired', (data) => {
      console.log('Lock acquired:', data);
    });

    this.socket.on('lockReleased', (data) => {
      console.log('Lock released:', data);
    });

    this.socket.on('eventPublished', (data) => {
      console.log('Event published:', data);
    });
  }

  joinResource(resourceId: string, role: UserRole = UserRole.VIEWER): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'joinResource',
        {
          userId: this.userId,
          resourceId,
          role,
        },
        (response) => {
          if (response.success) {
            console.log('Joined resource:', resourceId);
            resolve(response);
          } else {
            reject(new Error('Failed to join resource'));
          }
        },
      );
    });
  }

  leaveResource(resourceId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'leaveResource',
        {
          userId: this.userId,
          resourceId,
        },
        (response) => {
          if (response.success) {
            console.log('Left resource:', resourceId);
            resolve(response);
          } else {
            reject(new Error('Failed to leave resource'));
          }
        },
      );
    });
  }

  sendHeartbeat(resourceId: string): Promise<any> {
    return new Promise((resolve) => {
      this.socket.emit(
        'heartbeat',
        {
          userId: this.userId,
          resourceId,
        },
        (response) => {
          resolve(response);
        },
      );
    });
  }

  acquireLock(resourceId: string, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'acquireLock',
        {
          userId: this.userId,
          resourceId,
          timeout,
        },
        (response) => {
          if (response.success) {
            console.log('Lock acquired:', response.lock);
            resolve(response);
          } else {
            reject(new Error(response.message || 'Failed to acquire lock'));
          }
        },
      );
    });
  }

  releaseLock(resourceId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'releaseLock',
        {
          userId: this.userId,
          resourceId,
        },
        (response) => {
          if (response.success) {
            console.log('Lock released');
            resolve(response);
          } else {
            reject(new Error('Failed to release lock'));
          }
        },
      );
    });
  }

  publishEvent(resourceId: string, eventType: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket.emit(
        'publishEvent',
        {
          userId: this.userId,
          resourceId,
          eventType,
          data,
        },
        (response) => {
          if (response.success) {
            console.log('Event published:', response.event);
            resolve(response);
          } else {
            reject(new Error('Failed to publish event'));
          }
        },
      );
    });
  }

  disconnect() {
    this.socket.disconnect();
  }
}

// Usage example
async function main() {
  const client = new CollaborNestClient('http://localhost:3000', 'user-123');

  try {
    // Join a resource as an editor
    await client.joinResource('resource-456', UserRole.EDITOR);

    // Send periodic heartbeats
    const heartbeatInterval = setInterval(() => {
      client.sendHeartbeat('resource-456');
    }, 30000);

    // Acquire lock
    await client.acquireLock('resource-456', 300000); // 5 minutes

    // Publish an event
    await client.publishEvent('resource-456', 'update', {
      field: 'title',
      value: 'New Title',
    });

    // Wait for some time
    await new Promise((resolve) => setTimeout(resolve, 60000));

    // Release lock
    await client.releaseLock('resource-456');

    // Leave resource
    await client.leaveResource('resource-456');

    clearInterval(heartbeatInterval);
    client.disconnect();
  } catch (error) {
    console.error('Error:', error);
    client.disconnect();
  }
}

// Uncomment to run
// main();

export { CollaborNestClient };
