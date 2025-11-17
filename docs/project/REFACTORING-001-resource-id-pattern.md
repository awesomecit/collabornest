# REFACTORING-001: Resource ID Pattern Standardization

**Status**: PROPOSED  
**Created**: 2025-11-17  
**Author**: AI + Antonio Cittadino  
**Epic**: EPIC-004 Resource Configuration Management

---

## 📋 Executive Summary

Standardize Resource ID pattern to be **Redis-like**, **domain-agnostic**, **flexible**, and **SOLID/DRY compliant**.

**Current State**: Hardcoded types (`surgery-management`, `patient_record`), inconsistent sub-resource naming (`/tab:`, `/field:`).

**Proposed State**: Generic pattern with Single Source of Truth (SSOT) for all magic strings, configurable via ResourceConfigRegistry.

---

## 🎯 Goals

1. **Domain Agnostic**: Support any domain (surgery, books, e-commerce) without code changes
2. **Redis-like**: Hierarchical keys with `:` and `/` separators (e.g., `user:123`, `book:456/chapter:2`)
3. **SSOT**: All patterns, separators, and event names in centralized constants
4. **SOLID/DRY**: No magic strings scattered across codebase
5. **Flexible Relations**: Support 1:1, 1:N, N:1, N:M via sub-resource metadata

---

## 📐 Current Pattern Analysis

### Current Format

```typescript
// Root resource
'resourceType:uuid';
// Examples:
'surgery-management:abc-123';
'patient_record:12345';
'page:/patient/12345'; // Path separator ambiguity

// Sub-resource (1-level only)
'resourceType:uuid/subType:subId';
// Examples:
'surgery-management:abc-123/field:anesthesia-notes';
'document:999/tab:patient-info';
```

### Problems

❌ **Hardcoded Types**: `ResourceType` enum limits to predefined domains  
❌ **Inconsistent Sub-types**: `/tab:`, `/field:`, `/section:` - no standard  
❌ **Magic Strings**: Event names (`resource:all_users`) scattered in code  
❌ **Vertical Coupling**: `/tab:` too UI-specific, not domain-relational  
❌ **Limited Relations**: No metadata for 1:N, N:M relationships  
❌ **Path Ambiguity**: `page:/patient/123` vs `page:123/field:x` confusion

---

## 🚀 Proposed Pattern (Redis-like)

### Core Pattern

```
<namespace>:<entityType>:<entityId>[/<relationType>:<relatedId>]
```

### Examples

```typescript
// Healthcare domain
'healthcare:surgery:abc-123'; // Root surgery
'healthcare:surgery:abc-123/section:anesthesia'; // Sub-section (1:1)
'healthcare:patient:12345'; // Patient record
'healthcare:patient:12345/appointment:apt-789'; // Appointment (1:N)

// Book review domain
'bookreview:book:isbn-978-3'; // Root book
'bookreview:book:isbn-978-3/chapter:2'; // Chapter (1:N)
'bookreview:book:isbn-978-3/review:rev-456'; // Review (1:N)

// E-commerce domain
'ecommerce:order:ord-999'; // Order
'ecommerce:order:ord-999/item:line-1'; // Order line item (1:N)

// Document collaboration (UI-agnostic)
'document:doc-999'; // Document root
'document:doc-999/section:patient-info'; // Section (not "tab")
'document:doc-999/section:diagnosis'; // Section
'document:doc-999/annotation:ann-123'; // Annotation (N:M)
```

### Key Changes

✅ **Namespace Prefix**: `<namespace>:` for multi-tenancy/domain isolation  
✅ **Entity-Centric**: `entityType` instead of hardcoded `surgery-management`  
✅ **Relation-Based**: `/relationType:` describes relationship, not UI concept  
✅ **Configurable**: All patterns defined in `ResourceIdPattern` constants

---

## 🏗️ Proposed Architecture

### 1. Resource ID Pattern Constants (SSOT)

