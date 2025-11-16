# Interfacce TypeScript (contratti minimi)

Queste interfacce sono il contratto che gli adapters / l'applicazione devono implementare per usare CollaborNest.

## `IResourceAdapter` (esempio)
```ts
export interface IResourceAdapter<T = any> {
  // Recupera l'entità principale
  findOne(resourceId: string): Promise<T | null>;

  // Opzionale: recupera sotto-risorsa
  findChild?(resourceId: string, childId: string): Promise<any | null>;

  // Crea/merge e ritorna l'id della nuova revisione o entità
  saveRevision(resourceId: string, payload: { 
    revisionId?: string; 
    patch?: any; 
    metadata?: any 
  }): Promise<{ revisionId: string }>;

  // Opzionale: metodo per validazione/applicazione patch
  applyPatch?(current: any, patch: any): Promise<any>;

  // Ritorna un identificativo univoco per una nuova entità
  createId?(): string;
}
```

## `IPresenceStore` (esempio)
```ts
export interface IPresenceStore {
  join(
    resource: string, 
    subresource: string | null, 
    userId: string, 
    mode: 'viewer'|'editor', 
    metadata?: any
  ): Promise<void>;

  leave(
    resource: string, 
    subresource: string | null, 
    userId: string
  ): Promise<void>;

  list(
    resource: string, 
    subresource?: string | null
  ): Promise<Array<{ 
    userId: string; 
    mode: 'viewer'|'editor'; 
    since: number; 
    metadata?: any 
  }>>;

  count(
    resource: string, 
    subresource?: string | null
  ): Promise<{ viewers: number; editors: number }>;
}
```

## `ILockManager`
```ts
export interface ILockManager {
  lock(
    resource: string, 
    subresource?: string | null, 
    owner: string, 
    ttlMs?: number
  ): Promise<{ lockId: string; expiresAt: number }>;

  unlock(
    resource: string, 
    subresource?: string | null, 
    lockId: string
  ): Promise<boolean>;

  getLock(
    resource: string, 
    subresource?: string | null
  ): Promise<{ 
    lockId: string | null; 
    owner?: string; 
    expiresAt?: number 
  }>;
}
```

## Note

* Fornisci implementazioni basate su Redis (consigliato) o DB per `IPresenceStore` e `ILockManager`.
* I metodi devono essere resilienti (retries, idempotenza).
