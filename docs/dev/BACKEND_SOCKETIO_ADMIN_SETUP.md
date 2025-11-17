# Socket.IO Admin UI - Backend Setup Guide

## Overview

Socket.IO Admin UI fornisce un pannello di monitoraggio real-time per:

- Connessioni attive
- Eventi emessi/ricevuti
- Namespace e rooms
- Performance metrics

## Installation

```bash
npm install @socket.io/admin-ui
```

## NestJS Integration

### 1. Configure WebSocket Gateway

```typescript
// websocket-gateway/websocket.gateway.ts
import { instrument } from '@socket.io/admin-ui';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'https://admin.socket.io'],
    credentials: true,
  },
})
export class WebsocketGateway implements OnGatewayInit {
  afterInit(server: Server) {
    // Enable Admin UI with authentication
    instrument(server, {
      auth: {
        type: 'basic',
        username: process.env.SOCKETIO_ADMIN_USER || 'admin',
        password: process.env.SOCKETIO_ADMIN_PASSWORD || 'changeme',
      },
      mode:
        process.env.NODE_ENV === 'production' ? 'production' : 'development',
      readonly: process.env.NODE_ENV === 'production', // Read-only in production
    });
  }
}
```

### 2. Environment Variables

```bash
# .env
SOCKETIO_ADMIN_USER=admin
SOCKETIO_ADMIN_PASSWORD=your-secure-password
```

### 3. Security Considerations

**CRITICAL**:

- Use strong credentials in production
- Enable `readonly: true` in production (prevents disconnecting clients from UI)
- Restrict CORS origins to trusted domains only
- Consider IP whitelisting for admin access
- Use HTTPS in production

### 4. Optional: Custom Namespace Monitoring

```typescript
@WebSocketGateway({ namespace: '/surgical-operations' })
export class OperationGateway implements OnGatewayInit {
  afterInit(server: Server) {
    // Admin UI automatically detects all namespaces
    instrument(server, {
      auth: {
        /* ... */
      },
      namespaceName: '/admin', // Custom admin namespace
    });
  }
}
```

## Access Admin UI

### Option 1: Hosted UI (Recommended)

1. Visit: <https://admin.socket.io>
2. Enter backend URL: `http://localhost:3000` (or production URL)
3. Authenticate with credentials from `.env`

### Option 2: Self-Hosted UI

```bash
git clone https://github.com/socketio/socket.io-admin-ui.git
cd socket.io-admin-ui/ui
npm install
npm start
```

Access at: <http://localhost:3001>

## Monitoring Features

### Available Metrics

- **Connections**: Total active clients, connection history
- **Events**: Real-time event stream with payload inspection
- **Rooms**: Active rooms and client distribution
- **Namespaces**: All configured namespaces
- **Performance**: Latency, throughput, error rates

### Useful for Debugging

- Inspect `JWT_VALIDATED` event payloads
- Monitor presence tracking in rooms
- Verify dry-run mode behavior
- Track connection lifecycle (connect/disconnect)

## Production Deployment

### Best Practices

1. **Authentication**: Use strong, rotated passwords
2. **Network Security**: Deploy behind VPN or IP whitelist
3. **Read-Only Mode**: Prevent accidental client disconnections
4. **HTTPS**: Always use TLS in production
5. **Audit Logging**: Log admin UI access attempts

### Docker Example

```dockerfile
# Already exposed in main app, no separate service needed
# Admin UI piggybacks on existing WebSocket server
```

### Reverse Proxy (Nginx)

```nginx
location /admin-socket-io {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # IP whitelist for admin access
    allow 10.0.0.0/8;
    deny all;
}
```

## Testing Admin UI

```bash
# Start backend with Admin UI enabled
npm run start:dev

# In browser:
# 1. Go to https://admin.socket.io
# 2. Enter: http://localhost:3000
# 3. Login with credentials from .env
# 4. Verify namespace `/` and `/surgical-operations` appear
# 5. Connect test client (use ui/test-single-page.html)
# 6. Observe connection in Admin UI
```

## Troubleshooting

### Admin UI cannot connect

- Check CORS configuration includes admin origin
- Verify credentials match `.env` values
- Ensure backend is running and accessible
- Check firewall rules

### Events not appearing

- Verify `instrument()` called in `afterInit()`
- Check namespace configuration
- Ensure client is actually emitting events

### Performance impact

- Admin UI adds minimal overhead (<1% CPU)
- Consider disabling in production if not needed
- Use read-only mode to prevent mutations

## References

- Official Docs: <https://socket.io/docs/v4/admin-ui/>
- GitHub: <https://github.com/socketio/socket.io-admin-ui>
- Security Guide: <https://socket.io/docs/v4/admin-ui/#authentication>

---

**Questions?** Contact UI team or refer to `UI_TEAM_WEBSOCKET_API.md` for integration details.
