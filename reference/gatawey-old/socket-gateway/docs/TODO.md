# WebSocket Gateway - Task Mancanti con BE/UI Split

**Progetto:** SISOS WebSocket Gateway  
**Data:** 13 Novembre 2025  
**Versione:** 1.0

---

## 📋 Legenda

- **BE:** Backend implementation (NestJS + Socket.IO)
- **UI:** Frontend integration (Angular/Ionic)
- **⚡ ALTA:** Priorità massima - blocking per funzionalità core
- **🟡 MEDIA:** Priorità media - miglioramento UX
- **🔵 BASSA:** Priorità bassa - nice-to-have

---

## 1. Area 7.5 - Lock Force Request Flow ⚡ ALTA

### 1.1 Backend Implementation (2h)

**Task:** Implementare flusso richiesta forzatura lock con approvazione.

**Cosa Include:**

#### Eventi da Implementare

```typescript
// Client → Server
@SubscribeMessage('resource:subresource_lock:force_request')
async handleForceRequest(
  @MessageBody() data: {
    resourceType: string;
    resourceUuid: string;
    subResourceId: string;
    message?: string;  // Optional message per owner
  },
  @ConnectedSocket() client: TypedSocket
)

// Client → Server (risposta owner)
@SubscribeMessage('resource:subresource_lock:force_response')
async handleForceResponse(
  @MessageBody() data: {
    resourceType: string;
    resourceUuid: string;
    subResourceId: string;
    requestId: string;
    approved: boolean;
  },
  @ConnectedSocket() client: TypedSocket
)
```

#### Eventi Emessi dal Server

```typescript
// Server → Owner del lock
emit('resource:subresource_lock:force_request_received', {
  resourceType: 'surgery-management',
  resourceUuid: 'abc-123',
  subResourceId: 'data-tab',
  requestId: 'req-uuid-123',
  requestedBy: {
    userId: 'user-002',
    username: 'mario.rossi'
  },
  message: 'Devo validare urgentemente',
  timeoutSeconds: 30
});

// Server → Requester (pending)
emit('resource:subresource_lock:force_request_pending', {
  requestId: 'req-uuid-123',
  lockedBy: {
    userId: 'user-001',
    username: 'luigi.verdi'
  },
  timeoutSeconds: 30
});

// Server → Requester (approved/rejected)
emit('resource:subresource_lock:force_request_approved', {
  requestId: 'req-uuid-123',
  // Seguito da resource:subresource_locked
});

emit('resource:subresource_lock:force_request_rejected', {
  requestId: 'req-uuid-123',
  reason: 'OWNER_REJECTED' | 'TIMEOUT' | 'OWNER_DISCONNECTED',
  message: 'Sto ancora lavorando'
});
```

#### State Management

```typescript
interface ForceRequest {
  requestId: string;
  resourceType: string;
  resourceUuid: string;
  subResourceId: string;
  requesterId: string;
  requesterUsername: string;
  ownerId: string;
  ownerUsername: string;
  message?: string;
  createdAt: number;
  timeoutAt: number;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
}

private forceRequests: Map<string, ForceRequest> = new Map();
```

#### Logica Timeout

- Request timeout: 30 secondi
- Se owner non risponde → auto-reject
- Timer cleanup su approval/rejection/timeout

#### Test Coverage

```typescript
describe('Force Request Flow', () => {
  it('should send force request to lock owner', async () => {});
  it('should approve force request and release lock', async () => {});
  it('should reject force request and maintain lock', async () => {});
  it('should auto-reject on timeout (30s)', async () => {});
  it('should cancel request if owner disconnects', async () => {});
  it('should prevent duplicate force requests', async () => {});
  it('should queue multiple force requests', async () => {});
});
```

**Deliverables BE:**

- ✅ 4 nuovi eventi handler
- ✅ ForceRequest state management
- ✅ Timer management per timeout
- ✅ 7+ test E2E
- ✅ Documentation update

---

### 1.2 Frontend Integration (2h)

**Task:** Integrare force request flow in UI Surgery Management.

**Cosa Include:**

#### Service Angular

```typescript
// socket-gateway.service.ts
requestForceLock(
  resourceType: string,
  resourceUuid: string,
  subResourceId: string,
  message?: string
): Observable<ForceRequestResult> {
  return new Observable(observer => {
    const requestId = crypto.randomUUID();
    
    this.socket.emit('resource:subresource_lock:force_request', {
      resourceType,
      resourceUuid,
      subResourceId,
      message
    });
    
    // Listen pending
    this.socket.on('resource:subresource_lock:force_request_pending', (data) => {
      observer.next({ status: 'pending', data });
    });
    
    // Listen approved
    this.socket.on('resource:subresource_lock:force_request_approved', (data) => {
      observer.next({ status: 'approved', data });
      observer.complete();
    });
    
    // Listen rejected
    this.socket.on('resource:subresource_lock:force_request_rejected', (data) => {
      observer.error(data);
    });
  });
}

respondToForceRequest(
  requestId: string,
  approved: boolean
): void {
  this.socket.emit('resource:subresource_lock:force_response', {
    requestId,
    approved
  });
}
```

