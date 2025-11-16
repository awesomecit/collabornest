# WebSocket API - Guida per Team UI

> **Data**: 16 Novembre 2025
> **Status**: ✅ BE-001.1 e BE-001.2 completati e testati
> **Testing**: 13/13 scenari BDD PASS (vedi `npm run test:bdd`)

---

## 🎯 Cosa puoi implementare ORA

Il backend WebSocket è **production-ready** per queste funzionalità:

✅ **BE-001.1: Connection Management** (Week 1-2)

- Connessione WebSocket con autenticazione JWT
- Gestione pool connessioni (max 5 per utente)
- Heartbeat automatico (ping/pong)
- Graceful shutdown notification

✅ **BE-001.2: Presence Tracking** (Week 2-3)

- Join/Leave risorse (documenti, pagine, form)
- Tracking utenti attivi in tempo reale
- Broadcast multi-utente (notifiche join/leave)
- Gestione modalità editor/viewer
- Cleanup automatico su disconnect

⏳ **BE-001.3: Distributed Locks** (Week 3-4) - IN ROADMAP
⏳ **BE-001.4: Y.js CRDT Sync** (Week 4-6) - IN ROADMAP
⏳ **BE-001.5: RabbitMQ Broadcasting** (Week 5-6) - IN ROADMAP

---

## 🔌 Connessione WebSocket

### Configurazione Socket.IO Client

```typescript
import { io, Socket } from 'socket.io-client';

const WS_URL = 'http://localhost:3000/collaboration'; // Namespace
const WS_PATH = '/ws/socket.io'; // Custom path (required!)

const socket: Socket = io(WS_URL, {
  path: WS_PATH,
  transports: ['websocket', 'polling'], // Polling fallback
  auth: {
    token: getJwtToken(), // JWT dal tuo auth service
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});
```

### Eventi di connessione

```typescript
// ✅ Connessione riuscita
socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
});

// ❌ Errore di connessione (JWT invalid/expired)
socket.on('connect_error', error => {
  console.error('❌ Connection failed:', error.message);
  // Possibili errori:
  // - "JWT_MISSING" → Token non fornito
  // - "JWT_INVALID: JWT validation failed: jwt expired" → Token scaduto
  // - "JWT_INVALID: JWT validation failed: invalid signature" → Token malformato
});

// 🔌 Disconnessione
socket.on('disconnect', reason => {
  console.log('Disconnected:', reason);
  // reason può essere:
  // - "io server disconnect" → Server ha chiuso la connessione
  // - "io client disconnect" → Client ha chiamato socket.disconnect()
  // - "ping timeout" → Heartbeat fallito
  // - "transport close" → Errore di rete
});

// 🛑 Server shutdown graceful
socket.on('SERVER_SHUTDOWN', data => {
  console.warn('⚠️ Server shutting down:', data);
  // { message: "Server is shutting down. Please reconnect.", timestamp: "..." }
  // UI: Mostra notifica "Server in manutenzione, riconnessione in corso..."
});
```

---

## 👥 Presence Tracking (BE-001.2)

### Join Resource (Entrare in un documento/pagina)

```typescript
interface ResourceJoinPayload {
  resourceId: string; // Es: "document:123", "page:/patient/456", "form:789"
  mode: 'editor' | 'viewer'; // Modalità di accesso
}

interface ResourceJoinedResponse {
  resourceId: string;
  userId: string;
  success: boolean;
  joinedAt: string; // ISO 8601 timestamp
  users: UserPresence[]; // Lista utenti già presenti
  message?: string; // Presente solo se success=false
}

interface UserPresence {
  userId: string;
  username: string;
  email: string;
  socketId: string;
  joinedAt: string;
  mode: 'editor' | 'viewer';
}

// 📤 JOIN: Entro nel documento "patient-123" come editor
socket.emit('resource:join', {
  resourceId: 'document:patient-123',
  mode: 'editor',
});

// 📥 RESPONSE: Ricevo conferma + lista utenti già presenti
socket.on('resource:joined', (data: ResourceJoinedResponse) => {
  if (data.success) {
    console.log('✅ Joined resource:', data.resourceId);
    console.log('👥 Current users:', data.users);

    // UI: Mostra lista utenti attivi
    updateUserList(data.users);
  } else {
    console.warn('⚠️ Join failed:', data.message);
    // Possibili errori:
    // - "You have already joined this resource." (duplicate join)
  }
});
```

### Leave Resource (Uscire da un documento/pagina)

```typescript
interface ResourceLeavePayload {
  resourceId: string;
}

interface ResourceLeftResponse {
  resourceId: string;
  userId: string;
  success: boolean;
  message?: string;
}

// 📤 LEAVE: Esco dal documento
socket.emit('resource:leave', {
  resourceId: 'document:patient-123',
});

// 📥 RESPONSE: Conferma uscita
socket.on('resource:left', (data: ResourceLeftResponse) => {
  if (data.success) {
    console.log('✅ Left resource:', data.resourceId);
  } else {
    console.warn('⚠️ Leave failed:', data.message);
    // Errore possibile: "You are not in this resource. Cannot leave."
  }
});
```

