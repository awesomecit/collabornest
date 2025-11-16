# Nginx + Socket.IO — Guida Pratica

**Obiettivo**: Configurare Nginx come reverse-proxy per applicazioni Socket.IO con namespace, supportando WebSocket e fallback polling, con best practices per test E2E.

---

## 📋 Indice

1. [Problemi Ricorrenti](#problemi-ricorrenti)
2. [Regole d'Oro](#regole-doro)
3. [Configurazione Nginx](#configurazione-nginx)
4. [Configurazione Client](#configurazione-client)
5. [Long Polling](#long-polling-engineio)
6. [Test E2E](#test-e2e-stabilità)
7. [Debug e Troubleshooting](#debug-e-troubleshooting)
8. [Checklist Deployment](#checklist-deployment)

---

## 🔴 Problemi Ricorrenti

### 1. Namespace vs Path Confusion

- **Problema**: Client usa URL con namespace (es. `/api/n/ws`) ma Nginx/Socket.IO usano un path engine diverso (default `/socket.io`)
- **Soluzione**: Allineare `path` su client, server e Nginx location

### 2. WebSocket Non Negoziato

- **Problema**: Connessione resta in polling perché mancano header `Upgrade`/`Connection`
- **Soluzione**: Configurare correttamente proxy headers in Nginx

### 3. Buffering e Timeouts

- **Problema**: Nginx bufferizza o chiude connessioni long-lived
- **Soluzione**: Disabilitare `proxy_buffering` e aumentare timeouts

### 4. Sticky Sessions (Polling)

- **Problema**: Richieste successive vanno a backend diversi, lo state si perde
- **Soluzione**: Usare `ip_hash` o sticky cookies, oppure Redis adapter

### 5. CORS per Polling

- **Problema**: Chiamate XHR/POST bloccate da CORS
- **Soluzione**: Configurare CORS headers corretti

### 6. Test E2E Fragili

- **Problema**: Timeout, connessioni che cadono, eventi non ricevuti
- **Soluzione**: Forzare `transports: ['websocket']`, aumentare timeout Jest

---

## ✅ Regole d'Oro

### Contract Chiaro

```
Server namespace: /collaboration
Server path:      /collaboration  (uguale al namespace)
Client URL:       https://collabornest.example.com
Client path:      /collaboration
Nginx location:   /collaboration/
```

### Client Configuration

```javascript
// ✅ SEMPRE specificare path esplicitamente
const socket = io('https://collabornest.example.com', {
  path: '/collaboration', // MUST match server + nginx
  transports: ['websocket'], // Per E2E: solo websocket
  auth: { token: '...' },
});
```

### Server Configuration (NestJS)

```typescript
@WebSocketGateway({
  namespace: '/collaboration',
  path: '/collaboration',         // MUST match client + nginx
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
```

---

## ⚙️ Configurazione Nginx

### Template Completo

```nginx
# Upstream backend
upstream collabornest_backend {
    server 127.0.0.1:3000;
    # Per cluster con sticky session:
    # ip_hash;
    # server 10.0.0.2:3000;
    # server 10.0.0.3:3000;
}

server {
    listen 443 ssl http2;
    server_name collabornest.example.com;

    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # ========================================
    # Socket.IO WebSocket + Polling Location
    # ========================================
    location /collaboration/ {
        proxy_pass http://collabornest_backend;

        # WebSocket/Engine.IO headers (MANDATORY)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";

        # Preserve client information
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering (CRITICAL for WebSocket)
        proxy_buffering off;
        proxy_cache off;
        proxy_ignore_client_abort on;

        # Long timeouts for persistent connections
        proxy_connect_timeout 7d;
        proxy_read_timeout 7d;
        proxy_send_timeout 7d;

        # Chunked transfer encoding
        chunked_transfer_encoding on;

        # CORS headers (if needed for polling)
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization,Content-Type' always;

        # Handle preflight
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Handle exact path without trailing slash
    location = /collaboration {
        proxy_pass http://collabornest_backend;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_buffering off;
        proxy_read_timeout 7d;
        proxy_send_timeout 7d;
    }

    # Other API/static locations...
    location /api/ {
        proxy_pass http://collabornest_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Punti Critici da Non Dimenticare

| Setting                       | Valore          | Perché                               |
| ----------------------------- | --------------- | ------------------------------------ |
| `proxy_http_version`          | `1.1`           | HTTP/1.0 non supporta Upgrade header |
| `proxy_set_header Upgrade`    | `$http_upgrade` | Abilita WebSocket upgrade            |
| `proxy_set_header Connection` | `"Upgrade"`     | Header richiesto per WebSocket       |
| `proxy_buffering`             | `off`           | Evita ritardi su stream dati         |
| `proxy_read_timeout`          | `7d`            | Previene timeout su connessioni idle |
| `proxy_send_timeout`          | `7d`            | Previene drop durante pause lunghe   |

---

## 💻 Configurazione Client

### Esempio Produzione (React/Vue/Angular)

```javascript
import { io } from 'socket.io-client';

const socket = io('https://collabornest.example.com', {
  path: '/collaboration',
  transports: ['websocket', 'polling'], // Fallback su polling
  auth: {
    token: localStorage.getItem('jwt'),
  },
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 20000,
});

// Gestione eventi lifecycle
socket.on('connect', () => {
  console.log('✓ Connected:', socket.id);
});

socket.on('authenticated', data => {
  if (data.success) {
    console.log('✓ Authenticated:', data.user);
  } else {
    console.error('✗ Auth failed:', data.error);
  }
});

socket.on('disconnect', reason => {
  console.warn('Disconnected:', reason);
});

socket.on('connect_error', error => {
  console.error('Connection error:', error.message);
});
```

### Esempio Test E2E (Jest + socket.io-client)

```javascript
import { io } from 'socket.io-client';

describe('Socket.IO E2E Tests', () => {
  let socket;

  beforeAll(done => {
    socket = io('http://localhost:3000', {
      path: '/collaboration',
      transports: ['websocket'], // ⚠️ SOLO websocket per stabilità test
      auth: { token: mockJwtToken },
      reconnection: false, // Evita retry automatici
    });

    socket.on('connect', () => {
      done();
    });

    socket.on('connect_error', done);
  }, 10000); // Timeout 10s

  afterAll(() => {
    if (socket?.connected) socket.disconnect();
  });

  it('should receive room:joined event', done => {
    socket.once('room:joined', data => {
      expect(data.roomId).toBeDefined();
      done();
    });

    socket.emit('room:join', {
      roomId: 'test-room-123',
    });
  });
});
```

---

## 🔄 Long Polling (Engine.IO)

### Come Funziona

1. Client invia richiesta HTTP POST/GET a `/socket.io/?EIO=4&transport=polling`
2. Server risponde con chunk di dati (long-polling)
3. Client apre nuova connessione per inviare messaggi
4. Richieste successive DEVONO andare allo stesso backend (session affinity)

### Problemi con Cluster Multi-Instance

```
Client --> Nginx --> Backend 1 (crea sessione ABC)
Client --> Nginx --> Backend 2 (non trova sessione ABC) ❌
```

### Soluzione 1: Sticky Sessions (IP Hash)

```nginx
upstream collabornest_backend {
    ip_hash;  # Stesso IP client → stesso backend
    server 10.0.0.1:3000;
    server 10.0.0.2:3000;
}
```

### Soluzione 2: Redis Adapter (Migliore per Produzione)

```typescript
// Server-side (NestJS)
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

export class RedisIoAdapter extends IoAdapter {
  async connectToRedis(): Promise<void> {
    const pubClient = createClient({ url: 'redis://localhost:6379' });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: any): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
```

### Soluzione 3: Disabilitare Polling (Solo WebSocket)

```javascript
// Client
const socket = io('https://collabornest.example.com', {
  transports: ['websocket'], // NO polling
});
```

```typescript
// Server
@WebSocketGateway({
  transports: ['websocket'],  // NO polling
})
```

---

## 🧪 Test E2E — Stabilità

### Best Practices

#### 1. Forzare WebSocket

```javascript
transports: ['websocket']; // Elimina variabili legate a polling
```

#### 2. Aumentare Timeout Jest

```javascript
// jest.e2e.config.js
module.exports = {
  testTimeout: 30000, // 30 secondi per test E2E
};
```

#### 3. Backend Singolo per Test

```bash
# Avvia solo 1 istanza su porta dedicata
npm run start:dev  # port 3000
```

#### 4. Aspettare Connessione

```javascript
beforeAll(done => {
  socket = io(URL, options);

  socket.on('connect', () => {
    done();
  });

  socket.on('connect_error', error => {
    done(error);
  });
}, 10000);
```

#### 5. Cleanup Connessioni

```javascript
afterEach(() => {
  if (socket1?.connected) socket1.disconnect();
  if (socket2?.connected) socket2.disconnect();
});

afterAll(async () => {
  await app.close(); // Chiudi server NestJS
});
```

### Esempio Test Multi-Client

```javascript
it('should broadcast to other users in room', done => {
  let user1Received = false;
  let user2Received = false;

  socket1.on('user:joined', data => {
    user1Received = true;
    if (user2Received) done();
  });

  socket2.on('room:joined', data => {
    user2Received = true;
    if (user1Received) done();
  });

  // User 1 già in room
  socket1.emit('room:join', { roomId: 'test-room-123' });

  // User 2 join → dovrebbe triggerare user:joined per socket1
  setTimeout(() => {
    socket2.emit('room:join', { roomId: 'test-room-123' });
  }, 100);
}, 15000);
```

---

## 🐛 Debug e Troubleshooting

### 1. Verificare Header WebSocket

```bash
# Nginx access log custom format
log_format websocket '$remote_addr - $remote_user [$time_local] '
                     '"$request" $status $body_bytes_sent '
                     '"$http_upgrade" "$http_connection"';

access_log /var/log/nginx/websocket.log websocket;
```

Cerca:

- `$http_upgrade`: deve essere `"websocket"`
- `$http_connection`: deve essere `"Upgrade"`

### 2. Test Connessione WebSocket

```bash
# Con websocat
websocat -v ws://collabornest.example.com/collaboration

# Con wscat
wscat -c "ws://collabornest.example.com/collaboration"
```

### 3. Controllare Timeout Nginx

```bash
# Verifica config attiva
nginx -T | grep -A 5 "location /collaboration"

# Cerca:
# - proxy_read_timeout
# - proxy_send_timeout
# - proxy_buffering
```

### 4. Log Server-Side (NestJS)

```typescript
// Aggiungi logging dettagliato
handleConnection(client: Socket): void {
  this.logger.log(`[WebSocket] Client attempting to connect: ${client.id}`);
  this.logger.log(`[WebSocket] Headers: ${JSON.stringify(client.handshake.headers)}`);
  this.logger.log(`[WebSocket] Transport: ${client.conn.transport.name}`);

  // ... autenticazione

  this.logger.log(`[WebSocket] User authenticated: ${user.userId}`);
}
```

### 5. Network Debug (tcpdump)

```bash
# Cattura traffico WebSocket
sudo tcpdump -i any -A 'port 3000 and (tcp[tcpflags] & tcp-syn != 0)'

# Filtra solo upgrade requests
sudo tcpdump -i any -A 'port 3000' | grep -i upgrade
```

### 6. Client-Side Debug

```javascript
// Socket.IO debug mode
localStorage.debug = 'socket.io-client:*';

const socket = io(URL, {
  transports: ['websocket'],
  // ... altre options
});

// Tutti i log verranno stampati in console
```

---

## 📊 Errori Comuni e Fix Rapidi

| Sintomo                         | Causa Probabile                   | Fix                                 |
| ------------------------------- | --------------------------------- | ----------------------------------- |
| Connessione cade dopo 60s       | `proxy_read_timeout` troppo basso | Aumenta a 7d o 86400s               |
| Client resta in polling         | Manca header `Upgrade`            | Verifica `proxy_set_header Upgrade` |
| Eventi non arrivano             | Buffering abilitato               | `proxy_buffering off`               |
| Auth fallisce                   | Path sbagliato                    | Allinea path client/server/nginx    |
| Polling non funziona su cluster | Sticky session mancante           | Aggiungi `ip_hash` o Redis adapter  |
| Test E2E timeout                | Connessione non completa          | Forzare `transports: ['websocket']` |
| CORS error su polling           | Header mancanti                   | Aggiungi CORS headers in Nginx      |
| JWT invalido                    | Token scaduto o malformato        | Verifica exp claim e formato        |

---

## ✅ Checklist Deployment

### Pre-Deploy

- [ ] Allineare `path` su client, server e Nginx (`/collaboration`)
- [ ] Verificare `namespace` server matches URL client
- [ ] Configurare sticky sessions (ip_hash) o Redis adapter per cluster
- [ ] Testare CORS headers per polling
- [ ] Verificare certificati SSL (WebSocket su https richiede wss://)

### Nginx

- [ ] `proxy_http_version 1.1`
- [ ] `proxy_set_header Upgrade $http_upgrade`
- [ ] `proxy_set_header Connection "Upgrade"`
- [ ] `proxy_buffering off`
- [ ] `proxy_read_timeout >= 86400s` (1 giorno)
- [ ] `proxy_send_timeout >= 86400s`
- [ ] `chunked_transfer_encoding on`

### Backend

- [ ] Path configurato correttamente (`path: '/collaboration'`)
- [ ] Logging abilitato per connection/disconnect events
- [ ] CORS configurato se serve polling cross-origin
- [ ] Heartbeat configurato (pingInterval/pingTimeout)
- [ ] Max connections per user impostato

### Client

- [ ] `path` esplicitamente specificato
- [ ] `transports` configurati (websocket + polling o solo websocket)
- [ ] Gestione eventi `connect_error` e `disconnect`
- [ ] Retry logic su auth failure
- [ ] Token JWT valido e non scaduto

### Test E2E

- [ ] `transports: ['websocket']` per stabilità
- [ ] Timeout Jest >= 30s
- [ ] Backend singolo o sticky sessions attivate
- [ ] Cleanup connessioni in `afterEach`/`afterAll`
- [ ] Log dettagliato abilitato per debug

---

## 📚 Risorse Utili

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Engine.IO Protocol](https://socket.io/docs/v4/engine-io-protocol/)
- [Nginx WebSocket Proxying](https://nginx.org/en/docs/http/websocket.html)
- [NestJS WebSocket Gateway](https://docs.nestjs.com/websockets/gateways)

---

## 🆘 Supporto

Se hai problemi non risolti da questa guida:

1. Verifica log Nginx (`/var/log/nginx/error.log`)
2. Abilita debug Socket.IO client (`localStorage.debug = 'socket.io-client:*'`)
3. Controlla log backend per eventi connection/authenticated
4. Usa `tcpdump` per verificare traffico WebSocket
5. Testa con `websocat` per isolare problema client/server

---

**Versione documento**: 1.0  
**Ultimo aggiornamento**: 16 Novembre 2025  
**Testato con**: Socket.IO v4.8.1, Nginx 1.24.x, NestJS 10.x  
**Progetto**: CollaborNest - Real-time Collaboration Platform