#### UI Components

**1. Badge "Occupato" con Bottone "Richiedi Accesso"**

```html
<!-- surgery-tab.component.html -->
<div *ngIf="tabLocked && !isMyLock()" class="tab-locked-badge">
  <ion-badge color="warning">
    <ion-icon name="lock-closed"></ion-icon>
    Occupato da {{ lockedBy.username }}
  </ion-badge>
  
  <ion-button 
    size="small" 
    fill="clear"
    (click)="requestForceLock()">
    Richiedi Accesso
  </ion-button>
</div>
```

**2. Modal "Richiesta in Attesa"**

```html
<!-- force-request-pending-modal.component.html -->
<ion-header>
  <ion-toolbar>
    <ion-title>Richiesta Accesso in Corso</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content>
  <div class="pending-content">
    <ion-spinner></ion-spinner>
    
    <p>Richiesta inviata a <strong>{{ lockedBy.username }}</strong></p>
    
    <div class="countdown">
      Timeout tra: {{ remainingSeconds }}s
    </div>
    
    <ion-button expand="block" color="danger" (click)="cancel()">
      Annulla Richiesta
    </ion-button>
  </div>
</ion-content>
```

**3. Toast per Owner "Richiesta Ricevuta"**

```typescript
// surgery-management.page.ts
this.socketService.onForceRequestReceived().subscribe(async (request) => {
  const alert = await this.alertController.create({
    header: 'Richiesta Accesso',
    message: `${request.requestedBy.username} vuole accedere al tab "${request.subResourceId}".${request.message ? '\n\n"' + request.message + '"' : ''}`,
    buttons: [
      {
        text: 'Rifiuta',
        role: 'cancel',
        handler: () => {
          this.socketService.respondToForceRequest(request.requestId, false);
        }
      },
      {
        text: 'Salva e Rilascia',
        handler: () => {
          this.saveCurrent().then(() => {
            this.socketService.respondToForceRequest(request.requestId, true);
          });
        }
      }
    ],
    backdropDismiss: false
  });
  
  await alert.present();
});
```

**Deliverables UI:**

- ✅ Badge "Occupato" con bottone "Richiedi Accesso"
- ✅ Modal pending con countdown
- ✅ Alert per owner con "Rifiuta" / "Salva e Rilascia"
- ✅ Toast feedback per approval/rejection
- ✅ Auto-dismiss modal su timeout

---

## 2. Area 7.6 - Validation Access Control ⚡ ALTA

### 2.1 Backend Implementation (2h)

**Task:** Controllo permessi rigoroso per tab validazione.

**Cosa Include:**

#### Permission Check

```typescript
// Nuovo metodo in gateway
private async hasValidationPermission(
  userId: string,
  resourceType: string,
  resourceUuid: string
): Promise<boolean> {
  // Integrazione con authorization service
  const user = await this.authService.getUserPermissions(userId);
  
  // Check ruolo VALIDATOR
  if (!user.roles.includes('VALIDATOR')) {
    return false;
  }
  
  // Check permessi specifici su risorsa (optional)
  if (resourceType === 'surgery-management') {
    const surgery = await this.surgeryService.findOne(resourceUuid);
    // Logic specifica per surgery validation
  }
  
  return true;
}
```

#### Lock Acquisition con Check Permessi

```typescript
@SubscribeMessage('resource:subresource_lock')
async handleSubResourceLock(
  @MessageBody() data: GenericSubResourceLockDto,
  @ConnectedSocket() client: TypedSocket,
) {
  const { resourceType, resourceUuid, subResourceId } = data;
  
  // Determina se è validation tab
  const isValidationTab = subResourceId.startsWith('validation-');
  
  if (isValidationTab) {
    // Check permessi
    const hasPermission = await this.hasValidationPermission(
      client.data.user.userId,
      resourceType,
      resourceUuid
    );
    
    if (!hasPermission) {
      client.emit('error', {
        code: 'UNAUTHORIZED',
        message: 'Non hai i permessi per accedere alla validazione',
        context: { subResourceId }
      });
      return;
    }
  }
  
  // Procedi con acquisition normale
  // ...
}
```

