# API Socket (eventi & payload)

Questa sezione documenta gli eventi socket che il core espone. Usa socket.io (namespaces e rooms consigliati).

## Namespace
- `/collab` — namespace principale

## Eventi lato client → server

### `connect`
Socket.io native.

### `auth`  
Autenticazione (opzionale, prima di operare sulle risorse).  
Payload:
```ts
interface AuthPayload {
  token?: string; // JWT o session token
  userId?: string; // fallback
}
```

### `join`
Un utente chiede di entrare su una risorsa (root o child).
Payload:
```ts
interface JoinPayload {
  resource: string;       // ex: "patient:123"
  subresource?: string;   // ex: "note:456"
  mode: 'viewer' | 'editor';
  metadata?: Record<string, any>;
}
```

Risposta (ack):
```ts
interface JoinAck {
  ok: boolean;
  presenceCount?: number;
  lockHeldBy?: string | null;
  limits?: {
    maxEditors?: number;
    maxViewers?: number;
  };
  error?: string;
}
```

### `leave`
Payload:
```ts
interface LeavePayload {
  resource: string;
  subresource?: string;
}
```

### `lock`
Richiede lock su risorsa/sottorisorsa.
Payload:
```ts
interface LockPayload {
  resource: string;
  subresource?: string;
  reason?: string;
  ttlMs?: number; // opzionale, auto-expire
}
```

Ack:
```ts
interface LockAck {
  ok: boolean;
  lockId?: string;
  owner?: string; // userId che detiene il lock
  expiresAt?: string; // ISO
  error?: string;
}
```

### `unlock`
Payload:
```ts
interface UnlockPayload {
  resource: string;
  subresource?: string;
  lockId?: string; // preferibile
}
```

### `update`
Evento che comunica una modifica (non obbligatorio che il core applichi la modifica — viene passato all'applicativo).
Payload:
```ts
interface UpdatePayload {
  resource: string;
  subresource?: string;
  revision?: string; // id revision
  diff?: any; // struttura libera o JSON Patch
  metadata?: { userId?: string, timestamp?: string };
}
```

Il server può ritornare un `update:ack` con la nuova `revision`.

### `heartbeat`
Client periodico per presenza.
Payload:
```ts
interface HeartbeatPayload {
  resource: string;
  subresource?: string;
  timestamp: string;
}
```

### `presence:query`
Chiede lo stato di presenza su una risorsa.
Payload:
```ts
interface PresenceQuery {
  resource: string;
  subresource?: string;
}
```

Risposta:
```ts
interface PresenceResponse {
  users: Array<{ userId: string; mode: 'viewer'|'editor'; since: string; metadata?: any }>;
}
```

## Eventi server → client

### `presence:update`
Broadcast quando cambia la presenza su una risorsa.
Payload: same as `PresenceResponse` + deltas.

### `locked` / `unlocked`
Notifica di lock/unlock:
```ts
interface LockNotice {
  resource: string;
  subresource?: string;
  lockId?: string;
  owner?: string;
  expiresAt?: string;
}
```

### `update:applied`
Notifica che la modifica è stata applicata e revision salvata.
Payload:
```ts
interface UpdateApplied {
  resource: string;
  subresource?: string;
  revision: string;
  author?: string;
  timestamp: string;
}
```

### `conflict`
Quando rilevato un conflitto (es. due editor scrivono simultaneamente).
Payload:
```ts
interface ConflictNotice {
  resource: string;
  subresource?: string;
  ours: { revision: string; patch?:any };
  theirs: { revision: string; patch?:any };
  resolutionHint?: string;
}
```

### `error`
Generic error structure:
```ts
interface ErrorNotice {
  code: string;
  message: string;
  details?: any;
}
```

## Consigli di design

* Usa ACK per operazioni critiche (`lock`, `join`, `update`) per gestire retry.
* Rooms: una room per `resource` e in aggiunta room per `resource:subresource`.
* Metti `userId` in ogni evento o estrailo dal token.
* Rate-limit per `update` e `heartbeat`.