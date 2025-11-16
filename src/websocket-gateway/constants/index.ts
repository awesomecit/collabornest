/**
 * WebSocket Gateway Constants - Barrel Export
 *
 * Single Source of Truth for all WebSocket events, error codes, and configuration keys.
 *
 * Usage:
 * ```typescript
 * import { WsEvent, WsErrorCode, WebSocketConfigKey, JwtConfigKey } from './constants';
 * ```
 */
export {
  WsErrorCode,
  WsErrorMessage,
  WsErrorResponse,
} from './ws-error-codes.enum';
export { WsEvent } from './ws-events.enum';
export { WebSocketConfigKey, JwtConfigKey } from './config-keys.enum';