#### Exclusive Access Logic

```typescript
// Quando validation tab viene locked
if (isValidationTab) {
  // Check se ci sono altri lock attivi
  const activeLocks = this.getActiveLocksForResource(
    resourceType,
    resourceUuid
  );
  
  if (activeLocks.length > 0) {
    // Non possiamo dare exclusive access
    client.emit('resource:subresource_lock_denied', {
      resourceType,
      resourceUuid,
      subResourceId,
      reason: 'VALIDATION_REQUIRES_EXCLUSIVE_ACCESS',
      message: 'Altri utenti stanno editando. Attendi che completino.',
      blockingLocks: activeLocks.map(lock => ({
        subResourceId: lock.subResourceId,
        userId: lock.userId,
        username: lock.username
      }))
    });
    return;
  }
  
  // Grant exclusive access
  lock.isExclusive = true;
  
  // Broadcast a tutti
  this.server.to(roomId).emit('resource:exclusive_access_granted', {
    resourceType,
    resourceUuid,
    userId: client.data.user.userId,
    username: client.data.user.username,
    reason: 'VALIDATION_IN_PROGRESS'
  });
}
```

#### Test Coverage

```typescript
describe('Validation Access Control', () => {
  it('should allow VALIDATOR role to lock validation tab', async () => {});
  it('should deny non-VALIDATOR lock on validation tab', async () => {});
  it('should deny validation lock if other locks exist', async () => {});
  it('should grant exclusive access when validation lock acquired', async () => {});
  it('should auto-release other locks when validation starts (optional)', async () => {});
  it('should allow normal tab locks during validation (if configured)', async () => {});
});
```

**Deliverables BE:**

- ✅ Permission check integration
- ✅ Exclusive access logic
- ✅ New error code `UNAUTHORIZED`
- ✅ Blocking locks list in denial
- ✅ 6+ test E2E
- ✅ Configuration per strict/permissive mode

---

### 2.2 Frontend Integration (1.5h)

**Task:** UI per gestire exclusive access e blocco durante validazione.

**Cosa Include:**

#### UI States

**1. Waiting for Exclusive Access**

```html
<!-- validation-waiting-modal.component.html -->
<ion-content>
  <div class="validation-waiting">
    <ion-icon name="shield-checkmark" color="warning"></ion-icon>
    
    <h3>Accesso Validazione Richiesto</h3>
    
    <p>Altri utenti stanno ancora lavorando:</p>
    
    <ion-list>
      <ion-item *ngFor="let lock of blockingLocks">
        <ion-label>
          <h3>{{ lock.username }}</h3>
          <p>Editing: {{ lock.subResourceName }}</p>
        </ion-label>
      </ion-item>
    </ion-list>
    
    <p class="help-text">
      Attendi che completino o richiedi il rilascio forzato.
    </p>
    
    <ion-button expand="block" (click)="requestForceRelease()">
      Richiedi Rilascio
    </ion-button>
  </div>
</ion-content>
```

**2. Exclusive Access Banner**

```html
<!-- surgery-management.page.html -->
<ion-banner *ngIf="exclusiveAccessActive" color="warning">
  <ion-icon name="shield-checkmark"></ion-icon>
  
  <div class="banner-content">
    <strong>Validazione in corso</strong>
    <p>{{ exclusiveAccessOwner.username }} sta validando la surgery. Altre modifiche non sono possibili.</p>
  </div>
</ion-banner>
```

**3. Permission Denied Message**

```typescript
// surgery-management.page.ts
this.socketService.onError().subscribe((error) => {
  if (error.code === 'UNAUTHORIZED') {
    this.presentAlert(
      'Accesso Negato',
      'Non hai i permessi per accedere alla validazione. Contatta un supervisore.'
    );
  }
});
```

**Deliverables UI:**

- ✅ Modal "Attesa Exclusive Access" con lista blockers
- ✅ Banner "Validazione in corso" quando altri validano
- ✅ Disable tutti i tab durante exclusive access altrui
- ✅ Alert "Permessi insufficienti"
- ✅ Button "Richiedi Rilascio" integrato con Area 7.5

---

## 3. Area 7.7 - Exclusive Resource Access 🟡 MEDIA

### 3.1 Backend Implementation (1.5h)

**Task:** Stato IN_PROGRESS = max 1 utente su tutta la risorsa.

**Cosa Include:**

#### Check su Join

