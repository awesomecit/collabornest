/**
 * Task 8.3: Error Boundaries & Centralized Error Handling
 * 
 * Tests for SocketException, handleSocketError(), and graceful error handling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationSocketGateway } from './socket-gateway.gateway';
import { SocketGatewayConfigService } from './socket-gateway-config.service';
import { SurgeryManagementService } from '../surgery-management/surgery-management.service';
import { SocketErrorCategory } from './socket-gateway.dto';
import { SocketException, createMockClient } from './socket-gateway.types';
import { createMockConfigService as createMockConfigServiceUtils } from './socket-gateway.test-utils';
import { createMockConfigService, createMockSurgeryService } from './test-mocks';
import { Socket } from 'socket.io';

describe('CollaborationSocketGateway - Task 8.3: Error Handling', () => {
  let gateway: CollaborationSocketGateway;
  let mockConfigService: jest.Mocked<SocketGatewayConfigService>;

  beforeEach(async () => {
    mockConfigService = createMockConfigService() as jest.Mocked<SocketGatewayConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationSocketGateway,
        {
          provide: SocketGatewayConfigService,
          useValue: mockConfigService,
        },
        {
          provide: SurgeryManagementService,
          useValue: createMockSurgeryService(),
        },
      ],
    }).compile();

    gateway = module.get<CollaborationSocketGateway>(CollaborationSocketGateway);
  });

  describe('SocketException Class', () => {
    it('should create SocketException with all properties', () => {
      const exception = new SocketException(
        SocketErrorCategory.VALIDATION,
        'TEST_ERROR',
        'Test error message',
        { field: 'testField' },
      );

      expect(exception.name).toBe('SocketException');
      expect(exception.category).toBe(SocketErrorCategory.VALIDATION);
      expect(exception.errorCode).toBe('TEST_ERROR');
      expect(exception.message).toBe('Test error message');
      expect(exception.details).toEqual({ field: 'testField' });
      expect(exception.isOperational).toBe(true);
      expect(exception.statusCode).toBe(400); // VALIDATION = 400
    });

    it('should map VALIDATION category to status code 400', () => {
      const exception = new SocketException(
        SocketErrorCategory.VALIDATION,
        'INVALID_INPUT',
        'Invalid input',
      );
      expect(exception.statusCode).toBe(400);
    });

    it('should map AUTHORIZATION category to status code 403', () => {
      const exception = new SocketException(
        SocketErrorCategory.AUTHORIZATION,
        'PERMISSION_DENIED',
        'Permission denied',
      );
      expect(exception.statusCode).toBe(403);
    });

    it('should map NOT_FOUND category to status code 404', () => {
      const exception = new SocketException(
        SocketErrorCategory.NOT_FOUND,
        'RESOURCE_NOT_FOUND',
        'Resource not found',
      );
      expect(exception.statusCode).toBe(404);
    });

    it('should map CONFLICT category to status code 409', () => {
      const exception = new SocketException(
        SocketErrorCategory.CONFLICT,
        'STATE_CONFLICT',
        'State conflict',
      );
      expect(exception.statusCode).toBe(409);
    });

    it('should map INTERNAL category to status code 500', () => {
      const exception = new SocketException(
        SocketErrorCategory.INTERNAL,
        'INTERNAL_ERROR',
        'Internal error',
      );
      expect(exception.statusCode).toBe(500);
    });

    it('should convert SocketException to SocketErrorDto', () => {
      const exception = new SocketException(
        SocketErrorCategory.VALIDATION,
        'INVALID_ROOM_ID',
        'Room ID is required',
        { providedRoomId: null },
      );

      const dto = exception.toSocketErrorDto(
        'socket-123',
        'user456',
        'room:join',
      );

      expect(dto).toMatchObject({
        category: SocketErrorCategory.VALIDATION,
        errorCode: 'INVALID_ROOM_ID',
        message: 'Room ID is required',
        details: { providedRoomId: null },
        socketId: 'socket-123',
        userId: 'user456',
        eventName: 'room:join',
      });
    });
  });

  describe('handleSocketError() - SocketException (Operational Errors)', () => {
    it('should emit socket:error event with structured SocketErrorDto', () => {
      const mockClient = createMockClient('socket-123');
      const mockEmit = jest.fn();
      mockClient.emit = mockEmit;

      // Initialize client data (authenticated user)
      mockClient.data = {
        user: {
          userId: 'user456',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          roles: ['user'],
        },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          connectedAt: Date.now(),
        },
      };

      const exception = new SocketException(
        SocketErrorCategory.VALIDATION,
        'INVALID_INPUT',
        'Test validation error',
        { field: 'roomId' },
      );

      // Call private handleSocketError method
      (gateway as any).handleSocketError(exception, mockClient, 'room:join');

      // Verify socket:error event was emitted
      expect(mockEmit).toHaveBeenCalledWith(
        'socket:error',
        expect.objectContaining({
          category: SocketErrorCategory.VALIDATION,
          errorCode: 'INVALID_INPUT',
          message: 'Test validation error',
          details: { field: 'roomId' },
          socketId: 'socket-123',
          userId: 'user456',
          eventName: 'room:join',
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should not disconnect client on SocketException', () => {
      const mockClient = createMockClient('socket-123');
      const mockDisconnect = jest.fn();
      mockClient.disconnect = mockDisconnect;
      mockClient.data = {
        user: {
          userId: 'user456',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          roles: ['user'],
        },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          connectedAt: Date.now(),
        },
      };

      const exception = new SocketException(
        SocketErrorCategory.VALIDATION,
        'INVALID_INPUT',
        'Test validation error',
      );

      (gateway as any).handleSocketError(exception, mockClient, 'room:join');

      // Verify client was NOT disconnected (graceful degradation)
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it('should log SocketException as WARN with full context', () => {
      const mockClient = createMockClient('socket-123');
      mockClient.data = {
        user: {
          userId: 'user456',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          roles: ['user'],
        },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          connectedAt: Date.now(),
        },
      };

      const loggerWarnSpy = jest.spyOn((gateway as any).logger, 'warn');

      const exception = new SocketException(
        SocketErrorCategory.AUTHORIZATION,
        'PERMISSION_DENIED',
        'User lacks permission',
        { requiredRole: 'admin' },
      );

      (gateway as any).handleSocketError(exception, mockClient, 'room:join');

      // Verify logger.warn was called with context
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'SOCKET_ERROR',
          category: SocketErrorCategory.AUTHORIZATION,
          errorCode: 'PERMISSION_DENIED',
          message: 'User lacks permission',
          details: { requiredRole: 'admin' },
          socketId: 'socket-123',
          userId: 'user456',
          username: 'testuser',
          eventName: 'room:join',
          statusCode: 403,
          isOperational: true,
        }),
      );
    });

    it('should handle SocketException without userId (unauthenticated)', () => {
      const mockClient = createMockClient('socket-123');
      mockClient.data = {}; // No user data
      const mockEmit = jest.fn();
      mockClient.emit = mockEmit;

      const exception = new SocketException(
        SocketErrorCategory.AUTHORIZATION,
        'UNAUTHENTICATED',
        'User not authenticated',
      );

      (gateway as any).handleSocketError(exception, mockClient, 'room:join');

      // Verify userId is undefined in emitted event
      expect(mockEmit).toHaveBeenCalledWith(
        'socket:error',
        expect.objectContaining({
          userId: undefined,
          socketId: 'socket-123',
          eventName: 'room:join',
        }),
      );
    });
  });

  describe('handleSocketError() - Unexpected Errors', () => {
    it('should emit socket:error with INTERNAL category for unexpected errors', () => {
      const mockClient = createMockClient('socket-123');
      const mockEmit = jest.fn();
      mockClient.emit = mockEmit;
      mockClient.data = {
        user: {
          userId: 'user456',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          roles: ['user'],
        },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          connectedAt: Date.now(),
        },
      };

      const unexpectedError = new Error('Database connection failed');

      (gateway as any).handleSocketError(unexpectedError, mockClient, 'room:join');

      // Verify generic INTERNAL error was emitted
      expect(mockEmit).toHaveBeenCalledWith(
        'socket:error',
        expect.objectContaining({
          category: SocketErrorCategory.INTERNAL,
          errorCode: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
          socketId: 'socket-123',
          userId: 'user456',
          eventName: 'room:join',
        }),
      );
    });

    it('should log unexpected errors as ERROR with stack trace', () => {
      const mockClient = createMockClient('socket-123');
      mockClient.data = {
        user: {
          userId: 'user456',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          roles: ['user'],
        },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          connectedAt: Date.now(),
        },
      };

      const loggerErrorSpy = jest.spyOn((gateway as any).logger, 'error');

      const unexpectedError = new Error('Unexpected database error');

      (gateway as any).handleSocketError(unexpectedError, mockClient, 'room:join');

      // Verify logger.error was called with stack trace
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'SOCKET_ERROR_UNEXPECTED',
          category: 'INTERNAL',
          errorCode: 'INTERNAL_ERROR',
          message: 'Unexpected database error',
          stack: expect.any(String),
          socketId: 'socket-123',
          userId: 'user456',
          username: 'testuser',
          eventName: 'room:join',
        }),
      );
    });

    it('should not disconnect client on unexpected errors', () => {
      const mockClient = createMockClient('socket-123');
      const mockDisconnect = jest.fn();
      mockClient.disconnect = mockDisconnect;
      mockClient.data = {
        user: {
          userId: 'user456',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          roles: ['user'],
        },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          connectedAt: Date.now(),
        },
      };

      const unexpectedError = new Error('Something went wrong');

      (gateway as any).handleSocketError(unexpectedError, mockClient, 'room:join');

      // Verify client was NOT disconnected (graceful degradation)
      expect(mockDisconnect).not.toHaveBeenCalled();
    });
  });

  describe('Message Handlers with Error Handling', () => {
    it('should throw SocketException for invalid roomId in handleJoinRoom', async () => {
      const mockClient = createMockClient('socket-123');
      const mockEmit = jest.fn();
      mockClient.emit = mockEmit;
      mockClient.data = {
        user: {
          userId: 'user456',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          roles: ['user'],
        },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          connectedAt: Date.now(),
        },
      };

      // Call handleJoinRoom with invalid data
      await gateway.handleJoinRoom(
        { roomId: '' }, // Empty roomId should trigger validation error
        mockClient as Socket,
      );

      // Verify socket:error was emitted
      expect(mockEmit).toHaveBeenCalledWith(
        'socket:error',
        expect.objectContaining({
          category: SocketErrorCategory.VALIDATION,
          errorCode: 'INVALID_ROOM_ID',
          message: expect.stringContaining('Room ID'),
        }),
      );

      // Verify client NOT disconnected
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('should throw SocketException for unauthenticated user in handleJoinRoom', async () => {
      const mockClient = createMockClient('socket-123');
      const mockEmit = jest.fn();
      mockClient.emit = mockEmit;
      mockClient.data = {}; // No user data (unauthenticated)

      await gateway.handleJoinRoom(
        { roomId: 'test-room' },
        mockClient as Socket,
      );

      // Verify socket:error was emitted
      expect(mockEmit).toHaveBeenCalledWith(
        'socket:error',
        expect.objectContaining({
          category: SocketErrorCategory.AUTHORIZATION,
          errorCode: 'UNAUTHENTICATED',
          message: expect.stringContaining('authenticated'),
        }),
      );
    });
  });
});
