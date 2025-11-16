# WebSocket Gateway - Documento Completo di Implementazione

**Progetto:** SISOS WebSocket Gateway - Collaborazione Real-Time  
**Issue:** SIS-582  
**Data:** 13 Novembre 2025  
**Versione:** 1.0

---

## 📋 Indice

1. [Implementazioni Completate](#1-implementazioni-completate)
2. [Contratto Interfacce BE/UI](#2-contratto-interfacce-beui)
3. [Flussi di Integrazione](#3-flussi-di-integrazione)
4. [Use Case e Scenari](#4-use-case-e-scenari)
5. [Edge Case e Gestione Errori](#5-edge-case-e-gestione-errori)
6. [Scenari Test BDD](#6-scenari-test-bdd)
7. [Prossimi Step](#7-prossimi-step)

---

## 1. Implementazioni Completate

### 1.1 Infrastructure Layer (100% ✅)

#### Gateway Base con Lifecycle
**Cosa fa:** Inizializza il server WebSocket, gestisce connessioni e disconnessioni.
**Beneficio:** Foundation per tutte le funzionalità real-time, ready for production.

#### Autenticazione JWT
**Cosa fa:** Verifica l'identità degli utenti tramite token Keycloak all'handshake.
**Beneficio:** Solo utenti autenticati possono connettersi. Sicurezza garantita.

#### Gestione Disconnessioni Avanzata
**Cosa fa:** Distingue tra disconnessioni volontarie, timeout di rete ed errori.
**Beneficio:** Log strutturati per debugging production, capire perché gli utenti si disconnettono.

#### Heartbeat Automatico
**Cosa fa:** Verifica ogni 25 secondi che la connessione sia ancora attiva (ping/pong).
**Beneficio:** Rileva connessioni morte e le pulisce automaticamente.

#### Tracking Connessioni
**Cosa fa:** Tiene traccia di chi è connesso, quante connessioni ha ogni utente.
**Beneficio:** Possibilità di limitare connessioni simultanee, monitoring in tempo reale.

#### Shutdown Controllato
**Cosa fa:** Durante deploy/restart, notifica i client prima di disconnetterli.
**Beneficio:** Utenti non perdono dati, possono salvare prima della disconnessione.

#### Gestione Room Generiche
**Cosa fa:** Sistema per creare "stanze virtuali" dove gli utenti collaborano su risorse.
**Beneficio:** Foundation riutilizzabile per Surgery, Exam, Patient, ecc.

#### Limiti di Sicurezza
**Cosa fa:** Massimo 5 connessioni per utente, rate limiting (100 eventi/10sec).
**Beneficio:** Previene abusi, garantisce fair usage delle risorse server.

#### Gestione Errori Centralizzata
**Cosa fa:** Tutti gli errori socket seguono un formato standard con codici univoci.
**Beneficio:** Client può reagire agli errori in modo consistente, migliore UX.

#### Lock su Sub-Risorse
**Cosa fa:** Permette di "bloccare" parti di una risorsa (es. tab di una Surgery) per editing esclusivo.
**Beneficio:** Evita conflitti quando 2 utenti editano la stessa sezione contemporaneamente.

---

### 1.2 Business Logic Layer (75% ✅)

#### Join/Leave Risorse
**Cosa fa:** Utenti possono entrare/uscire da una risorsa (es. Surgery) in modo collaborativo.
**Beneficio:** Base per tutte le funzionalità multi-user.

#### Presenza in Tempo Reale
**Cosa fa:** Mostra in UI chi è attualmente nella stessa risorsa.
**Beneficio:** Awareness: "Chi sta lavorando con me?"

#### Lock Esclusivi su Tab
**Cosa fa:** Solo un utente alla volta può editare un tab specifico (es. "Dati Anestesia").
**Beneficio:** Previene conflitti di salvataggio, protegge integrità dati.

---

## 2. Contratto Interfacce BE/UI

### 2.1 Setup Connessione Client

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:3000/api/n/ws', {
  transports: ['websocket', 'polling'],
  auth: {
    token: '<JWT_TOKEN>'  // Token JWT da Keycloak
  }
});
```

**Parametri chiave:**
- **URL:** `http://localhost:3000/api/n/ws`
- **Namespace:** `/api/n/ws`
- **Auth:** Token JWT obbligatorio

---

### 2.2 Eventi Client → Server

#### Entrare in una Risorsa (Join)

```typescript
socket.emit('resource:join', {
  resourceType: 'surgery-management',  // Tipo risorsa
  resourceUuid: 'abc-123-def-456'      // ID univoco
});
```

**Quando usarlo:** Quando l'utente apre la pagina di una Surgery.

---

#### Uscire da una Risorsa (Leave)

```typescript
socket.emit('resource:leave', {
  resourceType: 'surgery-management',
  resourceUuid: 'abc-123-def-456'
});
```

**Quando usarlo:** Quando l'utente chiude la pagina o cambia Surgery.

---

#### Acquisire Lock su un Tab

```typescript
socket.emit('resource:subresource_lock', {
  resourceType: 'surgery-management',
  resourceUuid: 'abc-123-def-456',
  subResourceId: 'data-tab'  // ID del tab (es. 'anestesia', 'operators')
});
```

**Quando usarlo:** Quando l'utente clicca su un tab per editarlo.

---

#### Rilasciare Lock su un Tab

```typescript
socket.emit('resource:subresource_unlock', {
  resourceType: 'surgery-management',
  resourceUuid: 'abc-123-def-456',
  subResourceId: 'data-tab'
});
```

**Quando usarlo:** Quando l'utente salva o esce dal tab.

---

#### Estendere Durata Lock (Area 7.4)

```typescript
socket.emit('lock:extend', {
  resourceType: 'surgery-management',
  resourceUuid: 'abc-123-def-456',
  subResourceId: 'data-tab'
});
```

**Quando usarlo:** Quando l'utente riceve un warning di scadenza lock (`lock:expiring_soon`) e vuole continuare a lavorare.

**Comportamento:** Resetta il timer del lock a 3 ore complete da ora. Cancella eventuali warning già emessi.

**Risposta attesa:**
```typescript
socket.on('lock:extended', (data) => {
  console.log('Lock esteso fino a:', new Date(data.newExpiresAt));
  // UI: Nasconde warning di scadenza, aggiorna countdown
});
```

---

### 2.3 Eventi Server → Client

#### Conferma Join Risorsa

```typescript
socket.on('resource:joined', (data) => {
  console.log('Entrato in risorsa:', data.resourceUuid);
  console.log('Utenti presenti:', data.currentUsers);
  // UI: Mostra lista utenti presenti
});
```

**Payload ricevuto:**
```json
{
  "resourceType": "surgery-management",
  "resourceUuid": "abc-123",
  "roomId": "surgery-management:abc-123",
  "userId": "user-001",
  "username": "mario.rossi",
  "currentUsers": [
    {
      "userId": "user-001",
      "username": "mario.rossi",
      "socketId": "abc123",
      "connectedAt": 1699876543210
    },
    {
      "userId": "user-002",
      "username": "luigi.verdi",
      "socketId": "def456",
      "connectedAt": 1699876540000
    }
  ],
  "timestamp": 1699876543210
}
```

---

#### Nuovo Utente Entra

```typescript
socket.on('user:joined', (data) => {
  console.log('Nuovo utente:', data.username);
  // UI: Aggiungi utente alla lista presenze
});
```

**Payload:**
```json
{
  "resourceType": "surgery-management",
  "resourceUuid": "abc-123",
  "roomId": "surgery-management:abc-123",
  "userId": "user-003",
  "username": "anna.bianchi",
  "socketId": "ghi789",
  "timestamp": 1699876545000
}
```

---

#### Utente Esce

```typescript
socket.on('user:left', (data) => {
  console.log('Utente uscito:', data.username);
  // UI: Rimuovi utente dalla lista presenze
});
```

---

#### Lock Acquisito con Successo

```typescript
socket.on('resource:subresource_locked', (data) => {
  console.log('Lock acquisito su tab:', data.subResourceId);
  // UI: Abilita editing del tab
});
```

**Payload:**
```json
{
  "resourceType": "surgery-management",
  "resourceUuid": "abc-123",
  "subResourceId": "data-tab",
  "userId": "user-001",
  "username": "mario.rossi",
  "lockedAt": 1699876550000,
  "expiresAt": 1699887350000
}
```

---

#### Lock Negato (Tab Occupato)

```typescript
socket.on('resource:subresource_lock_denied', (data) => {
  console.error('Lock negato:', data.reason);
  console.log('Tab occupato da:', data.lockedBy?.username);
  // UI: Mostra messaggio "Tab occupato da mario.rossi"
});
```

**Payload:**
```json
{
  "resourceType": "surgery-management",
  "resourceUuid": "abc-123",
  "subResourceId": "data-tab",
  "reason": "ALREADY_LOCKED",
  "message": "Tab già bloccato da un altro utente",
  "lockedBy": {
    "userId": "user-002",
    "username": "luigi.verdi",
    "lockedAt": 1699876540000
  }
}
```

---

#### Lock Rilasciato

```typescript
socket.on('resource:subresource_unlocked', (data) => {
  console.log('Lock rilasciato su tab:', data.subResourceId);
  if (data.reason === 'disconnect') {
    console.log('Utente disconnesso:', data.releasedBy?.username);
  }
  // UI: Aggiorna stato tab (ora disponibile)
});
```

---

#### Warning Scadenza Lock (Area 7.4)

```typescript
socket.on('lock:expiring_soon', (data) => {
  console.warn(`Lock su ${data.subResourceId} scade tra ${data.remainingMinutes} minuti`);
  
  // UI: Mostra popup/banner warning
  showWarningBanner({
    message: `Il tuo lock sul tab "${data.subResourceId}" scadrà tra 15 minuti. Vuoi estenderlo?`,
    actions: [
      {
        label: 'Estendi',
        callback: () => socket.emit('lock:extend', {
          resourceType: data.resourceType,
          resourceUuid: data.resourceUuid,
          subResourceId: data.subResourceId
        })
      },
      {
        label: 'Ignora',
        callback: () => dismissWarning()
      }
    ]
  });
});
```

**Payload ricevuto:**
```json
{
  "resourceType": "surgery-management",
  "resourceUuid": "abc-123",
  "subResourceId": "data-tab",
  "remainingMinutes": 15,
  "remainingTime": 900000,
  "expiresAt": 1699887350000
}
```

**Quando viene emesso:** 15 minuti prima della scadenza del lock (a 2h 45m dall'acquisizione).

**Azione UI consigliata:**
- Mostra banner/dialog con countdown
- Offri bottone "Estendi lock"
- Se utente ignora, mostra di nuovo a 5min dalla scadenza (opzionale)

---

#### Lock Scaduto (Area 7.4)

```typescript
socket.on('lock:expired', (data) => {
  console.error(`Lock su ${data.subResourceId} è scaduto per ${data.reason}`);
  
  // UI: Disabilita editing, mostra messaggio
  disableTabEditing(data.subResourceId);
  showErrorNotification({
    title: 'Lock scaduto',
    message: `Il tuo lock sul tab "${data.subResourceId}" è scaduto per inattività. Eventuali modifiche non salvate sono state perse.`,
    type: 'warning'
  });
  
  // UI: Suggerisci ri-acquisizione lock
  suggestReacquireLock(data.subResourceId);
});
```

**Payload ricevuto:**
```json
{
  "resourceType": "surgery-management",
  "resourceUuid": "abc-123",
  "subResourceId": "data-tab",
  "reason": "timeout"
}
```

**Motivi possibili:**
- `timeout`: Lock è scaduto dopo 3 ore di inattività
- `INACTIVITY_TIMEOUT`: Sistema ha rilevato inattività prolungata (sistema esistente, diverso da Area 7.4)

**Azione UI consigliata:**
- Disabilita immediatamente tutti i campi del tab
- Mostra messaggio che il lock è stato perso
- Offri bottone per ri-acquisire lock
- NON sovrascrivere dati non salvati (avvisa utente della perdita)

---

#### Lock Esteso con Successo (Area 7.4)

```typescript
socket.on('lock:extended', (data) => {
  console.log(`Lock esteso fino a: ${new Date(data.newExpiresAt)}`);
  
  // UI: Nasconde warning, aggiorna countdown
  dismissWarningBanner();
  updateLockExpiryCountdown(data.newExpiresAt);
});
```

**Payload ricevuto:**
```json
{
  "resourceType": "surgery-management",
  "resourceUuid": "abc-123",
  "subResourceId": "data-tab",
  "newExpiresAt": 1699898150000
}
```

---

#### Errori

```typescript
socket.on('error', (error) => {
  console.error('Errore socket:', error.code, error.message);
  
  switch(error.code) {
    case 'RESOURCE_NOT_FOUND':
      // UI: "Surgery non trovata"
      break;
    case 'MAX_CONNECTIONS_EXCEEDED':
      // UI: "Troppi dispositivi connessi"
      break;
    case 'RATE_LIMIT_EXCEEDED':
      // UI: "Troppi eventi inviati, rallenta"
      break;
  }
});
```

---

### 2.4 Codici Errore Standardizzati

| Codice | Descrizione | Azione UI |
|--------|-------------|-----------|
| `AUTHENTICATION_FAILED` | Token JWT invalido/mancante | Redirect a login |
| `RESOURCE_NOT_FOUND` | Risorsa (Surgery) non esiste | Mostra errore 404 |
| `MAX_CONNECTIONS_EXCEEDED` | Utente ha 5+ connessioni attive | "Chiudi altre sessioni" |
| `RATE_LIMIT_EXCEEDED` | Troppi eventi inviati (>100/10sec) | Rallenta azioni utente |
| `ALREADY_LOCKED` | Tab già bloccato da altro utente | Mostra chi ha il lock |
| `UNAUTHORIZED` | Utente non ha permessi sulla risorsa | Mostra errore 403 |

---

## 3. Flussi di Integrazione

### 3.1 Flusso: Join Surgery e Visualizza Presenza

```mermaid
sequenceDiagram
    participant UI as UI Angular
    participant Socket as Socket Gateway
    participant DB as Database/Adapter

    UI->>Socket: socket.emit('resource:join', {type, uuid})
    Socket->>DB: Verifica risorsa esiste + stato
    
    alt Risorsa OK
        DB-->>Socket: Risorsa valida
        Socket->>Socket: Aggiungi utente a room
        Socket-->>UI: emit('resource:joined', {currentUsers})
        Socket-->>Altri Client: broadcast('user:joined', {newUser})
    else Risorsa non esiste
        DB-->>Socket: NOT_FOUND
        Socket-->>UI: emit('error', {code: 'RESOURCE_NOT_FOUND'})
    end
```

**Step UI:**
1. Utente apre pagina Surgery
2. UI chiama `socket.emit('resource:join')`
3. UI riceve `resource:joined` → mostra lista utenti presenti
4. UI ascolta `user:joined` → aggiunge nuovo utente alla lista
5. UI ascolta `user:left` → rimuove utente dalla lista

---

### 3.2 Flusso: Lock Tab per Editing

```mermaid
sequenceDiagram
    participant User A as Utente A (UI)
    participant Socket as Socket Gateway
    participant User B as Utente B (UI)

    User A->>Socket: emit('resource:subresource_lock', {uuid, tabId})
    
    alt Tab Disponibile
        Socket->>Socket: Acquisisci lock per User A
        Socket-->>User A: emit('resource:subresource_locked')
        Socket-->>User B: broadcast('resource:subresource_locked')
        Note over User A: User A può editare
        Note over User B: Tab disabilitato (badge "Occupato da User A")
    else Tab Già Locked
        Socket-->>User A: emit('resource:subresource_lock_denied', {lockedBy})
        Note over User A: Mostra "Tab occupato da User B"
    end
```

**Step UI:**
1. User A clicca tab "Dati Anestesia"
2. UI chiama `socket.emit('resource:subresource_lock', {subResourceId: 'anestesia'})`
3. Se successo → UI abilita form editing
4. Se negato → UI mostra badge "Occupato da [username]"
5. User B vede tab con badge "Occupato" e non può cliccare

---

### 3.3 Flusso: Auto-Release Lock su Disconnect

```mermaid
sequenceDiagram
    participant User A as Utente A
    participant Socket as Socket Gateway
    participant User B as Utente B (UI)

    Note over User A: Perde connessione (rete/chiude browser)
    User A--xSocket: disconnect
    
    Socket->>Socket: Rileva disconnect
    Socket->>Socket: Rilascia tutti lock di User A
    Socket-->>User B: broadcast('resource:subresource_unlocked', {reason: 'disconnect'})
    Socket-->>User B: broadcast('user:left', {user: 'User A'})
    
    Note over User B: Tab ora disponibile
    Note over User B: User A rimosso da lista presenze
```

**Step UI:**
1. User A perde connessione
2. Server rileva disconnect (entro ~30 secondi via heartbeat)
3. Server rilascia automaticamente tutti lock di User A
4. UI di User B riceve `subresource_unlocked` → rimuove badge "Occupato"
5. UI di User B riceve `user:left` → rimuove User A da lista presenze

---

### 3.4 Flusso: Reconnect dopo Perdita Rete

```mermaid
sequenceDiagram
    participant UI as UI Angular
    participant Socket as Socket Client
    participant Server as Socket Gateway

    Note over UI,Socket: Perdita connessione temporanea
    Socket--xServer: disconnect
    
    Note over Socket: Auto-reconnect (retry 5 volte)
    Socket->>Server: reconnect + auth token
    Server-->>Socket: connect_success
    
    Socket-->>UI: emit('connect')
    UI->>Socket: emit('resource:join', {lastState})
    Server-->>UI: emit('resource:joined', {currentState})
    
    Note over UI: Sincronizza stato UI con server
```

**Step UI:**
1. Detect `disconnect` event → Mostra "Connessione persa..."
2. Socket.io auto-riconnette (max 5 tentativi)
3. Ricevi `connect` → Re-join alla risorsa corrente
4. Sincronizza stato (es. verifica se ancora ha lock)

---

## 4. Use Case e Scenari

### 4.1 Collaborazione Multi-Utente su Surgery

**Attori:** Dr. Rossi (Chirurgo), Dr. Verdi (Anestesista)

**Scenario:**
1. Dr. Rossi apre Surgery #123 → Join room
2. UI mostra "Dr. Rossi (Tu)" in lista presenze
3. Dr. Verdi apre stessa Surgery → Join room
4. UI di Dr. Rossi riceve notifica "Dr. Verdi si è unito"
5. Dr. Rossi clicca tab "Dati Operatori" → Acquisisce lock
6. Dr. Verdi vede tab "Dati Operatori" con badge "Occupato da Dr. Rossi"
7. Dr. Verdi clicca tab "Dati Anestesia" → Acquisisce lock (tab diverso, OK)
8. Entrambi editano tab diversi contemporaneamente
9. Dr. Rossi salva → Rilascia lock su "Dati Operatori"
10. Dr. Verdi vede tab "Dati Operatori" ora disponibile

**Beneficio:** Editing parallelo su sezioni diverse, nessun conflitto.

---

### 4.2 Prevenzione Conflitti di Salvataggio

**Attori:** Infermiera Anna, Infermiera Lucia

**Scenario:**
1. Anna apre Surgery #456, clicca tab "Dati Paziente"
2. Anna acquisisce lock, inizia a editare peso/altezza
3. Lucia apre stessa Surgery → Join room
4. Lucia cerca di cliccare tab "Dati Paziente"
5. UI mostra "Tab occupato da Anna" (tab disabilitato)
6. Lucia aspetta o lavora su altro tab
7. Anna salva → Lock rilasciato
8. UI di Lucia riceve `subresource_unlocked`
9. Tab "Dati Paziente" ora cliccabile per Lucia

**Beneficio:** Evitato overwrite dati, integrità garantita.

---

### 4.3 Gestione Disconnessione Improvvisa

**Attori:** Dr. Rossi (editing), Dr. Verdi (waiting)

**Scenario:**
1. Dr. Rossi editing tab "Diagnosi" (ha lock)
2. Dr. Verdi aspetta che Rossi finisca
3. Dr. Rossi perde connessione Wi-Fi improvvisa
4. Server rileva disconnect dopo 30 secondi (heartbeat timeout)
5. Server rilascia lock automaticamente
6. UI di Dr. Verdi riceve `subresource_unlocked` (reason: 'disconnect')
7. UI mostra notifica "Dr. Rossi disconnesso, tab ora disponibile"
8. Dr. Verdi può ora cliccare tab "Diagnosi"

**Beneficio:** Lock non rimane "bloccato" per sempre, auto-recovery.

---

### 4.4 Limite Connessioni Simultanee

**Attore:** Dr. Rossi

**Scenario:**
1. Dr. Rossi apre Surgery su:
   - Desktop ufficio
   - Laptop sala operatoria
   - Tablet (backup)
   - Smartphone (emergenza)
   - iPad (5° device)
2. Tutte le connessioni OK (max 5 per utente)
3. Dr. Rossi prova aprire su 6° device (PC casa)
4. Server rifiuta connessione: `MAX_CONNECTIONS_EXCEEDED`
5. UI mostra "Troppi dispositivi connessi, chiudine uno"
6. Dr. Rossi chiude smartphone
7. 6° device ora può connettersi

**Beneficio:** Previene abusi, garantisce risorse server.

---

## 5. Edge Case e Gestione Errori

### 5.1 Diagramma: Gestione Lock con Timeout

```mermaid
flowchart TD
    A[Utente richiede lock] --> B{Lock disponibile?}
    B -->|Sì| C[Acquisisce lock]
    B -->|No| D[Lock denied]
    
    C --> E{Utente attivo?}
    E -->|Editing| E
    E -->|Salva| F[Release lock]
    E -->|Disconnect| G[Auto-release dopo 30s]
    E -->|Timeout 3h| G
    
    G --> H[Broadcast unlock]
    F --> H
    
    D --> I[Mostra chi ha lock]
    I --> J{Aspetta o cambia tab}
```

**Edge Case Gestiti:**
- Lock timeout 3 ore (sicurezza)
- Auto-release su disconnect (max 30s delay)
- Lock negato → UI mostra username proprietario
- Utente può aspettare o lavorare su altro tab

---

### 5.2 Diagramma: Reconnection e Recovery

```mermaid
flowchart TD
    A[Connessione persa] --> B[UI mostra warning]
    B --> C{Auto-reconnect}
    
    C -->|Successo entro 30s| D[Re-join risorsa]
    C -->|Fallisce dopo 5 retry| E[Disconnesso permanente]
    
    D --> F{Aveva lock?}
    F -->|Sì| G[Lock perso]
    F -->|No| H[Solo re-join]
    
    G --> I[UI notifica perdita lock]
    H --> J[UI sincronizza stato]
    
    E --> K[UI: Ricarica pagina]
```

**Edge Case Gestiti:**
- Perdita rete temporanea → Auto-recovery
- Perdita rete prolungata → Lock perso (dopo 30s)
- UI notifica utente se ha perso lock
- Fallback: reload pagina se reconnect impossibile

---

### 5.3 Tabella Edge Case Critici

| Edge Case | Comportamento Attuale | Impatto Utente |
|-----------|----------------------|----------------|
| **2 utenti cliccano tab simultaneamente** | Solo il primo acquisisce lock, secondo riceve denied | ✅ Secondo utente vede badge "Occupato" |
| **Utente chiude browser senza unlock** | Server rilascia lock dopo 30s (heartbeat timeout) | ✅ Auto-recovery, nessun lock permanente |
| **Utente salva ma rete lenta** | Lock rilasciato immediatamente, salvataggio continua | ⚠️ Altro utente può acquisire lock prima del save completo |
| **Server restart durante editing** | Tutti disconnect, UI reconnect, lock persi | ⚠️ Utente deve re-acquisire lock, modifiche non salvate perse |
| **5 connessioni + prova 6°** | Connessione rifiutata con errore chiaro | ✅ UI mostra errore comprensibile |
| **Rate limiting 100 eventi/10sec** | Eventi successivi rejected temporaneamente | ⚠️ UI deve rallentare azioni (es. debounce input) |
| **Token JWT scaduto mid-session** | Prossimo evento fallisce, disconnect forzato | ⚠️ Utente deve rifare login (TODO: refresh token) |
| **Surgery eliminata durante editing** | Join future falliscono, lock future falliscono | ✅ UI riceve error `RESOURCE_NOT_FOUND` |

---

## 6. Scenari Test BDD

### 6.1 Feature: Join Surgery Room

```gherkin
Feature: Join Surgery Room
  Come utente autenticato
  Voglio entrare in una Surgery room
  Per collaborare con altri utenti

  Background:
    Given l'utente "mario.rossi" è autenticato
    And la Surgery "abc-123" esiste e ha stato "IN_PROGRESS"

  Scenario: Join riuscito con room vuota
    When l'utente invia evento "resource:join" per Surgery "abc-123"
    Then l'utente riceve evento "resource:joined"
    And la lista "currentUsers" contiene solo "mario.rossi"
    And il log server mostra "USER_JOINED_ROOM"

  Scenario: Join riuscito con altri utenti presenti
    Given l'utente "luigi.verdi" è già nella room "abc-123"
    When l'utente "mario.rossi" invia evento "resource:join" per Surgery "abc-123"
    Then "mario.rossi" riceve evento "resource:joined"
    And la lista "currentUsers" contiene "mario.rossi" e "luigi.verdi"
    And "luigi.verdi" riceve broadcast "user:joined" con dati "mario.rossi"

  Scenario: Join fallito - Surgery non esiste
    When l'utente invia evento "resource:join" per Surgery "non-esistente"
    Then l'utente riceve evento "error"
    And il codice errore è "RESOURCE_NOT_FOUND"
    And il messaggio contiene "Risorsa non trovata"

  Scenario: Join fallito - Token mancante
    Given l'utente non ha inviato token JWT
    When l'utente tenta connessione
    Then la connessione è rifiutata
    And l'evento "connect_error" contiene "AUTHENTICATION_FAILED"
```

---

### 6.2 Feature: Lock Tab Esclusivo

```gherkin
Feature: Lock Tab Esclusivo
  Come utente in una Surgery room
  Voglio acquisire lock su un tab
  Per editarlo senza conflitti

  Background:
    Given l'utente "mario.rossi" è nella room "abc-123"
    And l'utente "luigi.verdi" è nella room "abc-123"

  Scenario: Acquisizione lock su tab libero
    When "mario.rossi" invia "resource:subresource_lock" per tab "data-tab"
    Then "mario.rossi" riceve "resource:subresource_locked"
    And il payload contiene "userId: mario.rossi", "lockedAt: <timestamp>"
    And "luigi.verdi" riceve broadcast "resource:subresource_locked"
    And il log server mostra "LOCK_ACQUIRED"

  Scenario: Lock negato - tab già occupato
    Given "luigi.verdi" ha lock su tab "data-tab"
    When "mario.rossi" invia "resource:subresource_lock" per tab "data-tab"
    Then "mario.rossi" riceve "resource:subresource_lock_denied"
    And il campo "reason" è "ALREADY_LOCKED"
    And il campo "lockedBy.username" è "luigi.verdi"
    And il campo "lockedBy.lockedAt" contiene timestamp acquisizione

  Scenario: Lock su tab diversi contemporaneamente
    When "mario.rossi" acquisisce lock su tab "data-tab"
    And "luigi.verdi" acquisisce lock su tab "anestesia-tab"
    Then entrambi ricevono "resource:subresource_locked"
    And nessun conflitto si verifica
    And il log server mostra 2 eventi "LOCK_ACQUIRED"

  Scenario: Rilascio lock manuale
    Given "mario.rossi" ha lock su tab "data-tab"
    When "mario.rossi" invia "resource:subresource_unlock" per tab "data-tab"
    Then "mario.rossi" riceve "resource:subresource_unlocked"
    And "luigi.verdi" riceve broadcast "resource:subresource_unlocked"
    And il tab "data-tab" è ora disponibile
```

---

### 6.3 Feature: Auto-Release Lock on Disconnect

```gherkin
Feature: Auto-Release Lock on Disconnect
  Come sistema
  Voglio rilasciare automaticamente lock quando utente si disconnette
  Per evitare lock "bloccati" permanentemente

  Background:
    Given "mario.rossi" è nella room "abc-123"
    And "luigi.verdi" è nella room "abc-123"
    And "mario.rossi" ha lock su tab "data-tab"

  Scenario: Disconnect volontario - rilascio immediato
    When "mario.rossi" si disconnette volontariamente
    Then il server rileva disconnect entro 1 secondo
    And il lock su "data-tab" viene rilasciato
    And "luigi.verdi" riceve "resource:subresource_unlocked"
    And il campo "reason" è "disconnect"
    And il campo "releasedBy.username" è "mario.rossi"

  Scenario: Perdita rete - rilascio dopo timeout
    When "mario.rossi" perde connessione di rete improvvisamente
    And passa il timeout heartbeat (30 secondi)
    Then il server rileva zombie connection
    And il lock su "data-tab" viene rilasciato
    And "luigi.verdi" riceve "resource:subresource_unlocked" dopo ~30s
    And il campo "reason" è "disconnect"

  Scenario: Multiple lock release
    Given "mario.rossi" ha lock su 3 tab diversi
    When "mario.rossi" si disconnette
    Then tutti e 3 i lock vengono rilasciati
    And "luigi.verdi" riceve 3 eventi "resource:subresource_unlocked"
    And tutti contengono "reason: disconnect"
```

---

### 6.4 Feature: Presenza Utenti Real-Time

```gherkin
Feature: Presenza Utenti Real-Time
  Come utente in una room
  Voglio vedere chi è presente
  Per sapere con chi sto collaborando

  Scenario: Lista iniziale presenze su join
    Given "luigi.verdi" è già nella room "abc-123"
    When "mario.rossi" entra nella room "abc-123"
    Then "mario.rossi" riceve "resource:joined"
    And la lista "currentUsers" contiene:
      | userId    | username     |
      | user-001  | luigi.verdi  |
      | user-002  | mario.rossi  |

  Scenario: Notifica nuovo utente agli altri
    Given "mario.rossi" è nella room "abc-123"
    When "anna.bianchi" entra nella room "abc-123"
    Then "mario.rossi" riceve "user:joined"
    And il payload contiene "username: anna.bianchi"
    And il timestamp è recente (<1 secondo fa)

  Scenario: Notifica uscita utente
    Given "mario.rossi" e "luigi.verdi" sono nella room "abc-123"
    When "luigi.verdi" esce dalla room
    Then "mario.rossi" riceve "user:left"
    And il payload contiene "username: luigi.verdi"
    And la lista presenze UI si aggiorna automaticamente
```

---

### 6.5 Feature: Limite Connessioni per Utente

```gherkin
Feature: Limite Connessioni per Utente
  Come sistema
  Voglio limitare connessioni simultanee per utente
  Per prevenire abusi e garantire risorse

  Background:
    Given il limite è configurato a 5 connessioni per utente

  Scenario: Connessioni sotto il limite
    Given "mario.rossi" ha 4 connessioni attive
    When "mario.rossi" apre 5° device e tenta connessione
    Then la connessione è accettata
    And il server mostra 5 connessioni per "mario.rossi"

  Scenario: Connessione oltre il limite rifiutata
    Given "mario.rossi" ha già 5 connessioni attive
    When "mario.rossi" tenta 6° connessione
    Then la connessione è rifiutata
    And l'evento "error" contiene "MAX_CONNECTIONS_EXCEEDED"
    And il messaggio è "Limite massimo connessioni raggiunto (5)"

  Scenario: Liberare slot disconnettendo device
    Given "mario.rossi" ha 5 connessioni attive
    When "mario.rossi" chiude 1 device
    And attende 2 secondi
    And tenta nuova connessione
    Then la nuova connessione è accettata
    And il totale rimane 5 connessioni
```

---

### 6.6 Feature: Rate Limiting Eventi

```gherkin
Feature: Rate Limiting Eventi
  Come sistema
  Voglio limitare eventi per connessione
  Per prevenire spam e DoS

  Background:
    Given il limite è 100 eventi per 10 secondi
    And "mario.rossi" è connesso

  Scenario: Sotto la soglia rate limit
    When "mario.rossi" invia 90 eventi in 10 secondi
    Then tutti gli eventi sono processati
    And nessun errore è emesso

  Scenario: Superamento rate limit
    When "mario.rossi" invia 101 eventi in 5 secondi
    Then i primi 100 eventi sono processati
    And l'evento 101 è rifiutato
    And "mario.rossi" riceve "error" con codice "RATE_LIMIT_EXCEEDED"
    And il messaggio contiene "Troppi eventi, rallenta"

  Scenario: Reset counter dopo window
    Given "mario.rossi" ha inviato 100 eventi
    When passano 11 secondi
    And "mario.rossi" invia nuovo evento
    Then l'evento è processato correttamente
    And il counter è resettato a 1
```

---

## 7. Prossimi Step

### 7.1 Priorità ALTA (2-3 settimane) ⚡

#### Step 1: Area 7.4 - Lock Timeout & Warning (2h)
**Descrizione:** Implementare warning pre-scadenza lock (15min prima) e timeout automatico (3h).

**Cosa include:**
- Lock scade dopo 3 ore inattività
- Warning inviato 15 minuti prima: `lock:expiring_soon`
- Client può estendere lock con heartbeat

**Edge Case:**
- Utente non risponde a warning → Lock scade, broadcast unlock
- Utente estende lock → Timer resettato
- Disconnect durante warning → Lock rilasciato immediatamente

**Deliverables:**
- `lock:expiring_soon` event
- `lock:extend` event handler
- Timer management per ogni lock
- 8 test E2E

---

#### Step 2: Area 7.5 - Lock Force Request (2.5h)
**Descrizione:** Permettere richiesta forzatura lock con approval flow.

**Cosa include:**
- User A richiede lock occupato da User B
- User B riceve notifica: "User A vuole accedere al tab"
- User B ha 30 secondi per rispondere (approve/reject)
- Timeout → auto-reject

**Edge Case:**
- User B disconnect durante pending request → auto-reject
- Multiple requests dallo stesso user → ignora duplicati
- User A disconnette prima della risposta → request cancellata

**Deliverables:**
- `lock:force_request` event
- `lock:force_request_pending` (a User B)
- `lock:force_request_approved/rejected` events
- Timeout 30s con auto-reject
- 12 test E2E

---

#### Step 3: Area 7.6 - Validation Access Control (2h)
**Descrizione:** Sub-risorsa "validazione" con controllo rigoroso permessi.

**Cosa include:**
- Solo utenti con ruolo "VALIDATOR" possono acquisire lock su tab "validation"
- Check permessi via adapter

**Edge Case:**
- Utente senza permessi → lock denied con reason `UNAUTHORIZED`
- Permessi revocati durante lock → forzare unlock

**Deliverables:**
- Permission check in lock acquisition
- New error code `UNAUTHORIZED`
- Integration con authorization adapter
- 6 test E2E

---

#### Step 4: Area 7.7 - Exclusive Resource Access (1.5h)
**Descrizione:** Stato IN_PROGRESS = solo 1 utente su tutta la risorsa.

**Cosa include:**
- Surgery in stato `IN_PROGRESS` → max 1 utente connesso
- Altri tentativi join → rejected con message "Surgery in uso esclusivo"

**Edge Case:**
- Stato cambia IN_PROGRESS → IN_VALIDAZIONE durante sessione → nessun kick
- Secondo utente con ruolo ADMIN → bypass (configurable)

**Deliverables:**
- Check stato risorsa su join
- New reject reason `EXCLUSIVE_ACCESS`
- 5 test E2E

---

### 7.2 Priorità MEDIA (3-4 settimane) 🟡

#### Step 5: Area 7.8 - Save/Revision Events (2h)
**Descrizione:** Eventi `resource:updated` quando risorsa salvata via REST.

**Cosa include:**
- REST Controller emette evento interno dopo save
- Gateway ascolta evento e broadcast a room
- Payload include: `newRevisionId`, `updatedBy`, `changesSummary`

**Edge Case:**
- Save fallisce → no evento emesso
- Nessun utente in room → evento ignorato (no recipients)

**Deliverables:**
- `resource:updated` event
- Integration EventEmitter2
- 4 test E2E

---

#### Step 6: Area 7.9 - Conflict Detection (1.5h)
**Descrizione:** Optimistic locking con revision number.

**Cosa include:**
- Client invia `currentRevision` con lock request
- Server verifica se revisione corrente corrisponde
- Se no → lock denied con reason `REVISION_CONFLICT`

**Edge Case:**
- Revisione obsoleta → UI mostra "Dati cambiati, ricarica"
- Client può forzare lock ignorando conflict (TODO: future)

**Deliverables:**
- Revision check in lock acquisition
- New error code `REVISION_CONFLICT`
- 6 test E2E

---

#### Step 7: Area 8.1 - DTO Validation (1h)
**Descrizione:** Validazione automatica payload eventi con class-validator.

**Cosa include:**
- Configurare `ValidationPipe` per @SubscribeMessage handlers
- Auto-reject eventi con payload invalidi
- Errore specifico per campo mancante/invalido

**Edge Case:**
- Payload vuoto → reject con error dettagliato
- Campo extra non whitelisted → ignorato (sicurezza)

**Deliverables:**
- DTO classes con decorators
- ValidationPipe global config
- 8 test per payload invalidi

---

#### Step 8: Area 5.1 - Structured Logging (1h)
**Descrizione:** Winston logger con formato JSON per production.

**Cosa include:**
- Winston trasport configurato
- Log level per environment (debug/info/error)
- Structured fields: `userId`, `resourceId`, `eventType`, `timestamp`

**Edge Case:**
- Log troppo grandi (>1KB) → truncate automatico
- Errori durante logging → fallback console.log

**Deliverables:**
- Winston setup
- Structured log format
- Test coverage

---

### 7.3 Priorità BASSA (Backlog) 🔵

#### Step 9: Area 7.10 - Admin Force Release Lock (1h)
**Descrizione:** API admin per forzare rilascio lock.

**Requisiti:**
- Endpoint REST: `DELETE /api/admin/websocket/locks/{resourceId}/{tabId}`
- Solo ruolo ADMIN può chiamare
- Gateway rilascia lock e notifica owner

---

#### Step 10: Area 7.11 - Orphan Lock Cleanup Job (1.5h)
**Descrizione:** Background job per pulizia lock orfani.

**Requisiti:**
- Job eseguito ogni 5 minuti
- Cerca lock > 3h30m (3h + 30min grace)
- Rilascia lock e logga incident

---

#### Step 11: Area 7.12 - Socket-Specific Logger (1h)
**Descrizione:** File log separato per eventi socket.

**Requisiti:**
- File: `logs/socket-gateway-YYYY-MM-DD.log`
- Log rotation: 20MB, retention 14 giorni
- Compression: gzip per archivi vecchi

---

#### Step 12: Refactor 2.2 - Extract CollaborationGateway (2h)
**Descrizione:** Classe astratta `CollaborationGateway extends BaseSocketGateway` per riutilizzo.

**Beneficio:** Facilita aggiunta nuove risorse collaborative (Exam, Patient).

---

#### Step 13: Documentation & Examples (1h)
**Descrizione:** Diagrammi architetturali, esempi codice client, troubleshooting.

**Deliverables:**
- Mermaid flow diagrams completi
- Client integration examples (Angular/React)
- FAQ & Troubleshooting guide

---

### 7.4 Riepilogo Priorità

| Priorità | Tasks | Tempo Totale | Start Date (Stimato) |
|----------|-------|--------------|----------------------|
| ⚡ ALTA | 4 tasks | ~8h (~1 settimana) | Immediate |
| 🟡 MEDIA | 4 tasks | ~6.5h (~1 settimana) | +2 settimane |
| 🔵 BASSA | 5 tasks | ~7.5h (~1 settimana) | Backlog (>1 mese) |

**Total Remaining Work:** ~22 ore (~3 settimane part-time)

---

## 📊 Riepilogo Stato Progetto

**Completato:** 10 tasks (17.2%)  
**TODO Priorità Alta:** 4 tasks  
**TODO Priorità Media:** 16 tasks  
**Backlog:** 28 tasks

**Test Coverage:** 120/122 passing ✅  
**Production Ready:** 75% (Infrastructure + Core Business Logic)

---

**Documento generato:** 13 Novembre 2025  
**Versione:** 1.0  
**Prossimo Aggiornamento:** Dopo completamento Step 1-4 (Priorità Alta)