```typescript
@SubscribeMessage('resource:join')
async handleResourceJoin(
  @MessageBody() data: GenericResourceJoinDto,
  @ConnectedSocket() client: TypedSocket,
) {
  const { resourceType, resourceUuid } = data;
  
  // Validate risorsa
  const resource = await this.validateResource(resourceType, resourceUuid);
  
  // Check stato IN_PROGRESS
  if (resource.status === 'IN_PROGRESS') {
    // Check se c'è già qualcuno
    const roomId = this.getRoomId(resourceType, resourceUuid);
    const existingUsers = this.getRoomUsers(roomId);
    
    if (existingUsers.length > 0) {
      // Rifiuta join
      client.emit('error', {
        code: 'EXCLUSIVE_ACCESS_REQUIRED',
        message: 'Risorsa in uso esclusivo',
        context: {
          resourceType,
          resourceUuid,
          currentUser: existingUsers[0].username,
          reason: 'Surgery in stato IN_PROGRESS richiede accesso esclusivo'
        }
      });
      return;
    }
  }
  
  // Procedi con join normale
  // ...
}
```

#### Status Change Hook

```typescript
// Listen eventi cambio stato da REST API
@OnEvent('surgery.status.changed')
async handleSurgeryStatusChange(event: {
  surgeryUuid: string;
  oldStatus: string;
  newStatus: string;
}) {
  if (event.newStatus === 'IN_PROGRESS') {
    // Kick tutti tranne il primo
    const roomId = this.getRoomId('surgery-management', event.surgeryUuid);
    const users = this.getRoomUsers(roomId);
    
    if (users.length > 1) {
      // Notifica e kick tutti tranne il primo
      users.slice(1).forEach(user => {
        this.server.to(user.socketId).emit('resource:exclusive_access_required', {
          reason: 'STATUS_CHANGED_TO_IN_PROGRESS',
          message: 'La surgery è ora in uso esclusivo'
        });
        
        // Force leave dopo 5 secondi
        setTimeout(() => {
          this.forceLeaveRoom(user.socketId, roomId);
        }, 5000);
      });
    }
  }
}
```

#### Test Coverage

```typescript
describe('Exclusive Resource Access', () => {
  it('should allow single user when status=IN_PROGRESS', async () => {});
  it('should reject second user join when status=IN_PROGRESS', async () => {});
  it('should kick extra users when status changes to IN_PROGRESS', async () => {});
  it('should allow multiple users when status=DRAFT', async () => {});
  it('should allow ADMIN bypass (configurable)', async () => {});
});
```

**Deliverables BE:**

- ✅ Status check su join
- ✅ Status change event listener
- ✅ Force leave logic
- ✅ New error code `EXCLUSIVE_ACCESS_REQUIRED`
- ✅ 5+ test E2E

---

### 3.2 Frontend Integration (1h)

**Task:** Gestire exclusive access e kick automatico.

**Cosa Include:**

#### Error Handling

```typescript
// socket-gateway.service.ts
this.socket.on('error', (error) => {
  if (error.code === 'EXCLUSIVE_ACCESS_REQUIRED') {
    this.presentExclusiveAccessAlert(error.context);
  }
});

private async presentExclusiveAccessAlert(context: any) {
  const alert = await this.alertController.create({
    header: 'Accesso Esclusivo',
    message: `${context.currentUser} sta lavorando in modalità esclusiva. Riprova più tardi.`,
    buttons: ['OK'],
    backdropDismiss: false
  });
  
  await alert.present();
  
  // Redirect a lista
  this.router.navigate(['/surgeries']);
}
```

#### Kick Notification

```typescript
// surgery-management.page.ts
this.socketService.on('resource:exclusive_access_required').subscribe((data) => {
  this.presentAlert(
    'Sessione Terminata',
    data.message,
    () => {
      this.router.navigate(['/surgeries']);
    }
  );
});
```

**Deliverables UI:**

- ✅ Alert "Accesso esclusivo richiesto"
- ✅ Auto-redirect a lista on kick
- ✅ Badge "In Uso Esclusivo" nella lista surgery

---

## 4. Area 7.8 - Save/Revision Events ⚡ ALTA

### 4.1 Backend Implementation (2h)

**Task:** Notifica real-time quando risorsa salvata via REST.

**Cosa Include:**

#### Event Emitter Setup

```typescript
// surgery-management.controller.ts
@Patch(':uuid')
async update(
  @Param('uuid') uuid: string,
  @Body() updateDto: UpdateSurgeryDto,
  @Request() req
) {
  // Salva su DB
  const updated = await this.surgeryService.update(uuid, updateDto);
  
  // Crea nuova revisione
  const revision = await this.revisionService.create({
    resourceType: 'surgery-management',
    resourceUuid: uuid,
    data: updated,
    updatedBy: req.user.userId
  });
  
  // Emit evento interno
  this.eventEmitter.emit('resource.updated', {
    resourceType: 'surgery-management',
    resourceUuid: uuid,
    revisionId: revision.id,
    updatedBy: req.user.userId,
    updatedByUsername: req.user.username,
    tabData: updateDto.tabId // Se update specifico tab
  });
  
  return updated;
}
```

