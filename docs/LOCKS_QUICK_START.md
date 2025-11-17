# 🔒 Distributed Locks - Quick Start Guide

> **Backend Status**: ✅ BE-001.3 Ready (Nov 17, 2025)  
> **Test Coverage**: 329/329 tests passing (7/7 BDD lock scenarios)  
> **For Full Docs**: See `UI_TEAM_WEBSOCKET_API.md` (updated after feedback)

---

## 🎯 What You Can Do NOW

The backend supports **exclusive editor locking** with these features:

- ✅ Acquire/Release locks via WebSocket
- ✅ Automatic heartbeat (60s interval recommended)
- ✅ 30-second grace period on disconnect
- ✅ Custom TTL support (min 5s, default 5min)
- ✅ Human-readable error types for frontend

---

## 📋 Event Reference Table

### Client → Server (Emit)

| Event          | Payload                                | Description            |
| -------------- | -------------------------------------- | ---------------------- |
| `lock:acquire` | `{ resourceId: string, ttl?: number }` | Request exclusive lock |
| `lock:release` | `{ resourceId: string }`               | Release owned lock     |
| `lock:extend`  | `{ resourceId: string }`               | Heartbeat (renew TTL)  |

### Server → Client (Listen)

| Event           | Payload                                                               | Description                     |
| --------------- | --------------------------------------------------------------------- | ------------------------------- |
| `lock:acquired` | `{ resourceId: string, lockId: string, expiresAt: string }`           | Lock granted ✅                 |
| `lock:denied`   | `{ code: string, type: string, message: string, timestamp, details }` | Lock denied ❌ (error response) |
| `lock:released` | `{ resourceId: string }`                                              | Lock released successfully      |
| `lock:extended` | `{ resourceId: string, expiresAt: string }`                           | Heartbeat acknowledged          |
| `lock:status`   | `{ resourceId: string, locked: boolean, lockedBy?, expiresAt? }`      | Lock state change (broadcast)   |

---

## 🚨 Error Types (Use `error.type`, NOT `error.code`)

When you receive `lock:denied` or other errors, check `error.type` for human-readable values:

```typescript
socket.on('lock:denied', error => {
  switch (
    error.type // ✅ Use type for switch/case
  ) {
    case 'LOCK_NOT_HELD':
      // Someone else is editing
      showToast(`Locked by ${error.details.currentHolder.username}`);
      setViewerMode();
      break;

    case 'LOCK_ACQUIRE_FAILED':
      // Server error
      showToast('Failed to acquire lock, try again');
      break;

    case 'RESOURCE_NOT_FOUND':
      // Invalid resourceId
      showToast('Resource not found');
      break;

    case 'CONNECTION_NOT_FOUND':
      // Your connection is invalid (should reconnect)
      socket.disconnect();
      socket.connect();
      break;
  }
});
```

**Common Error Types**:

- `LOCK_NOT_HELD` - Another user holds the lock
- `LOCK_ACQUIRE_FAILED` - Redis error or server issue
- `LOCK_RELEASE_FAILED` - Can't release (not owner)
- `RESOURCE_NOT_FOUND` - Invalid resourceId format
- `CONNECTION_NOT_FOUND` - Connection not in pool

---

## 📝 ResourceId Format

**Use explicit format** (backward compat deprecated):

```typescript
// ✅ CORRECT
'doc:123:main'; // document 123, main section
'surgery:456:procedure'; // surgery 456, procedure section
'form:789:section2'; // form 789, section 2

// ⚠️ DEPRECATED (will log warning)
'doc:123'; // Backend auto-converts to 'doc:123:main'
```

**Pattern**: `{type}:{id}:{section}`

---

## 🔐 JWT Token Generator (for Testing)

Create a test token without Keycloak:

```bash
# Option 1: Node.js one-liner
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { sub: 'user123', preferred_username: 'testuser', email: 'test@example.com' },
  'your-secret-key',  // Use same secret as backend
  { expiresIn: '1h' }
);
console.log(token);
"

# Option 2: Use backend mock service (if available)
curl http://localhost:3000/auth/mock/token?userId=user123
```

**Backend Secret**: Check `.env` file → `JWT_SECRET` variable

---

## 💻 Minimal Working Example

