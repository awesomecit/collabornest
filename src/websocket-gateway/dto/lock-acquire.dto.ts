import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

/**
 * DTO for lock:acquire event
 *
 * Client sends this to request exclusive lock on a resource
 */
export class LockAcquireDto {
  @IsString()
  resourceId: string;

  @IsOptional()
  @IsNumber()
  @Min(5000)
  ttl?: number; // Optional TTL override (default: 300000ms = 5min)
}