#### Gateway Event Listener

```typescript
// socket-gateway.gateway.ts
@OnEvent('resource.updated')
async handleResourceUpdated(event: ResourceUpdatedEvent) {
  const roomId = this.getRoomId(event.resourceType, event.resourceUuid);
  
  // Broadcast a tutti nella room
  this.server.to(roomId).emit('resource:updated', {
    resourceType: event.resourceType,
    resourceUuid: event.resourceUuid,
    revisionId: event.revisionId,
    updatedBy: event.updatedBy,
    updatedByUsername: event.updatedByUsername,
    tabData: event.tabData,
    timestamp: Date.now()
  });
  
  this.logger.log(`Resource updated broadcast to room ${roomId}`, {
    revisionId: event.revisionId,
    updatedBy: event.updatedByUsername
  });
}
```

#### DTO Definitions

```typescript
// socket-gateway.dto.ts
export class ResourceUpdatedDto {
  resourceType: string;
  resourceUuid: string;
  revisionId: string;
  updatedBy: string;
  updatedByUsername: string;
  tabData?: string;  // Optional: quale tab è stato aggiornato
  timestamp: number;
  changesSummary?: string;  // Optional: summary delle modifiche
}

export interface ResourceUpdatedEvent {
  resourceType: string;
  resourceUuid: string;
  revisionId: string;
  updatedBy: string;
  updatedByUsername: string;
  tabData?: string;
}
```

#### Test Coverage

```typescript
describe('Save/Revision Events', () => {
  it('should emit resource:updated when surgery saved', async () => {});
  it('should include revision ID in event payload', async () => {});
  it('should broadcast to all users in room', async () => {});
  it('should not emit if no users in room', async () => {});
  it('should include tab data if tab-specific update', async () => {});
});
```

**Deliverables BE:**

- ✅ EventEmitter2 integration
- ✅ ResourceUpdatedEvent DTO
- ✅ Broadcast logic in gateway
- ✅ 5+ test E2E
- ✅ Documentation update

---

### 4.2 Frontend Integration (1h)

**Task:** Toast notifiche quando altri salvano.

**Cosa Include:**

#### Service Listener

```typescript
// socket-gateway.service.ts
onResourceUpdated(): Observable<ResourceUpdatedDto> {
  return new Observable(observer => {
    this.socket.on('resource:updated', (data: ResourceUpdatedDto) => {
      observer.next(data);
    });
  });
}
```

#### Page Handler

```typescript
// surgery-management.page.ts
ngOnInit() {
  this.socketService.onResourceUpdated()
    .pipe(
      filter(event => event.resourceUuid === this.currentSurgeryUuid),
      filter(event => event.updatedBy !== this.currentUserId) // Ignora miei save
    )
    .subscribe(async (event) => {
      // Show toast
      const toast = await this.toastController.create({
        message: `${event.updatedByUsername} ha salvato modifiche`,
        duration: 3000,
        position: 'top',
        color: 'primary',
        buttons: [
          {
            text: 'Ricarica',
            handler: () => {
              this.reloadSurgeryData();
            }
          }
        ]
      });
      
      await toast.present();
      
      // Auto-reload se non in editing
      if (!this.isCurrentlyEditing()) {
        setTimeout(() => {
          this.reloadSurgeryData();
        }, 3000);
      }
    });
}
```

**Deliverables UI:**

- ✅ Toast "User X ha salvato"
- ✅ Button "Ricarica" nel toast
- ✅ Auto-reload se non in edit mode
- ✅ Badge "Nuova versione disponibile" se in edit

---

## 5. Area 7.9 - Conflict Detection 🟡 MEDIA

### 5.1 Backend Implementation (1.5h)

**Task:** Optimistic locking con revision number.

**Cosa Include:**

#### Lock Acquisition con Revision

```typescript
@SubscribeMessage('resource:subresource_lock')
async handleSubResourceLock(
  @MessageBody() data: {
    resourceType: string;
    resourceUuid: string;
    subResourceId: string;
    currentRevision?: string;  // NEW: revision check
  },
  @ConnectedSocket() client: TypedSocket,
) {
  // Load risorsa
  const resource = await this.loadResource(
    data.resourceType,
    data.resourceUuid
  );
  
  // Check revision se fornita
  if (data.currentRevision && resource.currentRevision !== data.currentRevision) {
    client.emit('error', {
      code: 'REVISION_CONFLICT',
      message: 'Dati cambiati da ultimo caricamento',
      context: {
        expectedRevision: data.currentRevision,
        actualRevision: resource.currentRevision
      }
    });
    return;
  }
  
  // Procedi con lock acquisition
  // ...
  
  // Include revision in lock response
  client.emit('resource:subresource_locked', {
    // ... existing fields
    revisionId: resource.currentRevision
  });
}
```

