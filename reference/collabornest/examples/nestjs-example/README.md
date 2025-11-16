# NestJS Example - CollaborNest Integration

Esempio di integrazione di CollaborNest in un'applicazione NestJS.

## Features dimostrate

- Setup del gateway Socket.IO
- Integrazione con Redis per presenza e lock
- Adapter custom per risorse DB
- Configurazione e validazione environment
- Test end-to-end

## Struttura

```
src/
├── app.module.ts           # Main module
├── collaboration/          # Collaboration module
│   ├── collaboration.module.ts
│   ├── gateways/
│   │   └── collab.gateway.ts
│   ├── services/
│   │   ├── presence.service.ts
│   │   └── lock.service.ts
│   └── adapters/
│       └── resource.adapter.ts
├── config/                 # Configuration
│   └── validation.schema.ts
└── resources/              # Example resources (patients, notes, etc.)
```

## Setup

```bash
cd examples/nestjs-example
pnpm install
cp .env.example .env
```

## Avvio

```bash
# Start dependencies (from root)
docker-compose up -d

# Run example
pnpm dev
```

L'applicazione sarà disponibile su `http://localhost:3000`.

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

## Client di test

Puoi usare il client Socket.IO di test:

```bash
node scripts/test-client.js
```

O aprire `public/test-client.html` nel browser.

## Endpoints disponibili

- `GET /health` - Health check
- `GET /api` - Swagger documentation
- Socket.IO namespace: `/collab`

## Eventi Socket.IO

Vedi [../../docs/API.md](../../docs/API.md) per la documentazione completa degli eventi.

## Esempio di utilizzo

```typescript
// Client
const socket = io('http://localhost:3000/collab');

// Join a resource as editor
socket.emit('join', {
  resource: 'patient:123',
  mode: 'editor'
}, (ack) => {
  console.log('Joined:', ack);
});

// Request lock
socket.emit('lock', {
  resource: 'patient:123'
}, (ack) => {
  console.log('Lock acquired:', ack);
});
```
