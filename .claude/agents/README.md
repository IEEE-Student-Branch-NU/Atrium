# Atrium Quality Squad — orchestrated, interacting agents

Checked-in Claude Code subagents that continuously maintain the portal's standards. A
**product-manager** orchestrates a squad of specialists through a design → build → test →
review pipeline, and the agents **talk to each other** (via `SendMessage`) to hand off work.
They enforce **Atrium's actual conventions** (service-role client, request-level `cache()`,
append-only history, edge-safety, manual migrations, the `npm run build && npm test` gate,
`sanitizeSearchTerm`), not generic advice — see [`CLAUDE.md`](../../CLAUDE.md) and
[`docs/ENGINEERING.md`](../../docs/ENGINEERING.md).

> **Design rationale & thought process:** see [`agent-docs.md`](agent-docs.md) for *why* the squad
> is shaped this way — role boundaries, tool-scoping, model choices, the orchestration model, and
> the trade-offs considered.

## The squad

| Agent | Role | Edits code? | Spawns others? | Model |
| --- | --- | --- | --- | --- |
| `product-manager` | **Orchestrator** — backlog, sequencing, delegation, status | No | **Yes** (`Agent`) | opus |
| `system-design-engineer` | Architecture, two-portal model, response budget, plans & go/no-go | No (plans) | No | opus |
| `db-engineer` | Schema, migrations, indexes, constraints, RLS, SQL perf | **Yes** (SQL) | No | opus |
| `backend-engineer` | Queries, actions, auth/permissions, API — to conventions | **Yes** | No | sonnet |
| `code-tester` | Vitest coverage + the build+test gate | Yes (tests) | No | sonnet |
| `code-reviewer` | Security/correctness/convention/perf sign-off | No | No | opus |
| `performance-auditor` | Round-trip counting, `cache()`/N+1/index audit | No | No | sonnet |

## How they interact

- **Hub-and-spoke, PM at the hub.** Only `product-manager` holds the `Agent` tool, so it is the one
  that *spawns* specialists and sequences stages. This prevents runaway nesting.
- **Lateral hand-offs.** Every agent has `SendMessage` + `ListAgents`, so a specialist can pass work
  straight to a peer where the runtime allows (e.g. `performance-auditor` → `backend-engineer` with
  fix items, `db-engineer` ↔ `backend-engineer` on a schema+query change).
- **The PM relays.** A subagent's final report is not shown to the human, so the PM forwards what
  matters between agents and back to you, and keeps a running status.

## End-to-end flow

```
                         ┌──────────────────────┐
your request ──────────► │   product-manager    │  frames goal, sequences, relays, reports
                         └───────────┬──────────┘
                                     ▼  (skip design for trivial fixes)
                         ┌──────────────────────┐        ┌──────────────┐
                         │ system-design-eng.   │◄──────►│ db-engineer  │  schema/migration design
                         └───────────┬──────────┘        └──────┬───────┘
                                     ▼                          ▼
                         ┌──────────────────────┐   migrations authored (manual-apply)
                         │   backend-engineer   │◄─────────────┘
                         └───────────┬──────────┘
                                     ▼  tsc + build + test
                    ┌────────────────┴─────────────────┐
                    ▼                                   ▼
          ┌──────────────────┐              ┌──────────────────────┐
          │   code-tester    │◄────────────►│ performance-auditor  │   (parallel)
          └────────┬─────────┘              └──────────┬───────────┘
                   └───────────────┬───────────────────┘
                                   ▼   findings loop back to backend-engineer / db-engineer
                       ┌──────────────────────┐
                       │    code-reviewer     │  ranked findings → approve / request changes
                       └───────────┬──────────┘
                                   ▼
                       PM reports done → commit / PR (only when the human asks)
```

**Gates the PM enforces**
1. **Design → Build:** design names affected portals, round-trip count, permission story, and the
   migration plan; `db-engineer` owns any schema change. No design needed for one-line fixes.
2. **Build → Test/Perf:** `npx tsc --noEmit` + `npm run build && npm test` pass before review;
   `code-tester` and `performance-auditor` run in parallel and loop findings back.
3. **Review → Merge:** `code-reviewer` must **approve**; any blocker returns to the engineer.
   Migrations are applied by hand in the Supabase editor. Commit/push/PR only on explicit request.

## Invoking them (Claude Code)

- **Start with the PM** for anything multi-step: *"Have the product-manager coordinate adding an
  events RSVP feature."* It plans, delegates, and reports.
- Or call a specialist directly: *"Use the performance-auditor on the members directory route,"*
  *"Have db-engineer add an index for the notifications feed."*
- These are **project** agents (`.claude/agents/*.md`), available to anyone who opens the repo in
  Claude Code. Keep their standards in sync with `CLAUDE.md` when conventions change.
