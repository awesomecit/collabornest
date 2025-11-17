# Backend Response to UI Team Feedback

**From**: Backend Team (Antonio Cittadino)
**To**: UI Team
**Date**: November 16, 2025
**Re**: WebSocket API Validation - BE-001.3 Prioritization Confirmed

---

## Executive Summary

✅ **Feedback accepted in full**. We agree that **BE-001.3 (Distributed Locks)** is the critical blocker for production deployment. Roadmap has been adjusted to prioritize locking over Y.js CRDT.

---

## Response to Critical Issue: Editor Locking

### Agreement

You are **100% correct**. The current implementation allows concurrent editors without conflict detection, which is **unacceptable for healthcare production** where data integrity is critical.

**Risk Assessment**: 🔴 **HIGH** - Data loss in surgical documentation can have legal and medical consequences.

### Implementation Plan (BE-001.3 - EXPEDITED)

**Timeline**: Week 3-4 (November 18 - December 1, 2025)
**Priority**: 🔴 **CRITICAL PATH** (blocks production deployment)

#### Phase 1: Basic Locking (Week 3)

**Goal**: Single-editor enforcement with Redis-backed locks

**Deliverables**:

1. **RedisLockService** with atomic operations
   - `acquireLock(resourceId, userId, socketId, ttl)` → boolean
   - `releaseLock(resourceId, userId)` → boolean
   - `renewLock(resourceId, userId)` → boolean (heartbeat)
   - `getLockHolder(resourceId)` → LockInfo | null

2. **New WebSocket Events**:

   ```typescript
   // Client → Server
   'resource:request_lock'   { resourceId, mode: 'editor' }

   // Server → Client
   'lock:acquired'           { resourceId, userId, expiresAt }
   'lock:denied'             { resourceId, reason, currentHolder }
   'lock:released'           { resourceId, releasedBy }
   'lock:expired'            { resourceId, previousHolder }
   'lock:auto_downgrade'     { resourceId, mode: 'viewer', reason }
   ```

3. **Auto-Downgrade Logic**:
   - User joins as editor → Check Redis lock
   - Lock available → Acquire + emit `lock:acquired`
   - Lock held by other → Auto-downgrade to viewer + emit `lock:denied`
   - Lock holder leaves → Auto-release + broadcast `lock:released`

4. **Lock TTL & Heartbeat**:
   - TTL: 5 minutes (configurable)
   - Heartbeat: Every 60 seconds (auto-renewal)
   - If heartbeat fails → Lock expires → Broadcast `lock:expired`

**BDD Scenarios** (6 scenarios):

```gherkin
Scenario: First editor acquires lock
  Given resource "doc-123" has no lock
  When User A joins as editor
  Then User A receives lock:acquired event
  And Redis key "lock:doc-123" contains User A

Scenario: Second editor is auto-downgraded
  Given User A holds lock on "doc-123"
  When User B joins as editor
  Then User B receives lock:denied event
  And User B is auto-downgraded to viewer
  And User B receives lock:auto_downgrade event

Scenario: Lock is released when holder leaves
  Given User A holds lock on "doc-123"
  When User A disconnects
  Then Redis key "lock:doc-123" is deleted
  And all users in resource receive lock:released event

Scenario: Lock expires after TTL without heartbeat
  Given User A holds lock on "doc-123"
  And lock TTL is 30 seconds
  When 30 seconds pass without heartbeat
  Then Redis key "lock:doc-123" expires
  And all users receive lock:expired event

Scenario: Lock is renewed with heartbeat
  Given User A holds lock on "doc-123"
  When User A sends heartbeat every 60 seconds
  Then lock TTL is renewed to 5 minutes
  And lock remains active

Scenario: Viewer can upgrade to editor when lock is free
  Given User B is viewer in "doc-123"
  And lock is available
  When User B requests lock upgrade
  Then User B receives lock:acquired event
  And User B mode changes to editor
```

**ETA**: November 25, 2025 (9 days)

---

#### Phase 2: Hierarchical Locking (Week 4)

**Goal**: Granular locks for tabs/sections within a document

**Architecture**:

```typescript
// Parent resource (presence only, no lock)
resource:document:123

// Child resources (lockable tabs)
resource:document:123/tab:patient-info
resource:document:123/tab:diagnosis
resource:document:123/tab:procedure-notes
```

**Lock Inheritance Rules**:

- Parent has no lock (only tracks presence)
- Each child tab has independent lock
- User can hold locks on multiple tabs simultaneously
- Lock on child does NOT lock parent

**Example Flow**:

