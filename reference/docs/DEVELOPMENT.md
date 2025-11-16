# Guida di Sviluppo

Questa guida copre le best practices e i workflow di sviluppo per CollaborNest.

## Indice

1. [Setup iniziale](#setup-iniziale)
2. [Struttura del progetto](#struttura-del-progetto)
3. [Workflow TDD](#workflow-tdd)
4. [Quality tools](#quality-tools)
5. [Testing strategy](#testing-strategy)
6. [Convenzioni di codice](#convenzioni-di-codice)
7. [Git workflow](#git-workflow)

## Setup iniziale

```bash
# Clone repository
git clone <repo-url>
cd collabornest

# Run setup script
./scripts/setup.sh

# Or manual setup
pnpm install
cp .env.example .env
docker-compose up -d
pnpm build
```

## Struttura del progetto

```
collabornest/
├── packages/@collab/          # Pacchetti monorepo
│   ├── core/                  # Core socket logic
│   ├── presence/              # Presenza
│   ├── lock/                  # Lock manager
│   ├── monitor/               # Monitoring
│   ├── adapters/              # Adapters per DB/resources
│   └── sdk/                   # Client SDK
├── examples/                  # Esempi di integrazione
│   └── nestjs-example/
├── docs/                      # Documentazione
├── scripts/                   # Automation scripts
└── .github/workflows/         # CI/CD
```

### Convenzioni naming

- **Singular** per entities: `user.entity.ts`, `patient.entity.ts`
- **Plural** per resources/controllers: `users.controller.ts`
- **Interfaces**: prefisso `I` - `IResourceAdapter`, `ILockManager`
- **DTOs**: suffisso `.dto.ts` - `join.dto.ts`
- **Tests**: suffisso `.spec.ts` - `collab.gateway.spec.ts`

## Workflow TDD

Seguiamo un approccio Test-Driven Development:

### 1. Red - Scrivi il test (fallisce)

```typescript
// collab.gateway.spec.ts
describe('CollabGateway', () => {
  it('should allow user to join as editor', async () => {
    const client = await connectClient();
    const ack = await client.emit('join', {
      resource: 'patient:123',
      mode: 'editor'
    });
    
    expect(ack.ok).toBe(true);
  });
});
```

### 2. Green - Scrivi il codice minimo

```typescript
// collab.gateway.ts
@SubscribeMessage('join')
async handleJoin(
  @MessageBody() payload: JoinPayload,
): Promise<JoinAck> {
  // Implementazione minima
  return { ok: true };
}
```

### 3. Refactor - Migliora il codice

```typescript
@SubscribeMessage('join')
async handleJoin(
  @MessageBody() payload: JoinPayload,
  @ConnectedSocket() client: Socket,
): Promise<JoinAck> {
  const { resource, mode } = payload;
  
  // Validation
  await this.validateJoin(resource, mode);
  
  // Join room
  await client.join(this.getRoomName(resource));
  
  // Update presence
  await this.presenceService.join(resource, client.data.userId, mode);
  
  return {
    ok: true,
    presenceCount: await this.presenceService.count(resource),
  };
}
```

## Quality tools

### Lint

```bash
pnpm lint          # Check lint errors
pnpm lint:fix      # Auto-fix
```

Configurazione in `eslint.config.mjs`.

### Format

```bash
pnpm format        # Format all files
pnpm format:check  # Check formatting
```

Configurazione in `.prettierrc`.

### Quality pipeline

```bash
pnpm quality       # Run all quality checks
pnpm quality:fix   # Auto-fix all issues
```

### Pre-commit hooks

I hook Git sono configurati con Husky:

```bash
# Installato automaticamente
pnpm prepare
```

## Testing strategy

### Unit tests

Test di singole funzioni/metodi in isolamento:

```typescript
describe('RoomService', () => {
  let service: RoomService;
  
  beforeEach(() => {
    service = new RoomService();
  });
  
  it('should generate correct room name', () => {
    expect(service.getRoomName('patient:123')).toBe('room:patient:123');
  });
});
```

### Integration tests

Test di interazione tra componenti:

```typescript
describe('Presence integration', () => {
  let gateway: CollabGateway;
  let presenceService: PresenceService;
  let redis: Redis;
  
  beforeEach(async () => {
    // Setup test environment
  });
  
  it('should update presence on join', async () => {
    await gateway.handleJoin({ resource: 'test', mode: 'editor' });
    const count = await presenceService.count('test');
    expect(count.editors).toBe(1);
  });
});
```

### E2E tests

Test completi con socket client:

```typescript
describe('Collaboration E2E', () => {
  let app: INestApplication;
  let client1: Socket;
  let client2: Socket;
  
  it('should handle concurrent editors', async () => {
    await client1.emit('join', { resource: 'doc:1', mode: 'editor' });
    await client2.emit('join', { resource: 'doc:1', mode: 'editor' });
    
    const ack2 = await client2.emit('lock', { resource: 'doc:1' });
    expect(ack2.ok).toBe(false); // Already locked
  });
});
```

### Coverage

```bash
pnpm test:cov
```

Target: >80% coverage.

## Convenzioni di codice

### TypeScript strict mode

- No `any` (usa `unknown` se necessario)
- Explicit return types
- Strict null checks

```typescript
// ❌ Bad
function process(data: any) {
  return data.value;
}

// ✅ Good
function process(data: DataType): string | null {
  return data.value ?? null;
}
```

### Error handling

```typescript
// Use custom exceptions
throw new CollabException('LOCK_ALREADY_HELD', {
  resource,
  currentOwner,
});

// Catch and transform
try {
  await this.lock(resource);
} catch (error) {
  this.logger.error('Lock failed', error);
  throw new CollabException('LOCK_FAILED', { cause: error });
}
```

### Async/await

Preferisci async/await a callbacks/promises chains:

```typescript
// ❌ Avoid
this.redis.get(key).then(value => {
  return this.process(value);
}).catch(error => {
  this.logger.error(error);
});

// ✅ Prefer
try {
  const value = await this.redis.get(key);
  return await this.process(value);
} catch (error) {
  this.logger.error(error);
  throw error;
}
```

## Git workflow

### Branch naming

- `feat/feature-name` - Nuove features
- `fix/bug-description` - Bug fixes
- `docs/what-changed` - Documentation
- `refactor/scope` - Refactoring
- `test/what-tested` - Test improvements

### Commit messages

Formato: `type(scope): message`

```bash
feat(core): add heartbeat mechanism
fix(lock): prevent race condition on unlock
docs(api): update socket events documentation
test(presence): add edge case for stale connections
refactor(gateway): extract room management to service
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`

### Pull Request

1. Crea branch da `develop`
2. Implementa feature con test
3. Run quality checks
4. Push e apri PR
5. Attendi review
6. Merge con squash

Template PR:

```markdown
## Descrizione
Breve descrizione della modifica

## Motivazione
Perché questa modifica è necessaria?

## Testing
- [ ] Unit tests aggiunti
- [ ] Integration tests aggiunti
- [ ] E2E tests se applicabile
- [ ] Manual testing completato

## Checklist
- [ ] Codice segue le convenzioni
- [ ] Documentazione aggiornata
- [ ] Tests passano
- [ ] Quality checks passano
```

## Debugging

### VS Code launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Core",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@collab/core", "dev"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Logging

```typescript
import { Logger } from '@nestjs/common';

export class MyService {
  private readonly logger = new Logger(MyService.name);
  
  async doSomething() {
    this.logger.debug('Starting operation');
    this.logger.log('Operation completed');
    this.logger.warn('Something might be wrong');
    this.logger.error('Operation failed', error.stack);
  }
}
```

## Performance

### Redis pipelining

```typescript
// ❌ Slow - multiple round trips
await redis.set('key1', 'value1');
await redis.set('key2', 'value2');
await redis.set('key3', 'value3');

// ✅ Fast - single round trip
const pipeline = redis.pipeline();
pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
pipeline.set('key3', 'value3');
await pipeline.exec();
```

### Batch operations

```typescript
// Process in batches
const BATCH_SIZE = 100;
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE);
  await this.processBatch(batch);
}
```

## Risorse

- [NestJS Documentation](https://docs.nestjs.com/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Redis Commands](https://redis.io/commands/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)