### Broadcast Events (Notifiche multi-utente)

```typescript
interface UserJoinedNotification {
  resourceId: string;
  userId: string;
  username: string;
  email: string;
  socketId: string;
  joinedAt: string;
  mode: 'editor' | 'viewer';
}

interface UserLeftNotification {
  resourceId: string;
  userId: string;
  username: string;
  email: string;
  reason?: 'disconnect' | 'explicit'; // Come ha lasciato
}

// 📥 USER_JOINED: Qualcuno entra nel documento
socket.on('user:joined', (data: UserJoinedNotification) => {
  console.log('👤 User joined:', data.username, 'as', data.mode);

  // UI: Aggiungi utente alla lista
  addUserToList({
    id: data.userId,
    name: data.username,
    mode: data.mode,
    joinedAt: data.joinedAt,
  });

  // UI: Mostra notifica toast
  showNotification(`${data.username} ha aperto il documento`);
});

// 📥 USER_LEFT: Qualcuno esce dal documento
socket.on('user:left', (data: UserLeftNotification) => {
  console.log('👤 User left:', data.username);

  // UI: Rimuovi utente dalla lista
  removeUserFromList(data.userId);

  // UI: Mostra notifica se disconnect improvviso
  if (data.reason === 'disconnect') {
    showNotification(`${data.username} si è disconnesso`);
  }
});
```

---

## 🎬 Scenari UI Completi

### Scenario 1: Real-Time Presence in Surgical Operation Form

```typescript
import { io, Socket } from 'socket.io-client';

class SurgicalOperationPresence {
  private socket: Socket;
  private currentResourceId: string | null = null;

  constructor(private jwtToken: string) {
    this.socket = io('http://localhost:3000/collaboration', {
      path: '/ws/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token: jwtToken },
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      // UI: Hide "Connecting..." spinner
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      // UI: Show error "Impossibile connettersi. Verifica la tua sessione."
      if (error.message.includes('JWT')) {
        this.redirectToLogin();
      }
    });

    this.socket.on('resource:joined', (data) => {
      if (data.success) {
        console.log('📄 Joined resource:', data.resourceId);
        this.currentResourceId = data.resourceId;
        this.renderUserList(data.users);
      }
    });

    this.socket.on('user:joined', (data) => {
      // UI: Aggiungi badge utente attivo
      this.addUserBadge({
        id: data.userId,
        name: data.username,
        mode: data.mode,
        avatar: this.getAvatarUrl(data.email),
      });

      // UI: Mostra toast notification
      this.showToast(`${data.username} sta visualizzando il documento`, 'info');
    });

    this.socket.on('user:left', (data) => {
      // UI: Rimuovi badge utente
      this.removeUserBadge(data.userId);

      if (data.reason === 'disconnect') {
        this.showToast(`${data.username} si è disconnesso`, 'warning');
      }
    });

    this.socket.on('SERVER_SHUTDOWN', (data) => {
      // UI: Mostra banner "Server in manutenzione"
      this.showMaintenanceBanner(data.message);
    });
  }

  // 📤 JOIN: Entro nel modulo operatorio
  public joinOperation(operationId: string, mode: 'editor' | 'viewer') {
    const resourceId = `operation:${operationId}`;

    this.socket.emit('resource:join', {
      resourceId,
      mode,
    });
  }

  // 📤 LEAVE: Esco dal modulo
  public leaveOperation() {
    if (this.currentResourceId) {
      this.socket.emit('resource:leave', {
        resourceId: this.currentResourceId,
      });
      this.currentResourceId = null;
    }
  }

  // 🔌 CLEANUP: Chiusura componente
  public disconnect() {
    this.leaveOperation();
    this.socket.disconnect();
  }

  private renderUserList(users: UserPresence[]) {
    // UI: Renderizza lista utenti attivi
    const listHtml = users.map(user => `
      <div class="user-badge ${user.mode}">
        <img src="${this.getAvatarUrl(user.email)}" alt="${user.username}" />
        <span>${user.username}</span>
        <span class="badge">${user.mode === 'editor' ? '✏️' : '👁️'}</span>
      </div>
    `).join('');

    document.getElementById('active-users').innerHTML = listHtml;
  }

  private addUserBadge(user: any) { /* ... */ }
  private removeUserBadge(userId: string) { /* ... */ }
  private showToast(message: string, type: string) { /* ... */ }
  private showMaintenanceBanner(message: string) { /* ... */ }
  private redirectToLogin() { window.location.href = '/login'; }
  private getAvatarUrl(email: string) { return `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}`; }
}

// 🎯 UTILIZZO in React Component
import { useEffect, useRef } from 'react';

function SurgicalOperationPage({ operationId, userRole }: Props) {
  const presenceRef = useRef<SurgicalOperationPresence | null>(null);

  useEffect(() => {
    const jwtToken = localStorage.getItem('jwt_token');
    if (!jwtToken) return;

    // Inizializza presenza WebSocket
    presenceRef.current = new SurgicalOperationPresence(jwtToken);

    // Join alla risorsa
    const mode = userRole === 'surgeon' ? 'editor' : 'viewer';
    presenceRef.current.joinOperation(operationId, mode);

    // Cleanup on unmount
    return () => {
      presenceRef.current?.disconnect();
    };
  }, [operationId, userRole]);

  return (
    <div className="operation-page">
      <div id="active-users" className="user-list"></div>
      {/* Rest of UI */}
    </div>
  );
}
```