#### Save con Revision Check

```typescript
// surgery-management.controller.ts
@Patch(':uuid')
async update(
  @Param('uuid') uuid: string,
  @Body() updateDto: {
    data: UpdateSurgeryDto;
    expectedRevision: string;  // NEW: optimistic locking
  },
  @Request() req
) {
  // Load current
  const current = await this.surgeryService.findOne(uuid);
  
  // Check revision
  if (current.revisionId !== updateDto.expectedRevision) {
    throw new ConflictException({
      code: 'REVISION_CONFLICT',
      message: 'Dati modificati da altro utente',
      expectedRevision: updateDto.expectedRevision,
      actualRevision: current.revisionId
    });
  }
  
  // Save
  const updated = await this.surgeryService.update(uuid, updateDto.data);
  
  // Create new revision
  const newRevision = await this.revisionService.create({...});
  
  return {
    ...updated,
    revisionId: newRevision.id
  };
}
```

#### Test Coverage

```typescript
describe('Conflict Detection', () => {
  it('should deny lock if revision mismatch', async () => {});
  it('should allow lock if revision matches', async () => {});
  it('should include revision in lock response', async () => {});
  it('should reject save if revision mismatch (REST)', async () => {});
  it('should create new revision on successful save', async () => {});
});
```

**Deliverables BE:**

- ✅ Revision check in lock acquisition
- ✅ New error code `REVISION_CONFLICT`
- ✅ REST API revision validation
- ✅ 5+ test E2E

---

### 5.2 Frontend Integration (1h)

**Task:** Gestire conflitti revision e reload dati.

**Cosa Include:**

#### Service Update

```typescript
// socket-gateway.service.ts
private currentRevisions: Map<string, string> = new Map();

acquireLock(
  resourceType: string,
  resourceUuid: string,
  subResourceId: string
): Observable<LockResult> {
  const currentRevision = this.currentRevisions.get(resourceUuid);
  
  return new Observable(observer => {
    this.socket.emit('resource:subresource_lock', {
      resourceType,
      resourceUuid,
      subResourceId,
      currentRevision  // Invia revision corrente
    });
    
    this.socket.on('resource:subresource_locked', (data) => {
      // Update revision
      this.currentRevisions.set(resourceUuid, data.revisionId);
      observer.next({ success: true, data });
    });
    
    this.socket.on('error', (error) => {
      if (error.code === 'REVISION_CONFLICT') {
        observer.error(error);
      }
    });
  });
}
```

#### Conflict Handling

```typescript
// surgery-management.page.ts
this.socketService.acquireLock(...).subscribe({
  next: (result) => {
    // Lock acquired
    this.enableEditing();
  },
  error: (error) => {
    if (error.code === 'REVISION_CONFLICT') {
      this.handleRevisionConflict(error);
    }
  }
});

private async handleRevisionConflict(error: any) {
  const alert = await this.alertController.create({
    header: 'Dati Modificati',
    message: 'Un altro utente ha modificato i dati. Vuoi ricaricare?',
    buttons: [
      {
        text: 'Annulla',
        role: 'cancel'
      },
      {
        text: 'Ricarica',
        handler: () => {
          this.reloadSurgeryData().then(() => {
            // Retry lock acquisition
            this.socketService.acquireLock(...).subscribe();
          });
        }
      }
    ],
    backdropDismiss: false
  });
  
  await alert.present();
}
```

**Deliverables UI:**

- ✅ Revision tracking in service
- ✅ Alert "Dati modificati, ricarica?"
- ✅ Auto-reload + retry lock
- ✅ Badge "Conflitto" se save fallisce

---

## 6. Area 7.10 - Admin Force Release Lock 🔵 BASSA

### 6.1 Backend Implementation (1h)

**Task:** API admin per forzare rilascio lock.

**Cosa Include:**

#### REST Endpoint

