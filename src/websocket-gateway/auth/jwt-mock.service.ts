/**
 * JWT Validation Service
 *
 * Provides JWT token validation for WebSocket authentication.
 * Uses @nestjs/jwt for proper token validation.
 *
 * DEVELOPMENT MODE:
 * - Uses HS256 (symmetric) with JWT_SECRET for development/testing
 * - Validates expiration, issuer, and audience claims
 *
 * PRODUCTION TODO (Future - when Keycloak is integrated):
 * - Replace HS256 with RS256 (asymmetric)
 * - Use Keycloak public key from JWKS endpoint
 * - Add proper signature verification with public key
 *
 * @see EPIC-001-websocket-gateway.md BE-001.1
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGatewayConfigService } from '../config/gateway-config.service';
import { JwtPayload, ValidatedUser } from './jwt-payload.interface';

@Injectable()
export class JwtMockService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: WebSocketGatewayConfigService,
  ) {}

  /**
   * Validate JWT token using @nestjs/jwt
   *
   * @param token - JWT token string
   * @returns Validated user information
   * @throws UnauthorizedException if token is invalid or expired
   */
  async validateToken(token: string): Promise<ValidatedUser> {
    if (!token) {
      throw new UnauthorizedException('JWT token is required');
    }

    try {
      // Verify and decode token using @nestjs/jwt
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getJwtSecret(),
        // Issuer validation (if configured)
        issuer: this.shouldValidateIssuer()
          ? this.configService.getJwtIssuer()
          : undefined,
        // Audience validation (if configured)
        audience: this.shouldValidateAudience()
          ? this.configService.getJwtAudience()
          : undefined,
      });

      // Validate required claims
      this.validateRequiredClaims(payload);

      // Extract user information
      return this.extractUserInfo(payload);
    } catch (error) {
      // JwtService throws descriptive errors
      throw new UnauthorizedException(
        `JWT validation failed: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Check if issuer validation should be enforced
   * Skip for default development value
   */
  private shouldValidateIssuer(): boolean {
    const issuer = this.configService.getJwtIssuer();
    return issuer !== 'collabornest'; // Default dev value
  }

  /**
   * Check if audience validation should be enforced
   * Skip for default development value
   */
  private shouldValidateAudience(): boolean {
    const audience = this.configService.getJwtAudience();
    return audience !== 'collabornest-api'; // Default dev value
  }

  /**
   * Validate required JWT claims
   *
   * @param payload - Decoded JWT payload
   * @throws UnauthorizedException if required claims are missing
   */
  private validateRequiredClaims(payload: JwtPayload): void {
    if (!payload.sub) {
      throw new UnauthorizedException('JWT missing required "sub" claim');
    }

    if (!payload.exp) {
      throw new UnauthorizedException('JWT missing required "exp" claim');
    }
  }

  /**
   * Extract user information from JWT payload
   *
   * @param payload - JWT payload
   * @returns Validated user object
   */
  private extractUserInfo(payload: JwtPayload): ValidatedUser {
    const userId = payload.sub;
    const username =
      payload.preferred_username || payload.email || `user_${userId}`;
    const email = payload.email;

    // Construct full name if available
    let fullName: string | undefined;
    if (payload.given_name && payload.family_name) {
      fullName = `${payload.given_name} ${payload.family_name}`;
    } else if (payload.given_name) {
      fullName = payload.given_name;
    }

    // Extract roles (Keycloak format)
    const roles = payload.realm_access?.roles || [];

    return {
      userId,
      username,
      email,
      fullName,
      roles,
      payload,
    };
  }

  /**
   * Check if user has a specific role
   *
   * @param user - Validated user
   * @param role - Role name to check
   * @returns true if user has the role
   */
  hasRole(user: ValidatedUser, role: string): boolean {
    return user.roles.includes(role);
  }

  /**
   * Check if user has any of the specified roles
   *
   * @param user - Validated user
   * @param roles - Array of role names
   * @returns true if user has at least one of the roles
   */
  hasAnyRole(user: ValidatedUser, roles: string[]): boolean {
    return roles.some(role => user.roles.includes(role));
  }

  /**
   * Check if user has all of the specified roles
   *
   * @param user - Validated user
   * @param roles - Array of role names
   * @returns true if user has all the roles
   */
  hasAllRoles(user: ValidatedUser, roles: string[]): boolean {
    return roles.every(role => user.roles.includes(role));
  }
}