```typescript
// Dr. Smith joins document (presence only)
socket.emit('resource:join', {
  resourceId: 'document:123',
  mode: 'editor',
});
// No lock acquired, just presence tracked

// Dr. Smith locks patient-info tab
socket.emit('resource:request_lock', {
  resourceId: 'document:123/tab:patient-info',
});
// Lock acquired on child resource

// Nurse Jane joins same document
socket.emit('resource:join', {
  resourceId: 'document:123',
  mode: 'editor',
});
// OK, presence tracked (no conflict)

// Nurse Jane locks diagnosis tab
socket.emit('resource:request_lock', {
  resourceId: 'document:123/tab:diagnosis',
});
// Lock acquired on different child (no conflict)

// Nurse Jane tries to lock patient-info tab
socket.emit('resource:request_lock', {
  resourceId: 'document:123/tab:patient-info',
});
// DENIED: Dr. Smith already holds this tab lock
```

**Benefits**:

- ✅ Multiple users can edit different tabs simultaneously
- ✅ Fine-grained conflict prevention
- ✅ Better UX (less blocking)

**BDD Scenarios** (4 scenarios):

```gherkin
Scenario: Multiple tabs locked by different users
  Given User A holds lock on "doc:123/tab:patient"
  When User B requests lock on "doc:123/tab:diagnosis"
  Then User B receives lock:acquired event
  And both locks coexist independently

Scenario: Same tab lock conflict
  Given User A holds lock on "doc:123/tab:patient"
  When User B requests lock on "doc:123/tab:patient"
  Then User B receives lock:denied event

Scenario: User can hold multiple tab locks
  Given User A requests lock on "doc:123/tab:patient"
  And User A requests lock on "doc:123/tab:diagnosis"
  Then User A holds both locks simultaneously

Scenario: Parent presence does not block child locks
  Given User A joined "doc:123" (presence only)
  When User B requests lock on "doc:123/tab:patient"
  Then User B receives lock:acquired event
  And User A presence is unaffected
```

**ETA**: December 2, 2025 (16 days)

---

## Response to Architecture Enhancement

### Hierarchical Resources

**Status**: ✅ **Fully Supported**

We already implemented hierarchical resource IDs in BE-001.2 (Presence Tracking). The backend supports arbitrary resource ID formats:

```typescript
// Current backend implementation (already supports hierarchy)
async handleJoinResource(client: Socket, payload: ResourceJoinDto) {
  const { resourceId, mode } = payload;

  // Works with any format:
  // - "document:123"
  // - "document:123/tab:patient-info"
  // - "document:123/section:diagnosis/subsection:imaging"

  await client.join(resourceId);  // Socket.IO room
  this.presenceManager.addUser(resourceId, userId, mode);
}
```

**What's needed**: Just extend locking logic to support the same format (already planned for Phase 2).

**No breaking changes required** - UI can start using hierarchical IDs immediately for presence tracking. Locks will follow in Phase 2.

---

## Response to Minor Improvements

### 1. Event Payload Documentation

**Status**: ✅ **Will be added to UI_TEAM_WEBSOCKET_API.md**

We will add explicit TypeScript interfaces for all lock events:

```typescript
// Lock Events Payloads (to be added)
interface LockAcquiredPayload {
  resourceId: string;
  userId: string;
  username: string;
  socketId: string;
  expiresAt: number; // Unix timestamp
  ttl: number; // Milliseconds
}

interface LockDeniedPayload {
  resourceId: string;
  reason: 'ALREADY_LOCKED' | 'INSUFFICIENT_PERMISSIONS';
  currentHolder: {
    userId: string;
    username: string;
    lockedSince: number;
    expiresAt: number;
  };
}

interface LockReleasedPayload {
  resourceId: string;
  releasedBy: string;
  reason: 'USER_LEFT' | 'MANUAL_RELEASE' | 'EXPIRED';
  timestamp: number;
}

interface LockExpiredPayload {
  resourceId: string;
  previousHolder: string;
  expiredAt: number;
}
```

**Deliverable**: Updated `UI_TEAM_WEBSOCKET_API.md` with Section 5 (Lock Management) by November 20, 2025.

---

### 2. Error Codes

**Status**: ✅ **Will be standardized**

Current ad-hoc errors will be replaced with machine-readable codes:

```typescript
enum WsErrorCode {
  // Authentication
  JWT_INVALID = 'JWT_INVALID',
  JWT_EXPIRED = 'JWT_EXPIRED',

  // Resource Access
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  ALREADY_IN_RESOURCE = 'ALREADY_IN_RESOURCE',
  NOT_IN_RESOURCE = 'NOT_IN_RESOURCE',

  // Locking (new)
  LOCK_ALREADY_HELD = 'LOCK_ALREADY_HELD',
  LOCK_NOT_HOLDER = 'LOCK_NOT_HOLDER',
  LOCK_EXPIRED = 'LOCK_EXPIRED',
  LOCK_LIMIT_EXCEEDED = 'LOCK_LIMIT_EXCEEDED',
}

// Error response format
interface WsErrorResponse {
  success: false;
  errorCode: WsErrorCode;
  message: string; // Human-readable (English)
  details?: Record<string, any>; // Additional context
  timestamp: number;
}
```

