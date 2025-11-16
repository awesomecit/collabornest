# Architettura CollaborNest

Questo documento descrive l'architettura di alto livello di CollaborNest.

## Indice

1. [Panoramica](#panoramica)
2. [Componenti principali](#componenti-principali)
3. [Flussi dati](#flussi-dati)
4. [Scalabilità](#scalabilità)
5. [Sicurezza](#sicurezza)

## Panoramica

CollaborNest è progettato come un layer collaborativo "top of the app" che si integra con applicazioni esistenti per aggiungere funzionalità real-time.

```
┌─────────────────────────────────────────────────┐
│           Client Applications                   │
│  (Web, Mobile, Desktop)                         │
└────────────┬────────────────────────────────────┘
             │ Socket.IO
             ▼
┌─────────────────────────────────────────────────┐
│          CollaborNest Gateway                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Presence │  │   Lock   │  │ Monitor  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└────────┬───────────────┬──────────────┬─────────┘
         │               │              │
    ┌────▼────┐     ┌────▼────┐    ┌───▼─────┐
    │  Redis  │     │RabbitMQ │    │   DB    │
    └─────────┘     └─────────┘    └─────────┘
```

### Principi architetturali

1. **Modularity**: Ogni componente è indipendente e sostituibile
2. **Extensibility**: Facile aggiungere nuove funzionalità via adapters
3. **Scalability**: Design per multi-istanza con stato condiviso
4. **Resilience**: Gestione graceful di failure e disconnessioni
5. **Performance**: Ottimizzato per bassa latenza e high throughput

## Componenti principali

### Core Gateway (@collab/core)

Il gateway Socket.IO è il punto di ingresso per tutte le connessioni client.

**Responsabilità:**
- Gestione connessioni WebSocket
- Routing eventi client/server
- Gestione rooms (resource e subresource)
- ACK handling per operazioni critiche
- Recovery da disconnessioni

**Key patterns:**
- Event-driven architecture
- Room-based broadcasting
- Acknowledgment callbacks
- Middleware pipeline

```typescript
// Esempio di evento con ACK
@SubscribeMessage('join')
async handleJoin(
  @MessageBody() payload: JoinPayload,
  @ConnectedSocket() client: Socket,
): Promise<JoinAck> {
  // Validation
  // Join room
  // Update presence
  // Return ACK
}
```

### Presence Service (@collab/presence)

Traccia chi è presente su quali risorse in tempo reale.

**Responsabilità:**
- Join/Leave tracking
- Heartbeat management
- Stale connection cleanup
- Count editors/viewers

**Storage:**
- Redis Hash per user metadata
- Redis Sorted Set per timestamp-based cleanup
- TTL per auto-cleanup

**Data model:**
```
Key: presence:{resource}:{subresource?}:{userId}
Value: { mode, since, metadata }
TTL: staleThresholdMs
```

### Lock Manager (@collab/lock)

Gestisce i lock distribuiti sulle risorse.

**Responsabilità:**
- Acquire/Release locks
- TTL management
- Lock ownership verification
- Auto-unlock on disconnect

**Implementation:**
- Redlock algorithm per distributed locks
- Redis SET NX PX per atomic lock
- Lock ID per ownership proof

**Data model:**
```
Key: lock:{resource}:{subresource?}
Value: { lockId, owner, expiresAt }
TTL: configurable
```

### Monitor Service (@collab/monitor)

Monitora lo stato del sistema e rileva anomalie.

**Responsabilità:**
- Connection health tracking
- Conflict detection
- Metrics collection
- Dead connection cleanup

**Metriche:**
- Active connections per resource
- Lock contention rate
- Average presence duration
- Conflict frequency

### Resource Adapters (@collab/adapters)

Interfaccia tra CollaborNest e il data layer dell'applicazione.

**Responsabilità:**
- Resource CRUD operations
- Revision management
- Patch application
- Business logic integration

**Interface:**
```typescript
interface IResourceAdapter<T> {
  findOne(id: string): Promise<T | null>;
  findChild?(resourceId: string, childId: string): Promise<any>;
  saveRevision(id: string, payload: any): Promise<{ revisionId: string }>;
  applyPatch?(current: T, patch: any): Promise<T>;
}
```

### SDK Client (@collab/sdk)

Client JavaScript/TypeScript per semplificare l'integrazione.

**Features:**
- Typed event emitters
- Auto-reconnection
- Presence helpers
- Lock utilities

```typescript
const collab = new CollabClient('http://localhost:3000');

await collab.join('patient:123', { mode: 'editor' });
const lock = await collab.acquireLock('patient:123');
// ... work
await lock.release();
```

## Flussi dati

### Join Flow

```
Client                Gateway              Presence           Redis
  │                      │                    │                │
  ├──join────────────────>│                    │                │
  │                      ├──validate───────────>│                │
  │                      │                    ├──check count───>│
  │                      │                    │<────count───────┤
  │                      │<──limits ok────────┤                │
  │                      ├──add user──────────>│                │
  │                      │                    ├──HSET──────────>│
  │                      │                    ├──EXPIRE────────>│
  │                      │<──success──────────┤                │
  │                      ├──join room                          │
  │                      ├──broadcast presence                 │
  │<──ack(ok=true)───────┤                                     │
```

### Lock Flow

```
Client                Gateway              LockMgr            Redis
  │                      │                    │                │
  ├──lock────────────────>│                    │                │
  │                      ├──request lock──────>│                │
  │                      │                    ├──SET NX PX────>│
  │                      │                    │<──OK───────────┤
  │                      │                    ├──generate ID   │
  │                      │<──locked(id)───────┤                │
  │                      ├──broadcast locked                   │
  │<──ack(lockId)────────┤                                     │
  │                      │                                     │
  │                      │  [Later: unlock]                    │
  │──unlock──────────────>│                                     │
  │                      ├──verify ownership──>│                │
  │                      │                    ├──DEL if match─>│
  │                      │<──released─────────┤                │
  │                      ├──broadcast unlocked                 │
  │<──ack(ok=true)───────┤                                     │
```

### Update Flow (con conflict detection)

```
Client A             Client B              Gateway            Adapter
  │                     │                      │                │
  ├──update(rev:1)──────────────────────────────>│                │
  │                     │                      ├──save rev 2────>│
  │                     │                      │<──saved(rev:2)──┤
  │                     │                      ├──broadcast───────>B
  │                     ├──update(rev:1)───────>│                │
  │                     │                      ├──check base    │
  │                     │                      ├──CONFLICT!     │
  │                     │<──conflict(1 vs 2)───┤                │
  │                     ├──resolve─────────────>│                │
```

## Scalabilità

### Multi-instance deployment

```
┌──────────┐    ┌──────────┐    ┌──────────┐
│Instance 1│    │Instance 2│    │Instance 3│
└─────┬────┘    └─────┬────┘    └─────┬────┘
      │               │               │
      └───────────┬───┴───────────────┘
                  │
           ┌──────▼──────┐
           │Redis Adapter│
           └──────┬──────┘
                  │
        ┌─────────▼─────────┐
        │  Redis Cluster    │
        └───────────────────┘
```

**Strategie:**
- Redis pub/sub per cross-instance messaging
- Sticky sessions opzionali per performance
- Shared state in Redis
- RabbitMQ per eventi durable

### Horizontal scaling

- Load balancer con sticky sessions (opzionale)
- Redis Cluster per HA
- RabbitMQ cluster
- Stateless gateway instances

### Performance optimizations

1. **Connection pooling**: Riusa connessioni Redis/DB
2. **Pipeline operations**: Batch Redis commands
3. **Lazy loading**: Carica dati solo quando necessario
4. **Caching**: Cache metadata frequenti
5. **Debouncing**: Rate limit heartbeats e updates

## Sicurezza

### Authentication

```typescript
// JWT-based auth
socket.on('auth', async (payload) => {
  const user = await verifyToken(payload.token);
  socket.data.userId = user.id;
  socket.data.permissions = user.permissions;
});
```

### Authorization

```typescript
// Resource-level permissions
@UseGuards(ResourceGuard)
@SubscribeMessage('join')
async handleJoin() {
  // Guard verifica se user può accedere alla risorsa
}
```

### Input validation

```typescript
// DTO validation con class-validator
export class JoinDto {
  @IsString()
  @Matches(/^[a-z]+:[0-9]+$/)
  resource: string;

  @IsEnum(['viewer', 'editor'])
  mode: 'viewer' | 'editor';
}
```

### Rate limiting

```typescript
// Per-user rate limits
@UseGuards(RateLimitGuard)
@SubscribeMessage('update')
async handleUpdate() {
  // Max 10 updates/second per user
}
```

### Data encryption

- TLS per transport (wss://)
- Encryption at rest per dati sensibili
- Secrets in environment variables

## Edge Cases

### Gestione disconnessioni improvvise

1. **Heartbeat timeout**: Client non risponde → remove presence
2. **Auto-unlock**: Lock rilasciato automaticamente
3. **Cleanup**: Background job rimuove stale data

### Split-brain scenarios

- Redlock previene lock multipli
- Eventual consistency per presenza
- Conflict resolution per updates concorrenti

### Network partitions

- Graceful degradation
- Retry con exponential backoff
- Circuit breaker per chiamate esterne

## Estensibilità

### Custom adapters

```typescript
// Implementa IResourceAdapter per il tuo data source
export class MongoResourceAdapter implements IResourceAdapter {
  async findOne(id: string) {
    return this.model.findById(id);
  }
  // ...
}
```

### Custom events

```typescript
// Aggiungi eventi personalizzati
@SubscribeMessage('custom:action')
async handleCustomAction() {
  // Your logic
}
```

### Plugins

```typescript
// Sistema di plugin per estendere funzionalità
CollabModule.forRoot({
  plugins: [
    AuditLogPlugin,
    MetricsPlugin,
    CustomPlugin,
  ],
});
```

## Monitoring e Observability

### Metrics

- Prometheus exports
- Custom metrics via StatsD
- Health check endpoints

### Logging

- Structured logging (JSON)
- Log levels configurabili
- Correlation IDs per request tracing

### Tracing

- OpenTelemetry integration
- Distributed tracing cross-service
- Performance profiling

## Riferimenti

- [Socket.IO Scalability](https://socket.io/docs/v4/using-multiple-nodes/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Redlock Algorithm](https://redis.io/docs/manual/patterns/distributed-locks/)
- [NestJS Microservices](https://docs.nestjs.com/microservices/basics)