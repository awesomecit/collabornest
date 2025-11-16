/**
 * WebSocket Gateway Constants - Barrel Export
 *
 * Single Source of Truth for all WebSocket events, error codes, and messages.
 *
 * Usage:
 * ```typescript
 * import { WsEvent, WsErrorCode, WsErrorMessage } from './constants';
 * ```
 */
export {
  WsErrorCode,
  WsErrorMessage,
  WsErrorResponse,
} from './ws-error-codes.enum';
export { WsEvent } from './ws-events.enum';
