/**
 * @collab/core - Core socket logic for CollaborNest
 * 
 * Exports main gateway, interfaces, and utilities
 */

// Interfaces
export * from './interfaces/resource-adapter.interface';
export * from './interfaces/socket-events.interface';
export * from './interfaces/config.interface';

// Gateway
export * from './collab.gateway';

// Services
export * from './services/room.service';
export * from './services/event-handler.service';

// DTOs
export * from './dto/join.dto';
export * from './dto/leave.dto';
export * from './dto/lock.dto';
export * from './dto/update.dto';
