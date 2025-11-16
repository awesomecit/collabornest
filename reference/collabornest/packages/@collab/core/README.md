# @collab/core

Core socket logic e networking per CollaborNest.

## Features

- Gateway Socket.IO con namespace `/collab`
- Gestione rooms per risorse e sotto-risorse
- ACK pattern per operazioni critiche
- Recovery e gestione disconnessioni
- Integrazione con Redis per pub/sub

## Installazione

```bash
pnpm add @collab/core
```

## Utilizzo base

```typescript
import { CollabGateway } from '@collab/core';
import { Module } from '@nestjs/common';

@Module({
  providers: [CollabGateway],
})
export class AppModule {}
```

## Configurazione

```typescript
const config = {
  namespace: '/collab',
  redis: {
    host: 'localhost',
    port: 6379,
  },
};
```

## Eventi supportati

Vedi [API.md](../../../docs/API.md) per la documentazione completa.

## Development

```bash
pnpm dev     # watch mode
pnpm build   # build production
pnpm test    # run tests
```
