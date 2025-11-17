# QUICKSTART - Backend Setup per UI Developer (15 minuti)

> **Target**: Junior UI developer che deve tirare su il backend CollaborNest in locale per sviluppare il frontend.

## Obiettivo

Avviare il **backend NestJS con WebSocket** funzionante in locale **senza database**, pronto per connessioni frontend.

**Cosa otterrai:**

- ✅ Backend su `http://localhost:3000`
- ✅ WebSocket Gateway su `ws://localhost:3000/ws/socket.io`
- ✅ Presence tracking (multi-user awareness) funzionante
- ✅ Test automatici per validare setup

---

## Prerequisiti (2 minuti)

Verifica di avere installato:

```bash
node --version  # Deve essere >= 18.x
npm --version   # Deve essere >= 9.x
```

**Se mancano:**

- **Node.js**: Scarica da [nodejs.org](https://nodejs.org/) (versione LTS)
- Include automaticamente npm

---

## Step 1: Clone e Installazione (3 minuti)

```bash
# 1. Clone repository
git clone https://github.com/your-org/collabornest.git
cd collabornest

# 2. Installa dipendenze
npm install

# Output atteso:
# added XXX packages in 30-60s
```

**Cosa è successo?**

- Installate tutte le dipendenze da `package.json`
- Git hooks configurati automaticamente (Husky)
- Cartella `node_modules/` creata (~200MB)

---

## Step 2: Avvio Database (Redis & PostgreSQL) - Opzionale (3 minuti)

> ⚠️ **Redis richiesto per Distributed Locks** (BE-001.3). PostgreSQL opzionale per sviluppo.

### Opzione A: Con Docker (Raccomandato)

```bash
# Avvia Redis + PostgreSQL + RedisInsight
docker compose up -d

# Verifica stato
docker ps
# Dovresti vedere:
# - app-redis (porta 6379)
# - app-postgres-db (porta 5432)
# - app-redisinsight (porta 5540)
```

### Opzione B: Solo Redis (Locks funzionanti)

```bash
# Solo Redis (senza PostgreSQL)
docker compose up -d redis

# O installa Redis localmente
brew install redis        # macOS
sudo apt install redis    # Ubuntu/Debian
```

### 🔍 RedisInsight - GUI per Redis (Sviluppo)

**Accedi a**: `http://localhost:5540`

**Configurazione connessione**:

- **Host**: `redis` (nome container, NON localhost!)
- **Port**: `6379`
- **Name**: `CollaborNest Local`

**Cosa puoi vedere**:

- Lock keys in tempo reale: `lock:doc:123:main`
- TTL attivo dei lock (5 minuti default)
- Heartbeat updates ogni 60s
- Monitor comandi Redis live

**Comandi utili**:

```redis
# Vedi tutti i lock attivi
KEYS lock:*

# Dettaglio lock specifico
GET lock:doc:123:main
TTL lock:doc:123:main

# Monitor in real-time
MONITOR
```

---

## Step 3: Configurazione Ambiente (2 minuti)

**Crea file `.env` dalla template:**

```bash
cp .env.example .env
```

**Modifica `.env` con editor di testo** (VS Code, nano, vim):

```bash
# Porta del server
PORT=3000

# Database - IMPORTANTE: DISABILITATO per sviluppo rapido
DATABASE_ENABLED=false

# JWT Secret (usa questo per test)
JWT_SECRET=your-secret-key-here

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

> ⚠️ **CRITICO**: `DATABASE_ENABLED=false` permette di far partire il backend **senza PostgreSQL installato**. Il WebSocket Gateway funziona lo stesso!

---

## Step 4: Avvio Server (2 minuti)

```bash
npm run start:dev
```

**Output atteso (entro 10 secondi):**

```bash
[Nest] INFO  [NestFactory] Starting Nest application...
[Nest] INFO  [InstanceLoader] AppModule dependencies initialized
[Nest] INFO  [WebSocketGateway] WebSocket Gateway initialized on path: /ws/socket.io
[Nest] INFO  [NestApplication] Nest application successfully started
[Nest] INFO  Application is running on: http://localhost:3000
```

✅ **Il backend è pronto!** Lascia questo terminale aperto.

---

## Step 5: Test Connessione WebSocket (3 minuti)

### Opzione A: Test Rapido (Browser Console)

1. Apri **Chrome DevTools** (F12)
2. Vai su tab **Console**
3. Copia-incolla questo codice:

```javascript
// Carica Socket.IO client
const script = document.createElement('script');
script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
document.head.appendChild(script);

// Dopo 1 secondo, connetti al backend
setTimeout(() => {
  const socket = io('http://localhost:3000/collaboration', {
    path: '/ws/socket.io',
    transports: ['websocket', 'polling'],
    auth: {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMSIsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsImlhdCI6MTczMTc1MzYwMCwiZXhwIjoyODk0OTUzNjAwfQ.6xHmJR5HkL2zYvhT3jX8YxGxX2aQZ3Fqp0RzLxYxGxM',
    },
  });

  socket.on('connected', data => {
    console.log('✅ WebSocket connesso!', data);
  });

  socket.on('connect_error', error => {
    console.error('❌ Errore:', error.message);
  });
}, 1000);
```

**Output atteso nella console:**

```bash
✅ WebSocket connesso! { userId: 'test-user-1', socketId: 'xyz123...' }
```

### Opzione B: Test Completo (BDD Tests)

```bash
# Apri un NUOVO terminale (lascia start:dev aperto)
npm run test:bdd
```

**Output atteso:**

```bash
Running BDD tests...

✅ BE-001.1 Connection Management (6 scenarios) - PASS
✅ BE-001.2 Presence Tracking (7 scenarios) - PASS

Summary: 13/13 scenarios passed in 5.99s
```

---

## Step 6: Integrazione con Frontend

### Setup React/Vue/Angular

**1. Installa Socket.IO client nel progetto frontend:**

```bash
# Nel tuo progetto UI
npm install socket.io-client
```

**2. Crea service WebSocket (`websocket.service.ts`):**

```typescript
import { io, Socket } from 'socket.io-client';

export class WebSocketService {
  private socket: Socket | null = null;

  connect(jwtToken: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io('http://localhost:3000/collaboration', {
        path: '/ws/socket.io',
        transports: ['websocket', 'polling'],
        auth: { token: jwtToken },
      });

      this.socket.on('connected', data => {
        console.log('Connected:', data);
        resolve();
      });

      this.socket.on('connect_error', error => {
        reject(error);
      });
    });
  }

  joinResource(resourceId: string, mode: 'editor' | 'viewer'): void {
    this.socket?.emit('resource:join', { resourceId, mode });
  }

  onUserJoined(callback: (data: any) => void): void {
    this.socket?.on('user:joined', callback);
  }

  onUserLeft(callback: (data: any) => void): void {
    this.socket?.on('user:left', callback);
  }

  leaveResource(resourceId: string): void {
    this.socket?.emit('resource:leave', { resourceId });
  }

  disconnect(): void {
    this.socket?.disconnect();
  }
}
```

**3. Esempio React Hook:**

```typescript
import { useEffect, useState } from 'react';
import { WebSocketService } from './websocket.service';