```typescript
// src/websocket-gateway/constants/resource-id-pattern.ts

/**
 * Single Source of Truth for Resource ID patterns
 *
 * Redis-like hierarchical keys with configurable separators.
 * All magic strings and patterns centralized here (SOLID, DRY).
 */
export const ResourceIdPattern = {
  /** Namespace separator (e.g., "healthcare:surgery") */
  NAMESPACE_SEP: ':' as const,

  /** Entity type separator (e.g., "surgery:abc-123") */
  ENTITY_SEP: ':' as const,

  /** Sub-resource separator (e.g., "surgery:123/section:notes") */
  SUB_RESOURCE_SEP: '/' as const,

  /** Relation type separator (e.g., "/section:notes") */
  RELATION_SEP: ':' as const,

  /** Full pattern regex */
  PATTERN: /^([^:]+):([^:]+):([^/]+)(?:\/([^:]+):(.+))?$/ as const,

  /** Validation: min/max lengths */
  MIN_NAMESPACE_LENGTH: 3,
  MAX_NAMESPACE_LENGTH: 50,
  MIN_ENTITY_ID_LENGTH: 1,
  MAX_ENTITY_ID_LENGTH: 255,
} as const;

/**
 * Relation type metadata (describes parent-child relationship)
 */
export enum RelationType {
  /** 1:1 relationship (e.g., surgery → main content) */
  SECTION = 'section',

  /** 1:N relationship (e.g., book → chapters) */
  CHILD = 'child',

  /** N:1 relationship (e.g., comments → post) */
  PARENT_REF = 'parent_ref',

  /** N:M relationship (e.g., tags ↔ posts) */
  ASSOCIATION = 'association',

  /** Annotation/comment (special case of N:M) */
  ANNOTATION = 'annotation',

  /** Custom relation (defined by domain config) */
  CUSTOM = 'custom',
}

/**
 * Sub-resource metadata (describes relationship cardinality)
 */
export interface SubResourceMetadata {
  /** Relation type */
  relationType: RelationType;

  /** Cardinality: '1:1', '1:N', 'N:1', 'N:M' */
  cardinality: '1:1' | '1:N' | 'N:1' | 'N:M';

  /** Can this sub-resource exist independently? */
  cascade: boolean;

  /** Display name for UI (optional) */
  displayName?: string;

  /** Custom metadata (domain-specific) */
  metadata?: Record<string, unknown>;
}
```

### 2. Enhanced ResourceId Interface

```typescript
// src/websocket-gateway/types/resource.types.ts

/**
 * Parsed Resource ID with namespace support
 */
export interface ResourceId {
  /** Full resource ID string */
  readonly id: string;

  /** Namespace (e.g., "healthcare", "bookreview") */
  readonly namespace: string;

  /** Entity type (e.g., "surgery", "book") */
  readonly entityType: string;

  /** Entity identifier (e.g., "abc-123", "isbn-978-3") */
  readonly entityId: string;

  /** Parent resource ID (if sub-resource) */
  readonly parentId?: string;

  /** Relation type (e.g., "section", "chapter") */
  readonly relationType?: string;

  /** Related entity identifier */
  readonly relatedId?: string;

  /** Sub-resource metadata (from config) */
  readonly subResourceMetadata?: SubResourceMetadata;
}

/**
 * Parse resource ID string (Redis-like pattern)
 *
 * @example
 * parseResourceId("healthcare:surgery:abc-123")
 * // => { namespace: "healthcare", entityType: "surgery", entityId: "abc-123" }
 *
 * @example
 * parseResourceId("healthcare:surgery:abc-123/section:anesthesia")
 * // => {
 * //   namespace: "healthcare",
 * //   entityType: "surgery",
 * //   entityId: "abc-123",
 * //   parentId: "healthcare:surgery:abc-123",
 * //   relationType: "section",
 * //   relatedId: "anesthesia"
 * // }
 */
export function parseResourceId(
  resourceIdString: string,
  configRegistry?: ResourceConfigRegistryService,
): ResourceId {
  const match = resourceIdString.match(ResourceIdPattern.PATTERN);

  if (!match) {
    throw new Error(
      `Invalid resource ID: "${resourceIdString}". ` +
        `Expected format: namespace:entityType:entityId[/relationType:relatedId]`,
    );
  }

  const [, namespace, entityType, entityId, relationType, relatedId] = match;

  // Validate lengths
  if (namespace.length < ResourceIdPattern.MIN_NAMESPACE_LENGTH) {
    throw new Error(`Namespace too short: "${namespace}"`);
  }

  const result: ResourceId = {
    id: resourceIdString,
    namespace,
    entityType,
    entityId,
  };

  // Parse sub-resource if present
  if (relationType && relatedId) {
    result.parentId = `${namespace}:${entityType}:${entityId}`;
    result.relationType = relationType;
    result.relatedId = relatedId;

    // Load metadata from config (if available)
    if (configRegistry) {
      const config = configRegistry.getByEntityType(namespace, entityType);
      result.subResourceMetadata = config?.subResources?.find(
        sr => sr.relationType === relationType,
      );
    }
  }

  return result;
}

/**
 * Build resource ID from components
 */
export function buildResourceId(
  namespace: string,
  entityType: string,
  entityId: string,
  relationType?: string,
  relatedId?: string,
): string {
  const { NAMESPACE_SEP, ENTITY_SEP, SUB_RESOURCE_SEP, RELATION_SEP } =
    ResourceIdPattern;

  let id = `${namespace}${NAMESPACE_SEP}${entityType}${ENTITY_SEP}${entityId}`;

  if (relationType && relatedId) {
    id += `${SUB_RESOURCE_SEP}${relationType}${RELATION_SEP}${relatedId}`;
  }

  return id;
}
```