---

## 🧪 Testing con i tuoi dati

### Eseguire i test BDD per vedere esempi reali

```bash
# Test connessione e autenticazione
npm run test:bdd:connection

# Test presenza e notifiche multi-utente
npm run test:bdd:presence

# Tutti i test
npm run test:bdd
```

**Output atteso**: 13/13 scenari PASS con log dettagliati di ogni evento WebSocket.

### Testare manualmente con Browser DevTools

```javascript
// Apri console browser su http://localhost:3000
const socket = io('http://localhost:3000/collaboration', {
  path: '/ws/socket.io',
  transports: ['websocket', 'polling'],
  auth: {
    token: 'YOUR_JWT_TOKEN_HERE', // Ottienilo dal tuo login
  },
});

socket.on('connect', () => console.log('✅ Connected:', socket.id));
socket.on('connect_error', err => console.error('❌ Error:', err.message));

// Test join resource
socket.emit('resource:join', { resourceId: 'test:123', mode: 'editor' });
socket.on('resource:joined', data => console.log('📄 Joined:', data));

// Test notifiche multi-utente (apri in 2 tab)
socket.on('user:joined', data => console.log('👤 User joined:', data));
socket.on('user:left', data => console.log('👤 User left:', data));
```

---

## ⚙️ Configurazione ambiente

### Variabili d'ambiente necessarie

```bash
# .env file
DATABASE_ENABLED=false  # ⚠️ Impostare su false per WebSocket-only mode

# WebSocket
WEBSOCKET_ENABLED=true
WEBSOCKET_PORT=3001  # Non usato (usa PORT generale)
WEBSOCKET_NAMESPACE=/collaboration
WEBSOCKET_PING_INTERVAL=25000  # 25 secondi
WEBSOCKET_PING_TIMEOUT=20000   # 20 secondi
WEBSOCKET_MAX_CONNECTIONS_PER_USER=5

# JWT (usa lo stesso secret del tuo auth service!)
JWT_SECRET=your_super_secure_jwt_secret_32_characters_minimum
JWT_ISSUER=collabornest
JWT_AUDIENCE=collabornest-api

# Server
PORT=3000
NODE_ENV=development
```

### Avviare il server

```bash
# Development mode (con hot-reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Health check
curl http://localhost:3000/health
```

---

## 🚫 Limitazioni attuali

### ❌ NON ancora implementato (in ROADMAP)

1. **Distributed Locks (BE-001.3)** - Settimana 3-4
   - Lock su campi form per editing esclusivo
   - Prevenzione conflitti simultanei
   - Lock TTL e renewal

2. **Y.js CRDT Sync (BE-001.4)** - Settimana 4-6
   - Editing collaborativo real-time (Google Docs-style)
   - Conflict-free merge automatico
   - Sincronizzazione state incrementale

3. **RabbitMQ Broadcasting (BE-001.5)** - Settimana 5-6
   - Broadcasting cross-instance (load balancing)
   - Attualmente: Single instance only

4. **Redis Persistence (BE-001.2+)** - Settimana 3-7
   - Presenza persistente (sopravvive a restart)
   - Attualmente: In-memory only (perdi presenza su restart)

### ⚠️ Comportamenti da gestire lato UI

- **Max 5 connessioni per utente**: Se l'utente apre 6+ tab, la 6a viene rifiutata
- **Reconnection automatica**: Socket.IO gestisce riconnessioni, ma UI deve mostrare stato
- **Heartbeat timeout**: Se client non risponde a ping per 20s, viene disconnesso
- **Server shutdown**: Gateway emette `SERVER_SHUTDOWN` prima di chiudere (gestisci gracefully)

---

## 📚 Risorse aggiuntive

- **EPIC completo**: `/docs/project/EPIC-001-websocket-gateway.md`
- **Architettura progetto**: `/docs/PROJECT.md` Sezione 3
- **Test BDD source**: `/scripts/bdd-tests/be001-*.test.js`
- **Gateway implementation**: `/src/websocket-gateway/`
- **Socket.IO docs**: <https://socket.io/docs/v4/>

---

## 🤝 Support

**Domande?** Contatta il team backend:

- Antonio Cittadino (WebSocket Gateway Lead)
- Slack: `#backend-websocket`
- Issue tracker: GitHub Issues con label `websocket`

**Bug o problemi?** Aprire issue su GitHub con:

1. Log del browser console (eventi Socket.IO)
2. Log del server (`/tmp/nest-bdd-server.log`)
3. JWT token (oscurato per sicurezza)
4. Scenario riproducibile

---

**Last updated**: November 16, 2025
**Next update**: Dopo completamento BE-001.3 (Distributed Locks)
