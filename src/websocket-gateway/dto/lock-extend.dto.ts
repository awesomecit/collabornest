import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

/**
 * DTO for lock:extend event (heartbeat)
 *
 * Client sends this to renew lock TTL (keep-alive)
 */
export class LockExtendDto {
  @IsString()
  resourceId: string;

  @IsString()
  lockId: string; // Lock identifier from lock:acquired response

  @IsOptional()
  @IsNumber()
  @Min(5000)
  ttl?: number; // Optional TTL override (default: 300000ms = 5min)
}
