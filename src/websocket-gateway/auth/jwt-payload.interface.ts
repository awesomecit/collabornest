/**
 * JWT Payload Interface
 *
 * Defines the structure of JWT token claims used in WebSocket authentication.
 * Follows Keycloak token format but remains generic for other providers.
 *
 * SSOT for JWT claim structure across the application.
 */

/**
 * JWT Token Payload (Standard + Custom Claims)
 */
export interface JwtPayload {
  /** Subject (user ID) - standard claim */
  sub: string;

  /** Username */
  preferred_username?: string;

  /** User's given name */
  given_name?: string;

  /** User's family name */
  family_name?: string;

  /** User's email address */
  email?: string;

  /** Email verification status */
  email_verified?: boolean;

  /** Issued at (Unix timestamp) - standard claim */
  iat?: number;

  /** Expiration time (Unix timestamp) - standard claim */
  exp: number;

  /** Issuer (authentication provider) - standard claim */
  iss?: string;

  /** Audience (intended recipient) - standard claim */
  aud?: string | string[];

  /** Realm access roles (Keycloak-specific) */
  realm_access?: {
    roles: string[];
  };

  /** Client access roles (Keycloak-specific) */
  resource_access?: Record<
    string,
    {
      roles: string[];
    }
  >;

  /** Session ID (Keycloak-specific) */
  session_state?: string;

  /** Scope of access (OAuth2) */
  scope?: string;
}

/**
 * Validated User from JWT
 *
 * Extracted and validated user information after JWT verification.
 * Used in WebSocket connection context.
 */
export interface ValidatedUser {
  /** User ID (from 'sub' claim) */
  userId: string;

  /** Username (from 'preferred_username' claim) */
  username: string;

  /** User's email */
  email?: string;

  /** User's full name (constructed from given_name + family_name) */
  fullName?: string;

  /** User roles (extracted from realm_access.roles) */
  roles: string[];

  /** Original JWT payload for additional context */
  payload: JwtPayload;
}
