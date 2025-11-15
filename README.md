# CollaborNest — Collaborative layer per applicazioni Node/Nest

**CollaborNest** (working name) è una libreria open-source per aggiungere un livello collaborativo *top of the app* su stack Node.js/NestJS con Socket.IO, Redis e RabbitMQ.  
Pensata per casi d'uso gestionali / healthcare, fornisce: presenza, locking, gestione editor/viewer, riconciliazione/monitoring, e un modello generico di risorse/root→child.

## Caratteristiche principali
- Architettura modulare: core socket, presence, monitoraggio, adapter generico per risorse.
- Modalità `viewer` e `editor`.
- Lock/unlock e join/leave su risorse e sotto-risorse.
- Limiti configurabili (per risorsa e per sotto-risorsa).
- Recovery path e edge-case handling (connessioni morte, riconciliazione).
- Estendibile: basta implementare un'interfaccia minima (findOne, create identificativo, ecc).
- Integrabile con Redis (pub/sub + state), RabbitMQ per eventi cross-service.

## Quando usarla
- Aggiungere collaborazione in tempo reale (editing/visualizzazione) su applicazioni gestionali.
- Sistemi healthcare con requisiti di contesa accessi e auditing.
- Applicazioni con molte istanze (scalabilità via Redis + RabbitMQ).

## Quick start (monorepo PNPM)
```bash
# clona repo
git clone <repo-url>
cd collabornest

# installa dipendenze
pnpm install

# esempio: avvia il service core in dev
pnpm --filter @collab/core dev
```

## Contenuti della repo

* `packages/` - pacchetti monorepo (core, presence, monitor, adapters, examples)
* `docs/` - documentazione (API, interfacce)
* `examples/` - progetti di esempio (NestJS app integrata)
* `scripts/` - automazioni e helper
* `README.md`, `CONTRIBUTING.md`, `LICENSE`

## Roadmap (high level)

1. PoC e test end-to-end su root->child (root→sottorisorsa)
2. Implementare presenza e locking
3. Monitoraggio connessioni morte / conflict detection (integrazione con log revision)
4. Feature git-like per revisioni (v1.1)
5. SDK client (JS/TS), integrazione con frontend (React/Vue)

## Contribuire

Leggi `CONTRIBUTING.md`. Issue & PR benvenute. Cerchiamo contributori su testing, adapters e documentazione.

## Licenza

MIT — vedi `LICENSE`.
