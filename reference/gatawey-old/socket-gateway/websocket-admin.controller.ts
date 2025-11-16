import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import {
  WebSocketMetricsDto,
  ActiveRoomsDto,
  ConnectedUsersDto,
  ActiveRoomInfoDto,
  ConnectedUserInfoDto,
  AdminOverviewDto,
  SocketsAggregationDto,
  RoomsAggregationDto,
  UsersAggregationDto,
  SocketConnectionDetailDto,
  RoomDetailDto,
  UserAggregationDetailDto,
} from './socket-gateway.dto';

/**
 * WebSocket Admin Controller
 * 
 * REST API endpoints for monitoring and managing WebSocket connections
 * 
 * Area 7.6: Admin/Monitoring APIs
 * 
 * Endpoints:
 * - GET /api/metrics/websocket - High-level metrics
 * - GET /api/admin/websocket/rooms - Active rooms with users and locks
 * - GET /api/admin/websocket/users - Connected users with their connections
 * 
 * Security:
 * - All endpoints require JWT authentication
 * - TODO: Add @RolesGuard(['admin']) when role-based auth is ready
 */
@Controller('admin-socket')
export class WebSocketAdminController {
  private readonly logger = new Logger(WebSocketAdminController.name);

  constructor(private readonly socketGateway: CollaborationSocketGateway) {}

  /**
   * Get WebSocket Metrics
   * 
   * GET /api/metrics/websocket
   * 
   * Returns high-level metrics about WebSocket gateway status:
   * - Total and active connections
   * - Connections by transport type
   * - Connections per user
   * - Memory usage
   * - Server uptime
   * 
   * @returns {WebSocketMetricsDto} WebSocket metrics
   */
  @Get('metrics')
  // @UseGuards(JwtAuthGuard) // TODO: Uncomment when JWT auth is configured
  async getMetrics(): Promise<WebSocketMetricsDto> {
    const server = this.socketGateway.server;
    
    // Check if server is initialized
    if (!server || !server.sockets) {
      return {
        totalConnections: 0,
        activeConnections: 0,
        connectionsByTransport: { websocket: 0, polling: 0 },
        connectionsByUser: {},
        maxConnectionsPerUser: 5,
        memoryUsage: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
        },
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      };
    }

    const sockets = await server.fetchSockets();

    // Count connections by transport
    const connectionsByTransport = {
      websocket: 0,
      polling: 0,
    };

    // Count connections by user
    const connectionsByUser: Record<string, number> = {};

    for (const socket of sockets) {
      // Transport count
      const transport = socket.conn.transport.name;
      if (transport === 'websocket') {
        connectionsByTransport.websocket++;
      } else if (transport === 'polling') {
        connectionsByTransport.polling++;
      }

      // User count
      const userId = (socket.data as any)?.user?.userId;
      if (userId) {
        connectionsByUser[userId] = (connectionsByUser[userId] || 0) + 1;
      }
    }

    // Memory usage
    const memUsage = process.memoryUsage();

    // Server uptime
    const uptime = process.uptime();