### 3. WebSocket Event Names (SSOT)

```typescript
// src/websocket-gateway/constants/ws-events.enum.ts

/**
 * WebSocket Event Names (Single Source of Truth)
 *
 * All event names centralized for type-safety and refactoring.
 */
export enum WsEvent {
  // Connection lifecycle
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',

  // Resource presence (generic)
  RESOURCE_JOIN = 'resource:join',
  RESOURCE_JOINED = 'resource:joined',
  RESOURCE_LEAVE = 'resource:leave',
  RESOURCE_LEFT = 'resource:left',

  // User presence notifications
  USER_JOINED = 'user:joined',
  USER_LEFT = 'user:left',
  PRESENCE_UPDATE = 'presence:update',

  // Multi-resource presence (parent-child)
  RESOURCE_USERS = 'resource:users', // Current resource only
  RESOURCE_ALL_USERS = 'resource:all_users', // All sub-resources (parent aware)

  // Lock management
  LOCK_ACQUIRE = 'lock:acquire',
  LOCK_ACQUIRED = 'lock:acquired',
  LOCK_RELEASE = 'lock:release',
  LOCK_RELEASED = 'lock:released',
  LOCK_STOLEN = 'lock:stolen',

  // Activity tracking
  ACTIVITY_PING = 'activity:ping',
  ACTIVITY_PONG = 'activity:pong',

  // Y.js CRDT sync
  SYNC_STEP_1 = 'sync:step1',
  SYNC_STEP_2 = 'sync:step2',
  SYNC_UPDATE = 'sync:update',
  AWARENESS_UPDATE = 'awareness:update',

  // Server management
  SERVER_SHUTDOWN = 'server:shutdown',
}

/**
 * Event name builder for dynamic events (if needed)
 */
export const WsEventBuilder = {
  /**
   * Build resource-specific event name
   * @example resourceEvent('join', 'healthcare:surgery:123') => 'resource:join:healthcare:surgery:123'
   */
  resourceEvent: (action: string, resourceId: string): string =>
    `resource:${action}:${resourceId}`,

  /**
   * Build user-specific event name
   * @example userEvent('status', 'user-456') => 'user:status:user-456'
   */
  userEvent: (action: string, userId: string): string =>
    `user:${action}:${userId}`,
} as const;
```

### 4. Resource Config Registry (Domain-Agnostic)

