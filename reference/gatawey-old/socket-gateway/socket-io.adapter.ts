import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplicationContext } from '@nestjs/common';

/**
 * Custom Socket.IO Adapter
 * 
 * Extends the default IoAdapter to ensure proper initialization
 * with custom server configuration.
 */
export class SocketIOAdapter extends IoAdapter {
  constructor(app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    
    console.log('[SocketIOAdapter] Socket.IO server created');
    console.log('[SocketIOAdapter] Path:', options?.path || '/socket.io');
    console.log('[SocketIOAdapter] CORS:', options?.cors);
    
    return server;
  }
}