```typescript
// admin-socket.controller.ts
@Delete('locks/:resourceType/:resourceUuid/:subResourceId')
@UseGuards(AdminGuard)
async forceReleaseLock(
  @Param('resourceType') resourceType: string,
  @Param('resourceUuid') resourceUuid: string,
  @Param('subResourceId') subResourceId: string,
  @Request() req
) {
  // Trova lock
  const lockKey = `${resourceType}:${resourceUuid}:${subResourceId}`;
  const lock = this.gatewayService.getSubResourceLock(lockKey);
  
  if (!lock) {
    throw new NotFoundException('Lock not found');
  }
  
  // Notifica owner
  this.gatewayService.notifyLockOwner(lock.socketId, {
    reason: 'ADMIN_FORCE_RELEASE',
    adminUser: req.user.username
  });
  
  // Release lock
  await this.gatewayService.forceReleaseLock(lockKey);
  
  // Audit log
  this.auditService.log({
    action: 'ADMIN_FORCE_RELEASE_LOCK',
    adminUser: req.user.userId,
    lockOwner: lock.userId,
    lockKey
  });
  
  return { success: true };
}
```

#### Gateway Method

```typescript
// socket-gateway.gateway.ts
async forceReleaseLock(lockKey: string): Promise<void> {
  const lock = this.subResourceLocks.get(lockKey);
  
  if (!lock) {
    return;
  }
  
  // Remove lock
  this.subResourceLocks.delete(lockKey);
  
  // Broadcast unlock
  const roomId = this.getRoomId(lock.resourceType, lock.resourceUuid);
  this.server.to(roomId).emit('resource:subresource_unlocked', {
    resourceType: lock.resourceType,
    resourceUuid: lock.resourceUuid,
    subResourceId: lock.subResourceId,
    reason: 'ADMIN_FORCE_RELEASE',
    releasedBy: {
      userId: lock.userId,
      username: lock.username
    }
  });
  
  this.logger.warn(`Lock force released by admin`, { lockKey });
}

notifyLockOwner(socketId: string, data: any): void {
  this.server.to(socketId).emit('lock:force_released', data);
}
```

**Deliverables BE:**

- ✅ Admin REST endpoint
- ✅ Force release logic
- ✅ Owner notification
- ✅ Audit logging

---

### 6.2 Frontend Admin UI (30min)

**Task:** Admin panel per visualizzare e forzare rilascio lock.

**Cosa Include:**

#### Admin Page

```html
<!-- admin-locks.page.html -->
<ion-header>
  <ion-toolbar>
    <ion-title>Gestione Lock Attivi</ion-title>
  </ion-toolbar>
</ion-header>

<ion-content>
  <ion-list>
    <ion-item *ngFor="let lock of activeLocks">
      <ion-label>
        <h3>{{ lock.resourceType }} - {{ lock.subResourceId }}</h3>
        <p>Locked by: {{ lock.username }}</p>
        <p>Since: {{ lock.lockedAt | date:'short' }}</p>
      </ion-label>
      
      <ion-button 
        slot="end" 
        color="danger" 
        (click)="forceRelease(lock)">
        Force Release
      </ion-button>
    </ion-item>
  </ion-list>
</ion-content>
```

**Deliverables UI:**

- ✅ Admin page lista lock
- ✅ Button "Force Release"
- ✅ Confirmation alert

---

## 7. Area 7.11 - Orphan Lock Cleanup Job 🟡 MEDIA

### 7.1 Backend Implementation (1.5h)

**Task:** Background job pulizia lock orfani.

**Cosa Include:**

#### Cron Job Setup

```typescript
// socket-gateway.service.ts
@Cron('*/5 * * * *')  // Every 5 minutes
async cleanupOrphanLocks() {
  const now = Date.now();
  const LOCK_TTL = 3 * 60 * 60 * 1000;  // 3 ore
  const GRACE_PERIOD = 30 * 60 * 1000;  // 30 min extra
  
  const orphanThreshold = now - LOCK_TTL - GRACE_PERIOD;
  
  const orphanLocks: SubResourceLock[] = [];
  
  // Scan tutti i lock
  for (const [key, lock] of this.subResourceLocks.entries()) {
    // Check se lock troppo vecchio
    if (lock.lockedAt < orphanThreshold) {
      orphanLocks.push(lock);
    }
  }
  
  // Release orphan locks
  for (const lock of orphanLocks) {
    this.logger.warn(`Orphan lock detected and released`, {
      lockKey: `${lock.resourceType}:${lock.resourceUuid}:${lock.subResourceId}`,
      ownerId: lock.userId,
      age: now - lock.lockedAt
    });
    
    await this.forceReleaseLock(
      `${lock.resourceType}:${lock.resourceUuid}:${lock.subResourceId}`
    );
  }
  
  if (orphanLocks.length > 0) {
    this.logger.log(`Cleanup completed: ${orphanLocks.length} orphan locks released`);
  }
}
```

#### Metrics

