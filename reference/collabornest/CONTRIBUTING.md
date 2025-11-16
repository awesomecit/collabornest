# Contributing to CollaborNest

Grazie per voler contribuire! Segui queste linee guida per velocizzare review e merge.

## Setup locale
- Node 18+ raccomandato
- pnpm

```bash
pnpm install
pnpm --filter @collab/core dev
```

## Codice

* TypeScript
* ESLint + Prettier (config in root)
* Tests: Jest (unit) e test integrati per socket flows

## Workflow PR

1. Crea una branch: `feat/descrizione` o `fix/descrizione`
2. Apri PR con descrizione e passi per riprodurre
3. Aggiungi test automatici (se possibile)
4. Tagga @maintainers per review

## Issue template

* Titolo sintetico
* Steps per riprodurre
* Comportamento atteso vs osservato
* Log, versione e environ

## Comunicazione

* Usa GitHub Issues e Project board

## Quality scripts

Prima di fare commit:

```bash
pnpm quality        # lint check
pnpm quality:fix    # auto-fix
pnpm test           # run tests
```

## Convenzioni di codice

* Strong typing: evita `any`, usa types espliciti
* Naming: singular per entities, plural per resources
* Test: TDD approach, scrivi i test prima della feature
* Commits: messaggi chiari e atomici

## Testing

* Unit tests in `src/**/*.spec.ts`
* Integration tests in `test/`
* E2E tests per socket flows

## Documentazione

Se aggiungi nuove API o interfacce, aggiorna `docs/API.md` e `docs/INTERFACES.md`.
