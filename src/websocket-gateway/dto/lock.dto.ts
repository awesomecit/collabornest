/**
 * Lock DTOs - Barrel export
 *
 * Aggregates all lock-related DTOs for distributed resource locking.
 * Used by WebSocketGateway for validating lock:* event payloads.
 */

export { LockAcquireDto } from './lock-acquire.dto';
export { LockReleaseDto } from './lock-release.dto';
export { LockExtendDto } from './lock-extend.dto';