```typescript
getOrphanLockMetrics(): {
  totalLocks: number;
  oldLocks: number;  // > 3h
  orphanLocks: number;  // > 3h30m
} {
  const now = Date.now();
  const LOCK_TTL = 3 * 60 * 60 * 1000;
  const ORPHAN_THRESHOLD = LOCK_TTL + 30 * 60 * 1000;
  
  let oldLocks = 0;
  let orphanLocks = 0;
  
  for (const lock of this.subResourceLocks.values()) {
    const age = now - lock.lockedAt;
    
    if (age > LOCK_TTL) {
      oldLocks++;
    }
    
    if (age > ORPHAN_THRESHOLD) {
      orphanLocks++;
    }
  }
  
  return {
    totalLocks: this.subResourceLocks.size,
    oldLocks,
    orphanLocks
  };
}
```

**Deliverables BE:**

- ✅ Cron job ogni 5 minuti
- ✅ Orphan detection (3h30m threshold)
- ✅ Force release con logging
- ✅ Metrics endpoint

---

## 8. Area 7.12 - Socket-Specific Logger 🟡 MEDIA

### 8.1 Backend Implementation (1h)

**Task:** File log separato per eventi socket.

**Cosa Include:**

#### Winston Daily Rotate File

```typescript
// socket-gateway-logger.config.ts
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

export const socketGatewayLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/socket-gateway-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
      level: 'info'
    }),
    new DailyRotateFile({
      filename: 'logs/socket-gateway-error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true,
      level: 'error'
    })
  ]
});
```

#### Gateway Integration

```typescript
// socket-gateway.gateway.ts
import { socketGatewayLogger } from './socket-gateway-logger.config';

export class SocketGatewayGateway {
  private readonly socketLogger = socketGatewayLogger;
  
  @SubscribeMessage('resource:join')
  async handleResourceJoin(...) {
    this.socketLogger.info('Resource join attempt', {
      userId: client.data.user.userId,
      username: client.data.user.username,
      resourceType: data.resourceType,
      resourceUuid: data.resourceUuid,
      socketId: client.id,
      timestamp: Date.now()
    });
    
    // ... rest of handler
  }
}
```

**Deliverables BE:**

- ✅ Separate log file `socket-gateway-YYYY-MM-DD.log`
- ✅ Log rotation (20MB, 14 giorni)
- ✅ Gzip compression
- ✅ Structured JSON format

---

## 📊 Summary Priorità e Timeline

### ⚡ Priorità ALTA (6-8 giorni)

| Area | Task | BE (ore) | UI (ore) | Totale |
|------|------|----------|----------|--------|
| 7.5 | Lock Force Request | 2h | 2h | 4h |
| 7.6 | Validation Access Control | 2h | 1.5h | 3.5h |
| 7.8 | Save/Revision Events | 2h | 1h | 3h |

**Totale ALTA:** 10.5h (~1.5 settimane part-time)

---

### 🟡 Priorità MEDIA (4-6 giorni)

| Area | Task | BE (ore) | UI (ore) | Totale |
|------|------|----------|----------|--------|
| 7.7 | Exclusive Resource Access | 1.5h | 1h | 2.5h |
| 7.9 | Conflict Detection | 1.5h | 1h | 2.5h |
| 7.11 | Orphan Lock Cleanup | 1.5h | 0h | 1.5h |
| 7.12 | Socket-Specific Logger | 1h | 0h | 1h |

**Totale MEDIA:** 7.5h (~1 settimana part-time)

---

### 🔵 Priorità BASSA (Backlog)

| Area | Task | BE (ore) | UI (ore) | Totale |
|------|------|----------|----------|--------|
| 7.10 | Admin Force Release | 1h | 0.5h | 1.5h |

**Totale BASSA:** 1.5h

---

## 🎯 Roadmap Esecuzione Consigliata

### Sprint 1 (Settimana 1)

1. Area 7.8 - Save/Revision Events (⚡ ALTA)
2. Area 7.6 - Validation Access (⚡ ALTA)

### Sprint 2 (Settimana 2)

3. Area 7.5 - Lock Force Request (⚡ ALTA)
4. Area 7.9 - Conflict Detection (🟡 MEDIA)

### Sprint 3 (Settimana 3)

5. Area 7.7 - Exclusive Access (🟡 MEDIA)
6. Area 7.11 - Orphan Cleanup (🟡 MEDIA)
7. Area 7.12 - Logger (🟡 MEDIA)

### Backlog (Da schedulare)

8. Area 7.10 - Admin Force Release (🔵 BASSA)

---

**Documento generato:** 13 Novembre 2025  
**Versione:** 1.0  
**Totale Ore Rimanenti:** ~19.5h (~3 settimane part-time)