export function useCollaboration(resourceId: string, jwtToken: string) {
  const [users, setUsers] = useState<any[]>([]);
  const ws = new WebSocketService();

  useEffect(() => {
    ws.connect(jwtToken).then(() => {
      ws.joinResource(resourceId, 'editor');
    });

    ws.onUserJoined(data => {
      setUsers(prev => [...prev, data.user]);
    });

    ws.onUserLeft(data => {
      setUsers(prev => prev.filter(u => u.userId !== data.userId));
    });

    return () => ws.disconnect();
  }, [resourceId, jwtToken]);

  return { users };
}
```

**4. Uso nel componente:**

```tsx
function DocumentEditor({ documentId }: { documentId: string }) {
  const jwt = 'your-jwt-token-here'; // Ottieni dal tuo auth service
  const { users } = useCollaboration(documentId, jwt);

  return (
    <div>
      <h1>Document Editor</h1>
      <div>
        <h3>Users online: {users.length}</h3>
        <ul>
          {users.map(user => (
            <li key={user.userId}>
              {user.userId} ({user.mode})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

---

## Troubleshooting

### ❌ Problema: Server non parte con ECONNREFUSED

**Causa**: Backend cerca di connettersi a PostgreSQL che non è installato.

**Soluzione**: Verifica `.env`:

```bash
DATABASE_ENABLED=false  # DEVE essere false
```

Riavvia server:

```bash
npm run start:dev
```

---

### ❌ Problema: WebSocket error "JWT_INVALID"

**Causa**: Token JWT non valido o `JWT_SECRET` diverso tra backend e frontend.

**Soluzione 1** - Usa token di test (valido fino al 2061):

```javascript
const TEST_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItMSIsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsImlhdCI6MTczMTc1MzYwMCwiZXhwIjoyODk0OTUzNjAwfQ.6xHmJR5HkL2zYvhT3jX8YxGxX2aQZ3Fqp0RzLxYxGxM';
```

**Soluzione 2** - Genera nuovo token con stesso secret:

```javascript
// Node.js REPL o script
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { userId: 'your-user-id', email: 'user@example.com' },
  'your-secret-key-here', // DEVE essere uguale a JWT_SECRET in .env
  { expiresIn: '7d' },
);
console.log(token);
```

---

### ❌ Problema: Porta 3000 già occupata

**Soluzione**: Cambia porta in `.env`:

```bash
PORT=3001  # Usa porta diversa
```

Aggiorna URL frontend:

```typescript
io('http://localhost:3001/collaboration', {
  /* ... */
});
```

---

### ❌ Problema: CORS error da frontend

**Causa**: Frontend su dominio diverso (es. `http://localhost:8080`).

**Soluzione**: CORS è già configurato, ma verifica che il frontend usi path corretto:

```typescript
// ✅ CORRETTO
const socket = io('http://localhost:3000/collaboration', {
  path: '/ws/socket.io', // Path obbligatorio
  transports: ['websocket', 'polling'],
});

// ❌ SBAGLIATO (manca path)
const socket = io('http://localhost:3000/collaboration');
```

---

## Comandi Utili

```bash
# Avvia server in sviluppo (con hot-reload)
npm run start:dev

# Avvia server in debug mode
npm run start:debug

# Esegui tutti i test BDD (13 scenari)
npm run test:bdd

# Esegui solo test connessione (6 scenari)
npm run test:bdd:be001-1

# Esegui solo test presence tracking (7 scenari)
npm run test:bdd:be001-2

# Verifica salute server
curl http://localhost:3000/health

# Build per produzione
npm run build
```

---

## API WebSocket Disponibili

### Eventi dopo connessione

| Event            | Direzione       | Payload                                            | Descrizione                              |
| ---------------- | --------------- | -------------------------------------------------- | ---------------------------------------- |
| `resource:join`  | Client → Server | `{ resourceId: string, mode: 'editor'\|'viewer' }` | Entra in una risorsa (documento, foglio) |
| `resource:leave` | Client → Server | `{ resourceId: string }`                           | Esci da una risorsa                      |
| `user:joined`    | Server → Client | `{ resourceId, user: { socketId, userId, mode } }` | Nuovo utente entrato                     |
| `user:left`      | Server → Client | `{ resourceId, userId }`                           | Utente uscito                            |

### Esempio Flusso Completo

```typescript
// 1. Connessione
socket.on('connected', data => {
  console.log('Connesso:', data.userId);

  // 2. Entra in risorsa
  socket.emit('resource:join', {
    resourceId: 'doc-123',
    mode: 'editor',
  });
});

// 3. Ascolta nuovi utenti
socket.on('user:joined', data => {
  console.log('Nuovo utente:', data.user.userId);
  // Aggiorna UI con presenza multi-user
});

// 4. Ascolta utenti che escono
socket.on('user:left', data => {
  console.log('Utente uscito:', data.userId);
  // Rimuovi dalla UI
});

// 5. Al cambio pagina/documento
socket.emit('resource:leave', { resourceId: 'doc-123' });
```

---

## Documentazione Completa

- **API WebSocket per UI Team**: [UI_TEAM_WEBSOCKET_API.md](./UI_TEAM_WEBSOCKET_API.md)
- **BDD Test Coverage**: [BDD_TEST_COVERAGE.md](./BDD_TEST_COVERAGE.md)
- **Guida Contribuzione Backend**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Specifica Progetto Completa**: [PROJECT.md](./PROJECT.md)

---

## Prossimi Passi

1. ✅ Backend funzionante in locale
2. ✅ WebSocket connesso
3. 🎯 **Implementa UI**: Segui esempi in [UI_TEAM_WEBSOCKET_API.md](./UI_TEAM_WEBSOCKET_API.md)
4. 🎯 **Test multi-user**: Apri 2 tab browser, connetti con user diversi, verifica `user:joined`
5. 🎯 **Integra autenticazione reale**: Sostituisci token di test con JWT dal tuo auth service

---

## Supporto

- **Bug/Issue**: Apri issue su GitHub repository
- **Domande sviluppo**: Vedi [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Security**: Vedi [SECURITY.md](../SECURITY.md)

---

**✅ Setup completato!** Ora puoi sviluppare il frontend con backend WebSocket funzionante in locale.