```typescript
import { io, Socket } from 'socket.io-client';

// 1️⃣ CONNECT
const socket: Socket = io('http://localhost:3000/collaboration', {
  path: '/ws/socket.io',
  transports: ['websocket'],
  auth: { token: 'your-jwt-token' },
});

// 2️⃣ ACQUIRE LOCK (when user clicks "Edit" button)
function startEditing(resourceId: string) {
  socket.emit('lock:acquire', {
    resourceId,
    ttl: 300000, // Optional: 5 minutes (default if omitted)
  });
}

socket.on('lock:acquired', data => {
  console.log('✅ Lock acquired:', data.resourceId);
  console.log('⏰ Expires at:', data.expiresAt);

  // Enable editor
  setEditorMode(true);
  startHeartbeat(data.resourceId);
});

socket.on('lock:denied', error => {
  console.error('❌ Lock denied:', error.type);

  if (error.type === 'LOCK_NOT_HELD') {
    const holder = error.details.currentHolder;
    showToast(`Document locked by ${holder.username}`);
  }

  // Stay in viewer mode
  setEditorMode(false);
});

// 3️⃣ HEARTBEAT (keep lock alive - every 60 seconds)
let heartbeatTimer: number | null = null;

function startHeartbeat(resourceId: string) {
  heartbeatTimer = window.setInterval(() => {
    socket.emit('lock:extend', { resourceId });
  }, 60000); // 60 seconds
}

socket.on('lock:extended', data => {
  console.log('💓 Heartbeat OK, new expiry:', data.expiresAt);
});

// 4️⃣ RELEASE LOCK (when user clicks "Close" or saves)
function stopEditing(resourceId: string) {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  socket.emit('lock:release', { resourceId });
}

socket.on('lock:released', data => {
  console.log('🔓 Lock released:', data.resourceId);
  setEditorMode(false);
});

// 5️⃣ WATCH LOCK STATUS (other users' lock changes)
socket.on('lock:status', data => {
  if (data.locked) {
    console.log(`🔒 ${data.lockedBy.username} started editing`);
    disableEditButton();
  } else {
    console.log('🔓 Document unlocked');
    enableEditButton();
  }
});

// 6️⃣ DISCONNECT HANDLING (automatic - 30s grace period)
socket.on('disconnect', reason => {
  console.warn('⚠️ Disconnected:', reason);
  // Backend keeps lock for 30s if you reconnect
  // After 30s, lock auto-releases
});
```

---

## ⚙️ Configuration Values

| Parameter          | Value      | Description                             |
| ------------------ | ---------- | --------------------------------------- |
| Default TTL        | 300,000 ms | 5 minutes lock duration                 |
| Min TTL            | 5,000 ms   | Minimum custom TTL                      |
| Heartbeat Interval | 60,000 ms  | Recommended heartbeat frequency         |
| Grace Period       | 30,000 ms  | Reconnect window after disconnect       |
| Heartbeats per TTL | 5          | 300s / 60s = 5 heartbeats before expiry |

---

## 🐛 Common Issues & Solutions

### Issue 1: `lock:denied` with type `CONNECTION_NOT_FOUND`

**Cause**: Your socket connection is not in backend pool  
**Fix**: Ensure `connect` event fired before emitting `lock:acquire`

```typescript
socket.on('connect', () => {
  // ✅ NOW safe to acquire locks
  socket.emit('lock:acquire', { resourceId });
});
```

### Issue 2: Lock expires despite heartbeat

**Cause**: Heartbeat interval > 60s or network issues  
**Fix**: Use 50-60s interval (not 70s+)

```typescript
// ❌ BAD (too slow)
setInterval(() => socket.emit('lock:extend', { resourceId }), 90000);

// ✅ GOOD
setInterval(() => socket.emit('lock:extend', { resourceId }), 60000);
```

### Issue 3: `error.code` not working in switch/case

**Cause**: Using `error.code` instead of `error.type`  
**Fix**: Always use `error.type` for conditionals

```typescript
// ❌ BAD
if (error.code === 'WS_4013') { ... }

// ✅ GOOD
if (error.type === 'LOCK_NOT_HELD') { ... }
```

### Issue 4: Backend warns "Deprecated resourceId format"

**Cause**: Using `doc:123` instead of `doc:123:main`  
**Fix**: Always include section part

```typescript
// ❌ Deprecated
const resourceId = `doc:${docId}`;

// ✅ Correct
const resourceId = `doc:${docId}:main`;
```

---

## 🧪 Testing Your Integration

### Test Scenario 1: Basic Lock Flow

```bash
# Terminal 1: Start backend
npm run start:dev

# Terminal 2: Run BDD tests to verify backend
npm run test:bdd

# Expected: 7/7 scenarios passing
```

### Test Scenario 2: Multi-User Lock Conflict

1. Open two browser tabs with same resourceId
2. Tab 1: Click "Edit" → Should acquire lock ✅
3. Tab 2: Click "Edit" → Should show "Locked by User1" ❌
4. Tab 1: Click "Close" → Lock released
5. Tab 2: Click "Edit" → Should acquire lock ✅

### Test Scenario 3: Disconnect Grace Period

1. Acquire lock
2. Disconnect network (DevTools → Network → Offline)
3. Wait 10 seconds
4. Reconnect → Lock still held ✅
5. Wait 40 seconds total → Lock auto-released ❌

---

## 📚 Next Steps

1. **Implement basic flow** (acquire → heartbeat → release)
2. **Test multi-user scenario** (two tabs)
3. **Report feedback** to backend team
4. **Read full docs** (`UI_TEAM_WEBSOCKET_API.md`) after testing

---

## 🆘 Need Help?

- **Backend Team**: Antonio Cittadino
- **BDD Tests**: `scripts/bdd-tests/be001-3-locks.test.js`
- **Source Code**: `src/websocket-gateway/websocket-gateway.gateway.ts`
- **Full API Docs**: `docs/UI_TEAM_WEBSOCKET_API.md` (coming soon)

**Questions?** Open an issue with `[BE-001.3]` prefix or ping backend team.

---

**Last Updated**: November 17, 2025  
**Backend Version**: v0.3.0+  
**Test Status**: ✅ 329/329 tests passing
