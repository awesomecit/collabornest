# AI-Assisted Development Prompts

Questa directory contiene workflow interattivi progettati per essere eseguiti da Copilot Agent, eliminando la necessità di generare file statici di contesto.

## Filosofia: Agent-Driven vs File-Driven

### ❌ Approccio Tradizionale (File-Driven)

```bash
# Ogni mattina
./scripts/prepare-copilot-context.sh
cat /tmp/copilot-context-*.md  # 2250 token
# Copia tutto in Copilot Agent
# Agent deve parsare, interpretare, decidere

Token: ~2500
Tempo: ~5 min
Flessibilità: Bassa (template fisso)
```

### ✅ Nuovo Approccio (Agent-Driven)

```bash
# In Copilot Agent chat
"Execute morning-context-builder.md workflow"

# Agent fa domande mirate
# Esegue comandi dinamicamente
# Raccoglie SOLO info necessarie
# Si adatta al tipo di task

Token: ~1000-1500 (risparmio 40-60%)
Tempo: ~3 min
Flessibilità: Alta (si adatta al task)
```

---

## File Disponibili

### 1. `morning-context-builder.md`

**Quando usare:** Inizio giornata, prima di iniziare qualsiasi task

**Cosa fa:**

- Triage interattivo (new feature / debug / continue / review / explore)
- Raccolta contesto basata sul tipo di task
- Pre-analisi mirata (no grep inutili)
- Generazione checkpoint opzionale
- Selezione modalità di lavoro (guided/auto/pair)

**Come usare:**

```
[In Copilot Agent]
User: "Execute morning-context-builder.md workflow"

Agent: "Good morning! Quick triage (answer with number):
        1. Starting new feature/task
        2. Debugging existing issue
        3. Continuing yesterday's work
        4. Code review/refactoring
        5. Just exploring codebase

        Your choice: ___"

User: "2"

Agent: "Describe the bug in one sentence: ___"
User: "dry-run modifies files"

Agent: [Automatically gathers context, shows hypothesis]
        "Analysis: Last touched scripts/auto-release.js...
         Hypothesis: Missing --dry-run flag
         Proceed with verification? ___"
```

**Risparmio:** ~60% token vs prepare-copilot-context.sh

### 2. `daily-debug-session.md`

**Quando usare:** Sessione di debug complessa, multi-file, unknown root cause

**Cosa fa:**

- 7-phase structured debugging
- Issue intake (4 domande chiave)
- Automatic context gathering
- Targeted pre-analysis (basato su keywords)
- Hypothesis generation
- Iterative debugging (step-by-step)
- Fix proposal (minimal diff)
- Verification & cleanup

**Come usare:**

```
[In Copilot Agent]
User: "Execute daily-debug-session.md workflow"

Agent: [Phase 1 - Issue Intake]
       "What's broken? ___"
       "How to reproduce? ___"
       "Expected behavior? ___"
       "Actual behavior? ___"

User: [Risposte concise]

Agent: [Phase 2 - Auto context]
       [Reads package.json, git status, relevant configs]

       [Phase 3 - Targeted pre-analysis]
       [Based on keywords, runs appropriate greps]

       [Phase 4 - Hypothesis]
       "Suspected root cause: ...
        Verification steps: ...
        Proceed?"
```

**Risparmio:** ~70% token vs exploratory debugging

---

## Confronto: Quando Usare Cosa

### morning-context-builder.md

**Ideale per:**

- ✅ Inizio giornata (routine setup)
- ✅ Context switch tra task
- ✅ Onboarding nuovo developer
- ✅ Esplorazione codebase

**Evitare se:**

- ❌ Task già avviato (context già in chat)
- ❌ Quick fix (<5 min)
- ❌ Domanda sintattica

### daily-debug-session.md

**Ideale per:**

- ✅ Bug complesso, multi-file
- ✅ Root cause sconosciuto
- ✅ High-stakes fix (production)
- ✅ Debugging strutturato (team learning)

**Evitare se:**

- ❌ Bug noto (già sai dove)
- ❌ Single typo fix
- ❌ Test failure ovvio

### Script Bash (prepare-copilot-context.sh)

**Ideale per:**

- ✅ Offline context generation
- ✅ Documentation (checkpoint file)
- ✅ Automation in CI/CD
- ✅ Non-interactive environment

**Evitare se:**