**Deliverable**: `src/websocket-gateway/constants/ws-error-codes.ts` by November 20, 2025.

---

### 3. Username Field

**Status**: ✅ **Confirmed**

Backend already uses `username` as display name (not email). JWT payload structure:

```typescript
// JWT payload (from Keycloak/auth service)
{
  sub: "user-uuid-123",           // User ID (primary key)
  username: "Dr. John Smith",     // Display name (NOT email)
  email: "john.smith@hospital.it", // Email (separate field)
  given_name: "John",
  family_name: "Smith",
  // ...
}
```

All presence tracking and lock events use `username` for display purposes.

**No changes needed** - already correct.

---

## Revised Roadmap Priority

### Before (Original)

```
Week 3-4: BE-001.3 Distributed Locks
Week 5-6: BE-001.4 Y.js CRDT Integration
Week 7-8: BE-001.5 Presence Persistence
```

### After (UI Feedback)

```
Week 3:   BE-001.3 Phase 1 - Basic Locking (CRITICAL)
Week 4:   BE-001.3 Phase 2 - Hierarchical Locking (HIGH)
Week 5-6: BE-001.5 Presence Persistence (Redis Streams)
Week 7-8: BE-001.4 Y.js CRDT Integration (DEFERRED)
```

**Rationale**:

- Locking prevents data loss → **Production blocker** → Must ship first
- Y.js CRDT prevents conflicts → **UX enhancement** → Can ship later
- Presence persistence → **Scalability** → Medium priority

---

## Testing Strategy

### BDD Test Coverage (BE-001.3)

**Phase 1 (Basic Locking)**: 6 scenarios

- Acquire lock
- Deny lock (already held)
- Release lock (manual)
- Expire lock (TTL)
- Renew lock (heartbeat)
- Auto-downgrade to viewer

**Phase 2 (Hierarchical)**: 4 scenarios

- Multiple tab locks by different users
- Same tab lock conflict
- User holds multiple locks
- Parent presence independent of child locks

**Total**: 10 new BDD scenarios

**Test Infrastructure**: Extend existing BDD framework (`scripts/bdd-tests/be001-3-distributed-locks.test.js`)

---

## Deliverables Timeline

| Deliverable               | ETA    | Status         |
| ------------------------- | ------ | -------------- |
| **Error codes enum**      | Nov 20 | 🟡 In Progress |
| **Updated API docs**      | Nov 20 | 🟡 In Progress |
| **RedisLockService**      | Nov 25 | ⏳ Not Started |
| **Lock WebSocket events** | Nov 25 | ⏳ Not Started |
| **BDD tests (Phase 1)**   | Nov 25 | ⏳ Not Started |
| **Hierarchical locking**  | Dec 2  | ⏳ Not Started |
| **BDD tests (Phase 2)**   | Dec 2  | ⏳ Not Started |

---

## Questions for UI Team

1. **Lock Timeout**: Is 5 minutes TTL acceptable? Should we make it configurable per resource type?

2. **Lock Upgrade Flow**: If viewer wants to become editor but lock is held, should we:
   - A) Auto-deny + show notification
   - B) Add to queue + notify when lock available
   - C) Show "Request Lock" button → Send push notification to current holder

3. **Lock Holder Disconnect**: When lock holder loses connection unexpectedly (not graceful disconnect), should we:
   - A) Release lock immediately (current plan)
   - B) Wait 30 seconds for reconnection before releasing
   - C) Prompt remaining users "Lock holder disconnected, claim lock?"

4. **Tab Lock Limit**: Should we limit max concurrent tab locks per user? (e.g., max 5 tabs locked simultaneously)

5. **Lock Takeover**: Should admins/surgeons be able to forcefully take lock from another user? (with audit trail)

---

## Next Steps

1. **Backend**:
   - Create `BE-001.3` branch
   - Implement RedisLockService (Week 3)
   - Add WebSocket lock events (Week 3)
   - Write BDD tests (Week 3)

2. **UI Team**:
   - Review proposed event payloads (see Section 1 above)
   - Answer questions (see Section above)
   - Prepare UI for lock events (Phase 2 blocker removal)

3. **Sync Meeting**:
   - **Proposed**: November 18, 2025 @ 10:00 AM
   - **Agenda**: Review lock event contracts, answer questions, align on edge cases

---

## Bottom Line

✅ **BE-001.3 is now top priority**
✅ **Phase 1 (basic locking) ships in 9 days**
✅ **Phase 2 (hierarchical) ships in 16 days**
✅ **No breaking changes to BE-001.1 or BE-001.2**

Your feedback was **exactly what we needed** to prioritize correctly. Thank you for thorough validation! 🎯

---

**Contact**: <antonio.cittadino@hospital.it>
**Status Updates**: Daily in `#backend-team` Slack channel