    const metricsResponse = {
      totalConnections: sockets.length, // Since server start (approximation)
      activeConnections: sockets.length,
      connectionsByTransport,
      connectionsByUser,
      maxConnectionsPerUser: 5, // From ConnectionPoolManager.MAX_CONNECTIONS_PER_USER
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
      },
      uptime: Math.floor(uptime),
      timestamp: new Date().toISOString(),
    };

    // Log metrics overview for admin monitoring
    this.logger.log(JSON.stringify({
      event: 'ADMIN_METRICS_REQUESTED',
      endpoint: 'GET /api/admin/websocket/metrics',
      metricsSnapshot: {
        activeConnections: metricsResponse.activeConnections,
        totalUsers: Object.keys(connectionsByUser).length,
        transportDistribution: connectionsByTransport,
        memoryUsageMB: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          percentageUsed: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },
        uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      },
      frontendParsing: {
        note: 'Frontend receives WebSocketMetricsDto from GET /api/admin/websocket/metrics',
        exampleAccess: 'response.connectionsByUser -> Record<userId, connectionCount>',
        topUsers: Object.entries(connectionsByUser)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([userId, count]) => ({ userId, connections: count })),
      },
    }));

    return metricsResponse;
  }

  /**
   * Get Active Rooms
   * 
   * GET /api/admin/websocket/rooms
   * 
   * Returns list of all active rooms with:
   * - Connected users per room
   * - Active locks per room
   * - Room metadata
   * 
   * @returns {ActiveRoomsDto} Active rooms data
   */
  @Get('rooms')
  // @UseGuards(JwtAuthGuard) // TODO: Uncomment when JWT auth is configured
  async getActiveRooms(): Promise<ActiveRoomsDto> {
    // Use the same reliable data source as getConnectedUsers (roomUsers internal Map)
    // This avoids issues with Socket.IO adapter.rooms not being populated
    const roomUsers = this.socketGateway.getRoomUsers();

    const rooms: ActiveRoomInfoDto[] = [];
    let totalUsers = 0;
    let totalLocks = 0;

    // Iterate through our internal roomUsers Map (format: roomId -> Map<socketId, RoomUserDto>)
    for (const [roomId, usersMap] of roomUsers.entries()) {
      // Parse room ID to extract resource info (format: "resourceType:resourceId")
      const [resourceType, resourceId] = roomId.split(':');
      if (!resourceType || !resourceId) {
        continue; // Skip invalid room formats
      }

      // Convert usersMap to array of connected users
      const connectedUsers = Array.from(usersMap.values()).map(user => ({
        userId: user.userId,
        username: user.username,
        socketId: user.socketId,
        connectedAt: new Date(user.joinedAt).toISOString(),
      }));

      // Get active locks in this room
      const activeSubResourceLocks = this.getLocksForRoom(roomId);

      rooms.push({
        roomId,
        resourceType,
        resourceId,
        connectedUsers,
        activeSubResourceLocks,
        userCount: connectedUsers.length,
        lockCount: activeSubResourceLocks.length,
      });

      totalUsers += connectedUsers.length;
      totalLocks += activeSubResourceLocks.length;
    }

    const roomsResponse = {
      rooms,
      totalRooms: rooms.length,
      totalUsers,
      totalLocks,
      timestamp: new Date().toISOString(),
    };

    // Log rooms overview for admin monitoring
    this.logger.log(JSON.stringify({
      event: 'ADMIN_ROOMS_REQUESTED',
      endpoint: 'GET /api/admin/websocket/rooms',
      roomsSnapshot: {
        totalRooms: rooms.length,
        totalUsers,
        totalLocks,
        roomsByResourceType: rooms.reduce((acc, r) => {
          acc[r.resourceType] = (acc[r.resourceType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        roomsWithUsers: rooms.filter(r => r.userCount > 0).length,
        roomsWithLocks: rooms.filter(r => r.lockCount > 0).length,
      },
      detailedRooms: rooms.map(r => ({
        roomId: r.roomId,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        userCount: r.userCount,
        lockCount: r.lockCount,
        users: r.connectedUsers.map(u => ({
          username: u.username,
          userId: u.userId,
          connectedAt: u.connectedAt,
        })),
        locks: r.activeSubResourceLocks.map(l => ({
          subResourceId: l.subResourceId,
          lockedBy: l.username || 'unknown',
          userId: l.lockedBy,
          lockedAt: l.lockedAt,
        })),
      })),
      frontendParsing: {
        note: 'Frontend receives ActiveRoomsDto from GET /api/admin/websocket/rooms',
        exampleAccess: 'response.rooms.forEach(room => console.log(room.connectedUsers))',
        exampleFilter: 'response.rooms.filter(r => r.resourceType === "surgery-management")',
      },
    }));

    return roomsResponse;
  }

  /**
   * Get Connected Users
   * 
   * GET /api/admin/websocket/users
   * 
   * Returns list of all connected users with:
   * - Socket connections per user
   * - Rooms each user is in
   * - Locks held by each user
   * 
   * @returns {ConnectedUsersDto} Connected users data
   */
  @Get('users')
  // @UseGuards(JwtAuthGuard) // TODO: Uncomment when JWT auth is configured
  async getConnectedUsers(): Promise<ConnectedUsersDto> {
    const server = this.socketGateway.server;
    
    // Check if server is initialized
    if (!server || !server.sockets) {
      return {
        users: [],
        totalUsers: 0,
        totalConnections: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const sockets = await server.fetchSockets();

    // Group sockets by user
    const userSocketsMap = new Map<string, any[]>();

    for (const socket of sockets) {
      const user = (socket.data as any)?.user;
      if (!user) continue;

      if (!userSocketsMap.has(user.userId)) {
        userSocketsMap.set(user.userId, []);
      }
      userSocketsMap.get(user.userId)!.push(socket);
    }

    // Build user info
    const users: ConnectedUserInfoDto[] = [];

    for (const [userId, userSockets] of userSocketsMap) {
      const firstSocket = userSockets[0];
      const user = (firstSocket.data as any)?.user;

      // Get sockets info
      const socketsInfo = userSockets.map((socket) => {
        const metadata = (socket.data as any)?.metadata;
        return {
          socketId: socket.id,
          connectedAt: metadata?.connectedAt
            ? new Date(metadata.connectedAt).toISOString()
            : new Date().toISOString(),
          transport: socket.conn.transport.name,
          ipAddress: metadata?.ipAddress || 'unknown',
          userAgent: metadata?.userAgent || 'unknown',
        };
      });

      // Get rooms (exclude private socket rooms)
      const rooms: string[] = [];
      for (const socket of userSockets) {
        for (const room of socket.rooms) {
          // Skip private socket room (room === socket.id)
          if (room !== socket.id && !rooms.includes(room)) {
            rooms.push(room);
          }
        }
      }

      // Get active locks for this user
      const activeLocks = this.getLocksForUser(userId);

      users.push({
        userId: user.userId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        sockets: socketsInfo,
        rooms,
        activeLocks,
        connectionCount: userSockets.length,
      });
    }

    const usersResponse = {
      users,
      totalUsers: users.length,
      totalConnections: sockets.length,
      timestamp: new Date().toISOString(),
    };

    // Log users overview for admin monitoring
    this.logger.log(JSON.stringify({
      event: 'ADMIN_USERS_REQUESTED',
      endpoint: 'GET /api/admin/websocket/users',
      usersSnapshot: {
        totalUsers: users.length,
        totalConnections: sockets.length,
        averageConnectionsPerUser: users.length > 0 ? (sockets.length / users.length).toFixed(2) : 0,
        usersWithMultipleConnections: users.filter(u => u.connectionCount > 1).length,
        usersWithActiveLocks: users.filter(u => u.activeLocks.length > 0).length,
      },
      detailedUsers: users.map(u => ({
        username: u.username,
        userId: u.userId,
        connectionCount: u.connectionCount,
        rooms: u.rooms,
        activeLocks: u.activeLocks.map(l => ({
          roomId: l.roomId,
          subResourceId: l.subResourceId,
          lockedAt: l.lockedAt,
        })),
        transports: u.sockets.map(s => s.transport),
      })),
      frontendParsing: {
        note: 'Frontend receives ConnectedUsersDto from GET /api/admin/websocket/users',
        exampleAccess: 'response.users.forEach(user => console.log(user.rooms, user.activeLocks))',
        exampleFilter: 'response.users.filter(u => u.connectionCount > 1)',
        topConnectedUsers: users
          .sort((a, b) => b.connectionCount - a.connectionCount)
          .slice(0, 5)
          .map(u => ({ username: u.username, connections: u.connectionCount })),
      },
    }));

    return usersResponse;
  }

  /**
   * Helper: Get locks for a specific room
   */
  private getLocksForRoom(roomId: string): Array<{
    subResourceId: string;
    lockedBy: string;
    username: string;
    lockedAt: string;
  }> {
    const lockManager = (this.socketGateway as any).lockManager;
    if (!lockManager) return [];

    const locks = [];
    const lockMap = (lockManager as any).locks || new Map();

    for (const [lockKey, lockInfo] of lockMap) {
      if (lockKey.startsWith(roomId + ':')) {
        const subResourceId = lockKey.split(':')[2];
        locks.push({
          subResourceId,
          lockedBy: lockInfo.userId,
          username: lockInfo.username || 'unknown',
          lockedAt: new Date(lockInfo.lockedAt).toISOString(),
        });
      }
    }

    return locks;
  }

  /**
   * Helper: Get locks held by a specific user
   */
  private getLocksForUser(userId: string): Array<{
    roomId: string;
    subResourceId: string;
    lockedAt: string;
  }> {
    const lockManager = (this.socketGateway as any).lockManager;
    if (!lockManager) return [];

    const locks = [];
    const lockMap = (lockManager as any).locks || new Map();

    for (const [lockKey, lockInfo] of lockMap) {
      if (lockInfo.userId === userId) {
        const [resourceType, resourceId, subResourceId] = lockKey.split(':');
        locks.push({
          roomId: `${resourceType}:${resourceId}`,
          subResourceId,
          lockedAt: new Date(lockInfo.lockedAt).toISOString(),
        });
      }
    }

    return locks;
  }

  // ============================================================================
  // ENHANCED ADMIN MONITORING ENDPOINTS (Detailed Aggregations)
  // ============================================================================

  /**
   * Get Admin Overview
   * 
   * GET /api/admin-socket/overview
   * 
   * Master endpoint with all aggregations:
   * - Summary statistics
   * - All socket connections (detailed)
   * - All rooms (detailed)
   * - All users (detailed)
   * 
   * @returns {AdminOverviewDto} Complete admin overview
   */
  @Get('overview')
  async getAdminOverview(): Promise<AdminOverviewDto> {
    const now = Date.now();
    const timestamp = new Date().toISOString();

    // Build all three aggregations
    const socketsAgg = await this.getSocketsAggregation();
    const roomsAgg = await this.getRoomsAggregation();
    const usersAgg = await this.getUsersAggregation();

    // Calculate summary stats
    const totalSockets = socketsAgg.sockets.length;
    const totalUsers = usersAgg.users.length;
    const totalRooms = roomsAgg.rooms.length;
    const totalLocks = roomsAgg.rooms.reduce((sum, room) => sum + room.lockCount, 0);
    const avgSocketsPerUser = totalUsers > 0 ? totalSockets / totalUsers : 0;
    const avgUsersPerRoom = totalRooms > 0 
      ? roomsAgg.rooms.reduce((sum, room) => sum + room.userCount, 0) / totalRooms 
      : 0;

    return {
      timestamp,
      summary: {
        totalSockets,
        totalUsers,
        totalRooms,
        totalLocks,
        avgSocketsPerUser: Math.round(avgSocketsPerUser * 100) / 100,
        avgUsersPerRoom: Math.round(avgUsersPerRoom * 100) / 100,
      },
      sockets: socketsAgg.sockets,
      rooms: roomsAgg.rooms,
      users: usersAgg.users,
    };
  }

  /**
   * Get Sockets Aggregation
   * 
   * GET /api/admin-socket/aggregations/sockets
   * 
   * Detailed list of all socket connections with:
   * - Connection duration
   * - Transport type
   * - Rooms joined
   * - Active locks
   * - Last activity
   * 
   * @returns {SocketsAggregationDto} Sockets aggregation
   */
  @Get('aggregations/sockets')
  async getSocketsAggregation(): Promise<SocketsAggregationDto> {
    const server = this.socketGateway.server;
    const now = Date.now();
    const timestamp = new Date().toISOString();

    if (!server || !server.sockets) {
      return {
        sockets: [],
        totalSockets: 0,
        timestamp,
      };
    }

    const sockets = await server.fetchSockets();
    const roomUsers = this.socketGateway.getRoomUsers();
    const socketDetails: SocketConnectionDetailDto[] = [];

    for (const socket of sockets) {
      const user = (socket.data as any)?.user;
      const metadata = (socket.data as any)?.metadata;
      
      if (!user || !metadata) continue;

      const connectedAt = new Date(metadata.connectedAt).toISOString();
      const durationMs = now - metadata.connectedAt;
      const duration = this.formatDuration(durationMs);

      // Get rooms for this socket
      const rooms: string[] = [];
      for (const room of socket.rooms) {
        if (room !== socket.id) { // Skip private socket room
          rooms.push(room);
        }
      }

      // Get active locks for this socket
      const activeLocks = this.getLocksForSocket(socket.id, now);

      // Get last activity and currentSubResource
      let lastActivity: string | undefined;
      let inactiveMs: number | undefined;
      let currentSubResource: string | null | undefined;
      for (const [roomId, usersMap] of roomUsers.entries()) {
        const roomUser = usersMap.get(socket.id);
        if (roomUser) {
          lastActivity = new Date(roomUser.lastActivity).toISOString();
          inactiveMs = now - roomUser.lastActivity;
          currentSubResource = roomUser.currentSubResource || null; // TAB CORRENTE
          break;
        }
      }

      socketDetails.push({
        socketId: socket.id,
        userId: user.userId,
        username: user.username,
        fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
        email: user.email,
        connectedAt,
        durationMs,
        duration,
        transport: socket.conn.transport.name,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        referer: socket.handshake.headers['referer'] || socket.handshake.headers['origin'],
        rooms,
        activeLocks,
        lastActivity,
        inactiveMs,
        currentSubResource, // TAB CORRENTE del socket
      });
    }

    return {
      sockets: socketDetails,
      totalSockets: socketDetails.length,
      timestamp,
    };
  }

  /**
   * Get Rooms Aggregation
   * 
   * GET /api/admin-socket/aggregations/rooms
   * 
   * Detailed list of all active rooms with:
   * - Room duration (since first user joined)
   * - Connected users with join timestamps
   * - Sub-resource locks with lock timestamps
   * 
   * @returns {RoomsAggregationDto} Rooms aggregation
   */
  @Get('aggregations/rooms')
  async getRoomsAggregation(): Promise<RoomsAggregationDto> {
    const roomUsers = this.socketGateway.getRoomUsers();
    const now = Date.now();
    const timestamp = new Date().toISOString();
    const rooms: RoomDetailDto[] = [];

    for (const [roomId, usersMap] of roomUsers.entries()) {
      const [resourceType, resourceUuid] = roomId.split(':');
      
      if (!resourceType || !resourceUuid) continue;

      // Find earliest join time (room creation)
      let earliestJoinTime = Infinity;
      for (const user of usersMap.values()) {
        if (user.joinedAt < earliestJoinTime) {
          earliestJoinTime = user.joinedAt;
        }
      }

      const createdAt = new Date(earliestJoinTime).toISOString();
      const durationMs = now - earliestJoinTime;
      const duration = this.formatDuration(durationMs);

      // Build users list with durations
      const users = Array.from(usersMap.values()).map(user => ({
        userId: user.userId,
        username: user.username,
        socketId: user.socketId,
        joinedAt: new Date(user.joinedAt).toISOString(),
        durationMs: now - user.joinedAt,
        duration: this.formatDuration(now - user.joinedAt),
        lastActivity: new Date(user.lastActivity).toISOString(),
        inactiveMs: now - user.lastActivity,
        currentSubResource: user.currentSubResource || null, // TAB CORRENTE
      }));

      // Get sub-resource locks for this room
      const subResources = this.getSubResourcesForRoom(roomId, now);

      rooms.push({
        roomId,
        resourceType,
        resourceUuid,
        createdAt,
        durationMs,
        duration,
        users,
        subResources,
        userCount: users.length,
        lockCount: subResources.length,
      });
    }

    return {
      rooms,
      totalRooms: rooms.length,
      timestamp,
    };
  }

  /**
   * Get Users Aggregation
   * 
   * GET /api/admin-socket/aggregations/users
   * 
   * Detailed list of all connected users with:
   * - All their socket connections
   * - All rooms they're in (across sockets)
   * - All locks they hold (across sockets)
   * - Total duration since first connection
   * 
   * @returns {UsersAggregationDto} Users aggregation
   */
  @Get('aggregations/users')
  async getUsersAggregation(): Promise<UsersAggregationDto> {
    const server = this.socketGateway.server;
    const now = Date.now();
    const timestamp = new Date().toISOString();

    if (!server || !server.sockets) {
      return {
        users: [],
        totalUsers: 0,
        timestamp,
      };
    }

    const sockets = await server.fetchSockets();
    const roomUsers = this.socketGateway.getRoomUsers();

    // Group sockets by user
    const userSocketsMap = new Map<string, any[]>();
    for (const socket of sockets) {
      const user = (socket.data as any)?.user;
      if (!user) continue;

      if (!userSocketsMap.has(user.userId)) {
        userSocketsMap.set(user.userId, []);
      }
      userSocketsMap.get(user.userId)!.push(socket);
    }

    // Build user aggregations
    const users: UserAggregationDetailDto[] = [];

    for (const [userId, userSockets] of userSocketsMap) {
      const firstSocket = userSockets[0];
      const user = (firstSocket.data as any)?.user;

      // Find earliest connection time
      let earliestConnectTime = Infinity;
      for (const socket of userSockets) {
        const metadata = (socket.data as any)?.metadata;
        if (metadata && metadata.connectedAt < earliestConnectTime) {
          earliestConnectTime = metadata.connectedAt;
        }
      }

      const firstConnectedAt = new Date(earliestConnectTime).toISOString();
      const totalDurationMs = now - earliestConnectTime;
      const totalDuration = this.formatDuration(totalDurationMs);

      // Build connections list
      const connections = userSockets.map(socket => {
        const metadata = (socket.data as any)?.metadata;
        return {
          socketId: socket.id,
          connectedAt: new Date(metadata.connectedAt).toISOString(),
          durationMs: now - metadata.connectedAt,
          duration: this.formatDuration(now - metadata.connectedAt),
          transport: socket.conn.transport.name,
          ipAddress: metadata.ipAddress,
          referer: socket.handshake.headers['referer'] || socket.handshake.headers['origin'],
        };
      });

      // Build rooms list (across all sockets)
      const roomsMap = new Map<string, { joinedAt: number; socketIds: Set<string> }>();
      for (const socket of userSockets) {
        for (const room of socket.rooms) {
          if (room === socket.id) continue; // Skip private room

          if (!roomsMap.has(room)) {
            // Find join time from roomUsers
            const usersInRoom = roomUsers.get(room);
            const roomUser = usersInRoom?.get(socket.id);
            roomsMap.set(room, {
              joinedAt: roomUser?.joinedAt || now,
              socketIds: new Set(),
            });
          }
          roomsMap.get(room)!.socketIds.add(socket.id);
        }
      }

      const rooms = Array.from(roomsMap.entries()).map(([roomId, data]) => {
        const [resourceType, resourceUuid] = roomId.split(':');
        return {
          roomId,
          resourceType: resourceType || 'unknown',
          resourceUuid: resourceUuid || 'unknown',
          joinedAt: new Date(data.joinedAt).toISOString(),
          durationMs: now - data.joinedAt,
          duration: this.formatDuration(now - data.joinedAt),
          socketIds: Array.from(data.socketIds),
        };
      });

      // Get all locks for this user
      const locks = this.getLocksForUser(userId).map(lock => ({
        ...lock,
        durationMs: now - new Date(lock.lockedAt).getTime(),
        duration: this.formatDuration(now - new Date(lock.lockedAt).getTime()),
        socketId: 'unknown', // TODO: Track socket ID in lock manager
      }));

      users.push({
        userId: user.userId,
        username: user.username,
        fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
        email: user.email,
        firstConnectedAt,
        totalDurationMs,
        totalDuration,
        connections,
        connectionCount: connections.length,
        rooms,
        roomCount: rooms.length,
        locks,
        lockCount: locks.length,
      });
    }

    return {
      users,
      totalUsers: users.length,
      timestamp,
    };
  }

  // ============================================================================
  // Helper Methods for Enhanced Aggregations
  // ============================================================================

  /**
   * Format duration in human-readable format
   * 
   * Examples:
   * - 45000ms → "45s"
   * - 135000ms → "2m 15s"
   * - 7200000ms → "2h"
   * - 90000000ms → "1d 1h"
   * 
   * @param ms - Duration in milliseconds
   * @returns Human-readable duration string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      const remainingHours = hours % 24;
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
    if (hours > 0) {
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }
    return `${seconds}s`;
  }

  /**
   * Get locks for a specific socket
   */
  private getLocksForSocket(socketId: string, now: number): Array<{
    roomId: string;
    subResourceId: string;
    lockedAt: string;
    durationMs: number;
  }> {
    const lockManager = (this.socketGateway as any).lockManager;
    if (!lockManager) return [];

    const locks = [];
    const lockMap = (lockManager as any).locks || new Map();

    for (const [lockKey, lockInfo] of lockMap) {
      if (lockInfo.socketId === socketId) {
        const [resourceType, resourceId, subResourceId] = lockKey.split(':');
        const lockedAt = new Date(lockInfo.lockedAt).toISOString();
        const durationMs = now - lockInfo.lockedAt;
        
        locks.push({
          roomId: `${resourceType}:${resourceId}`,
          subResourceId,
          lockedAt,
          durationMs,
        });
      }
    }

    return locks;
  }

  /**
   * Get sub-resources with locks for a specific room
   */
  private getSubResourcesForRoom(roomId: string, now: number): Array<{
    subResourceId: string;
    lockedBy: {
      userId: string;
      username: string;
      socketId: string;
    };
    lockedAt: string;
    durationMs: number;
    duration: string;
  }> {
    const lockManager = (this.socketGateway as any).lockManager;
    if (!lockManager) return [];

    const subResources = [];
    const lockMap = (lockManager as any).locks || new Map();

    for (const [lockKey, lockInfo] of lockMap) {
      if (lockKey.startsWith(roomId + ':')) {
        const subResourceId = lockKey.split(':')[2];
        const lockedAt = new Date(lockInfo.lockedAt).toISOString();
        const durationMs = now - lockInfo.lockedAt;
        
        subResources.push({
          subResourceId,
          lockedBy: {
            userId: lockInfo.userId,
            username: lockInfo.username || 'unknown',
            socketId: lockInfo.socketId,
          },
          lockedAt,
          durationMs,
          duration: this.formatDuration(durationMs),
        });
      }
    }

    return subResources;
  }
}
