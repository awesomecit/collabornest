import { IsString } from 'class-validator';

/**
 * DTO for lock:release event
 *
 * Client sends this to release lock on a resource
 */
export class LockReleaseDto {
  @IsString()
  resourceId: string;
}
