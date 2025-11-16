/**
 * Configuration interface for CollaborNest
 */

export interface CollabConfig {
  limits?: {
    resource?: {
      maxEditors?: number;
      maxViewers?: number;
    };
    subresource?: {
      default?: {
        maxEditors?: number;
        maxViewers?: number;
      };
      overrides?: Record<
        string,
        {
          maxEditors?: number;
          maxViewers?: number;
        }
      >;
    };
  };

  lock?: {
    defaultTTLms?: number;
    autoUnlockOnDisconnect?: boolean;
    maxLockDuration?: number;
  };

  presence?: {
    heartbeatIntervalMs?: number;
    staleThresholdMs?: number;
    cleanupIntervalMs?: number;
  };

  socket?: {
    namespace?: string;
    transports?: ('websocket' | 'polling')[];
    pingTimeout?: number;
    pingInterval?: number;
  };

  redis?: {
    host?: string;
    port?: number;
    db?: number;
    keyPrefix?: string;
    password?: string;
  };

  rabbitmq?: {
    url?: string;
    exchange?: string;
    queuePrefix?: string;
  };
}