```typescript
// src/websocket-gateway/config/resource-config.types.ts

/**
 * Resource configuration (domain-agnostic)
 */
export interface ResourceConfig {
  /** Namespace (e.g., "healthcare", "bookreview") */
  namespace: string;

  /** Entity type (e.g., "surgery", "book") */
  entityType: string;

  /** Human-readable display name */
  displayName: string;

  /** Concurrency limits */
  concurrency: ConcurrencyLimit;

  /** Sub-resources (with relationship metadata) */
  subResources: SubResourceConfig[];

  /** State transitions (optional) */
  stateTransitions?: StateTransition[];

  /** Locked states (optional) */
  lockedStates?: ResourceState[];

  /** Custom metadata (domain-specific) */
  metadata?: Record<string, unknown>;
}

/**
 * Sub-resource configuration (relationship-aware)
 */
export interface SubResourceConfig {
  /** Relation type (e.g., "section", "chapter") */
  relationType: string;

  /** Display name */
  displayName: string;

  /** Relationship metadata */
  relationship: SubResourceMetadata;

  /** Concurrency limits for this sub-resource */
  concurrency: ConcurrencyLimit;

  /** Edit roles */
  editRoles: UserRole[];

  /** View roles */
  viewRoles: UserRole[];

  /** Requires lock for editing? */
  requiresLock: boolean;
}

/**
 * Resource Config Registry Service
 */
@Injectable()
export class ResourceConfigRegistryService {
  private registry: Map<string, ResourceConfig> = new Map();

  /**
   * Register resource config (domain-agnostic)
   */
  register(config: ResourceConfig): ValidationResult {
    const key = this.buildConfigKey(config.namespace, config.entityType);

    // Validate config
    const validation = this.validate(config);
    if (!validation.valid) {
      return validation;
    }

    this.registry.set(key, config);
    return { valid: true, errors: [] };
  }

  /**
   * Get config by namespace + entity type
   */
  getByEntityType(
    namespace: string,
    entityType: string,
  ): ResourceConfig | null {
    const key = this.buildConfigKey(namespace, entityType);
    return this.registry.get(key) || null;
  }

  /**
   * Get config by full resource ID
   */
  getByResourceId(resourceId: string): ResourceConfig | null {
    const parsed = parseResourceId(resourceId);
    return this.getByEntityType(parsed.namespace, parsed.entityType);
  }

  /**
   * List all registered namespaces
   */
  listNamespaces(): string[] {
    const namespaces = new Set<string>();
    for (const config of this.registry.values()) {
      namespaces.add(config.namespace);
    }
    return Array.from(namespaces);
  }

  /**
   * List entity types for namespace
   */
  listEntityTypes(namespace: string): string[] {
    return Array.from(this.registry.values())
      .filter(c => c.namespace === namespace)
      .map(c => c.entityType);
  }

  private buildConfigKey(namespace: string, entityType: string): string {
    return `${namespace}:${entityType}`;
  }
}
```

---

## 🔄 Migration Strategy

### Phase 1: Add New Pattern (Non-Breaking)

1. **Add constants**: Create `resource-id-pattern.ts` with SSOT
2. **Add new functions**: `parseResourceIdV2()`, `buildResourceIdV2()`
3. **Keep old functions**: Mark as `@deprecated`, working alongside
4. **Add tests**: Unit tests for new pattern

### Phase 2: Dual Support (Coexistence)

1. **Auto-detect format**: Gateway checks old vs new pattern
2. **Translate internally**: Convert old → new for processing
3. **Emit both formats**: Clients receive both (backward compat)
4. **Update docs**: Migration guide for clients

### Phase 3: Deprecation (Breaking Change)

1. **Remove old functions**: After 2 minor versions
2. **Update CHANGELOG.md**: Document breaking change
3. **Bump major version**: Follow semver (e.g., v1.0.0 → v2.0.0)
4. **Provide migration tool**: Script to convert old IDs

---

## 📊 Comparison Table

| Aspect                | Current Pattern            | Proposed Pattern                                 |
| --------------------- | -------------------------- | ------------------------------------------------ |
| **Format**            | `type:id/subType:subId`    | `namespace:entityType:id/relationType:relatedId` |
| **Namespace**         | ❌ None                    | ✅ Multi-tenant support                          |
| **Domain Agnostic**   | ❌ Hardcoded types         | ✅ Configurable                                  |
| **SSOT**              | ❌ Magic strings scattered | ✅ Centralized constants                         |
| **Relation Metadata** | ❌ No metadata             | ✅ 1:1, 1:N, N:M support                         |
| **Redis-like**        | ⚠️ Partial                 | ✅ Full hierarchical keys                        |
| **UI Coupling**       | ❌ `/tab:` UI-specific     | ✅ `/section:` domain-agnostic                   |
| **Extensibility**     | ❌ Enum-limited            | ✅ Runtime registration                          |

