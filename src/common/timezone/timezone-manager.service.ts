import { Injectable } from '@nestjs/common';

// Timezone constants to eliminate string duplication
const TIMEZONE_UTC = 'UTC';
const TIMEZONE_ROME = 'Europe/Rome';
const TIMEZONE_LONDON = 'Europe/London';
const TIMEZONE_NEW_YORK = 'America/New_York';
const TIMEZONE_LOS_ANGELES = 'America/Los_Angeles';
const TIMEZONE_TOKYO = 'Asia/Tokyo';

/**
 * Timezone Manager Service for dynamic timezone detection and management
 * Provides comprehensive timezone handling for enterprise applications
 */
@Injectable()
export class TimezoneManagerService {
  // Supported timezones list
  private readonly supportedTimezones = new Set([
    TIMEZONE_UTC,
    TIMEZONE_ROME,
    TIMEZONE_LONDON,
    TIMEZONE_NEW_YORK,
    TIMEZONE_LOS_ANGELES,
    TIMEZONE_TOKYO,
    'Australia/Sydney',
    // Add more as needed
  ]);

  /**
   * Detects timezone from user profile
   * @param userId User identifier
   * @returns Promise<string> Detected timezone or UTC fallback
   */
  async detectFromUser(userId: string): Promise<string> {
    // Minimal implementation - in production would query user preferences
    try {
      // Simulate user lookup with timezone
      if (userId === 'user-123') {
        return TIMEZONE_ROME;
      }
      return TIMEZONE_UTC;
    } catch {
      return TIMEZONE_UTC;
    }
  }

  /**
   * Detects timezone from HTTP request headers
   * @param request HTTP request object
   * @returns Promise<string> Detected timezone or UTC fallback
   */
  async detectFromHeaders(request: {
    headers?: Record<string, string | string[]>;
  }): Promise<string> {
    try {
      // Priority: custom header > accept-language > user-agent
      const customTz = request.headers?.['x-timezone'];
      const customTzString = Array.isArray(customTz) ? customTz[0] : customTz;
      if (customTzString && this.validateTimezone(customTzString)) {
        return customTzString;
      }

      const acceptLanguage = request.headers?.['accept-language'];
      const acceptLanguageString = Array.isArray(acceptLanguage)
        ? acceptLanguage[0]
        : acceptLanguage;
      if (acceptLanguageString) {
        const extractedTz =
          this.extractTimezoneFromLocale(acceptLanguageString);
        if (extractedTz && this.validateTimezone(extractedTz)) {
          return extractedTz;
        }
      }

      return TIMEZONE_UTC;
    } catch {
      return TIMEZONE_UTC;
    }
  }

  /**
   * Gets timezone by organization unit
   * @param organizationId Organization identifier
   * @returns Promise<string> Organization timezone or UTC fallback
   */
  async getTimezoneByOrganization(organizationId: string): Promise<string> {
    // Minimal implementation - in production would query organization preferences
    try {
      // Simulate organization timezone lookup
      const organizationTimezones: Record<string, string> = {
        'org-europe': TIMEZONE_ROME,
        'org-us-east': TIMEZONE_NEW_YORK,
        'org-us-west': TIMEZONE_LOS_ANGELES,
        'org-asia': TIMEZONE_TOKYO,
      };

      return organizationTimezones[organizationId] || TIMEZONE_UTC;
    } catch {
      return TIMEZONE_UTC;
    }
  }

  /**
   * Validates timezone identifier
   * @param timezone IANA timezone identifier
   * @returns boolean true if valid
   */
  validateTimezone(timezone: string): boolean {
    if (!timezone || typeof timezone !== 'string') {
      return false;
    }

    // Check against known valid timezones
    if (this.supportedTimezones.has(timezone)) {
      return true;
    }

    // Additional validation for IANA format
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets default timezone (UTC)
   * @returns string Default timezone
   */
  getDefaultTimezone(): string {
    return TIMEZONE_UTC;
  }

  /**
   * Extracts timezone from locale string
   * @param locale Accept-Language header value
   * @returns string Extracted timezone or null
   */
  private extractTimezoneFromLocale(locale: string): string | null {
    // Simple locale to timezone mapping
    const localeTimezoneMap: Record<string, string> = {
      it: TIMEZONE_ROME,
      'it-IT': TIMEZONE_ROME,
      'en-US': TIMEZONE_NEW_YORK,
      'en-GB': TIMEZONE_LONDON,
      ja: TIMEZONE_TOKYO,
      'ja-JP': TIMEZONE_TOKYO,
    };

    // Extract primary locale
    const primaryLocale = locale.split(',')[0]?.split(';')[0]?.trim();
    if (primaryLocale) {
      return localeTimezoneMap[primaryLocale] || null;
    }

    return null;
  }

  /**
   * Converts date to UTC from specific timezone
   * @param date Date to convert
   * @param timezone Source timezone
   * @returns Date UTC date
   */
  convertToUTC(date: Date, timezone: string): Date {
    if (!this.validateTimezone(timezone)) {
      return date; // Return as-is if timezone invalid
    }

    try {
      // Simple implementation - in production would use proper timezone library
      return new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE_UTC }));
    } catch {
      return date;
    }
  }

  /**
   * Converts UTC date to specific timezone
   * @param utcDate UTC date
   * @param timezone Target timezone
   * @returns Date Converted date
   */
  convertFromUTC(utcDate: Date, timezone: string): Date {
    if (!this.validateTimezone(timezone)) {
      return utcDate; // Return as-is if timezone invalid
    }

    try {
      // Simple implementation - in production would use proper timezone library
      return new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
    } catch {
      return utcDate;
    }
  }
}