- ❌ Copilot Agent disponibile
- ❌ Context dinamico preferito
- ❌ Token optimization critico

---

## Metriche di Efficienza

### Caso Reale: Dry-Run Bug Fix

#### Approccio Tradizionale (senza workflow)

```
Iterazioni: 15
Token: ~5000
Tempo: 20 min
Tool calls: 18
```

#### Con prepare-copilot-context.sh

```
Iterazioni: 3
Token: ~2500
Tempo: 10 min
Tool calls: 5
Risparmio: 50% token, 50% tempo
```

#### Con daily-debug-session.md

```
Iterazioni: 2
Token: ~1500
Tempo: 7 min
Tool calls: 4
Risparmio: 70% token, 65% tempo
```

**Winner:** daily-debug-session.md (agent-driven)

---

## Best Practices

### 1. Start with Triage

Non iniziare direttamente con "fix this bug". Usa `morning-context-builder.md` per:

- Classificare il tipo di task
- Attivare il workflow appropriato
- Pre-caricare contesto rilevante

### 2. Answer Concisely

L'agent fa domande mirate. Rispondi in modo conciso:

```
❌ "Well, the bug is that when I run the release script with
    the dry-run flag, which should not modify any files according
    to the documentation, it actually modifies package.json..."

✅ "dry-run modifies package.json"
```

### 3. Trust the Process

L'agent segue un workflow ottimizzato. Non saltare step:

```
Agent: "Should I verify hypothesis with step 1?"
❌ User: "No, just show me the fix"
✅ User: "Yes" [permette all'agent di confermare]
```

### 4. Use Checkpoints

Quando il task è complesso, salva checkpoint:

```
Agent: "Generated checkpoint: /tmp/copilot-session-*.md
        Review? (Y/N/E)"
User: "Y" [verifica che il context sia corretto]
```

### 5. Track Metrics

Dopo ogni sessione, aggiorna metriche:

```bash
# In morning-context-builder, agent chiede:
"Save session metrics? Y/N"

# Crea entry in docs/dev/workflow-metrics.csv:
2025-11-15,dry-run-bug,1500,7,2,214
# Date, Task, Token, Time(min), Commits, Efficiency(token/min)
```

---

## Customization

### Project-Specific Keywords

Aggiungi a `.copilot-workflow-config.json`:

```json
{
  "issuePatterns": {
    "dry-run": ["writeFile", "dryRun", "execCommand"],
    "websocket": ["ws.send", "socket.emit"],
    "auth": ["jwt", "token", "session"]
  },
  "contextPaths": {
    "release": [".release-config.json", "scripts/auto-release.js"],
    "test": ["jest.config.js"]
  }
}
```

L'agent legge questo file e adatta le ricerche.

### Team-Specific Shortcuts

```json
{
  "shortcuts": {
    "test": "npm test -- --passWithNoTests",
    "build": "npm run build",
    "release-dry": "npm run release:suggest"
  }
}
```

---

## Troubleshooting

### "Agent non segue il workflow"

**Soluzione:** Usa comando esplicito:

```
❌ "Use the morning workflow"
✅ "Execute morning-context-builder.md workflow step-by-step"
```

### "Troppe domande"

**Soluzione:** Passa a guided mode:

```
User: "Switch to auto mode"
Agent: [Esegue plan automaticamente, pausa solo su errori]
```

### "Token usage ancora alto"

**Verifiche:**

1. Agent sta leggendo file completi invece di diff?
2. Stai rispondendo con troppo contesto?
3. Agent ripete comandi già eseguiti?

**Fix:** Ricorda all'agent di seguire "Token Optimization Rules"

---

## Evoluzione Futura

### v1.1 (Planned)

- [ ] Auto-detection issue type (no triage needed)
- [ ] Learning from past sessions (ML-based optimization)
- [ ] Integration con BACKLOG.md (auto-update status)

### v2.0 (Vision)

- [ ] Multi-agent workflow (specialist agents per area)
- [ ] Predictive context (agent anticipa le domande)
- [ ] Real-time metrics dashboard

---

## Contributing

Per migliorare i workflow:

1. Usa per almeno 5 sessioni
2. Traccia metriche reali
3. Identifica step inefficienti
4. Proponi ottimizzazione via PR
5. Include benchmark (before/after)

---

**Maintainer:** Development Team
**License:** MIT
**Last Updated:** 2025-11-15