---

## 🧪 Example Configurations

### Healthcare: Surgery Management

```typescript
const surgeryConfig: ResourceConfig = {
  namespace: 'healthcare',
  entityType: 'surgery',
  displayName: 'Surgical Operation',
  concurrency: { maxEditors: 1, maxViewers: 5 },
  subResources: [
    {
      relationType: 'section',
      displayName: 'Main Content',
      relationship: {
        relationType: RelationType.SECTION,
        cardinality: '1:1',
        cascade: true,
      },
      concurrency: { maxEditors: 1, maxViewers: 0 },
      editRoles: [UserRole.SURGEON],
      viewRoles: [],
      requiresLock: true,
    },
    {
      relationType: 'annotation',
      displayName: 'Annotations',
      relationship: {
        relationType: RelationType.ANNOTATION,
        cardinality: 'N:M',
        cascade: false,
      },
      concurrency: { maxEditors: 0, maxViewers: 0 },
      editRoles: [UserRole.SURGEON, UserRole.NURSE],
      viewRoles: [UserRole.SURGEON, UserRole.NURSE, UserRole.ANESTHESIOLOGIST],
      requiresLock: false,
    },
  ],
};
```

### Book Review Platform

```typescript
const bookConfig: ResourceConfig = {
  namespace: 'bookreview',
  entityType: 'book',
  displayName: 'Book',
  concurrency: { maxEditors: 0, maxViewers: 0 }, // Unlimited readers
  subResources: [
    {
      relationType: 'chapter',
      displayName: 'Chapter',
      relationship: {
        relationType: RelationType.CHILD,
        cardinality: '1:N',
        cascade: true, // Delete book → delete chapters
      },
      concurrency: { maxEditors: 1, maxViewers: 0 },
      editRoles: [UserRole.AUTHOR],
      viewRoles: [UserRole.READER],
      requiresLock: false,
    },
    {
      relationType: 'review',
      displayName: 'Review',
      relationship: {
        relationType: RelationType.CHILD,
        cardinality: '1:N',
        cascade: false, // Delete book → keep reviews
      },
      concurrency: { maxEditors: 0, maxViewers: 0 },
      editRoles: [UserRole.READER],
      viewRoles: [UserRole.READER],
      requiresLock: false,
    },
  ],
};
```

---

## ✅ Benefits

1. **Domain Flexibility**: Add new domains (book-review, e-commerce) without code changes
2. **Type Safety**: TypeScript types + SSOT constants prevent typos
3. **Redis Compatibility**: Can store in Redis with SCAN, KEYS patterns
4. **Relation Clarity**: `/section:` vs `/chapter:` describes relationship, not UI
5. **SOLID/DRY**: No magic strings, centralized configuration
6. **Testability**: Easy to mock/stub ResourceConfigRegistry
7. **Scalability**: Namespace isolation for multi-tenancy

---

## 🚨 Breaking Changes

- **Resource ID format**: Old clients must update or use translation layer
- **Event names**: Already centralized in `WsEvent` enum (no change needed)
- **Config registration**: Must provide namespace + entityType

---

## 📝 TODO

- [ ] Create `ResourceIdPattern` constants file
- [ ] Implement `parseResourceIdV2()` and `buildResourceIdV2()`
- [ ] Add unit tests (100% coverage for parsing logic)
- [ ] Update `ResourceConfigRegistryService` to support namespaces
- [ ] Add migration guide to `docs/MIGRATION.md`
- [ ] Update BDD tests to use new pattern
- [ ] Update UI documentation with examples

---

## 🔗 References

- **Redis Key Design**: https://redis.io/docs/manual/keyspace/
- **SOLID Principles**: Single Responsibility, Open/Closed, DRY
- **Domain-Driven Design**: Ubiquitous Language, Bounded Contexts
- **Resource Config Registry**: `src/websocket-gateway/services/resource-config-registry.service.ts`
