# Atrium Quality Squad — end-to-end agent flow

Checked-in Claude Code subagents that continuously maintain the portal's standards.
Each is a specialist with a scoped toolset; together they form a design → build → test →
review → perf pipeline. They enforce **Atrium's actual conventions** (service-role client,
request-level `cache()`, append-only history, edge-safety, manual migrations, the
`npm run build && npm test` gate, `sanitizeSearchTerm`), not generic advice — see
[`CLAUDE.md`](../../CLAUDE.md) and [`docs/ENGINEERING.md`](../../docs/ENGINEERING.md).

## The squad

| Agent | Role | Edits code? | Model |
| --- | --- | --- | --- |
| `system-design-engineer` | Architecture, two-portal model, response budget, plans & go/no-go | No (plans only) | opus |
| `backend-engineer` | Implements queries, actions, auth/permissions, migrations, API | **Yes** | sonnet |
| `code-tester` | Vitest coverage + runs the build+test gate | Yes (tests) | sonnet |
| `code-reviewer` | Security/correctness/convention sign-off on the diff | No (read-only) | opus |
| `performance-auditor` | Round-trip counting, `cache()`/N+1/index audit | No (read-only) | sonnet |

## End-to-end flow

```
        ┌─────────────────────────┐
task ──►│ system-design-engineer  │  design + plan + go/no-go   (skip for trivial fixes)
        └────────────┬────────────┘
                     ▼
        ┌─────────────────────────┐
        │    backend-engineer     │  implement to conventions; tsc + build + test
        └────────────┬────────────┘
                     ▼
        ┌─────────────────────────┐        ┌──────────────────────┐
        │      code-tester        │◄──────►│ performance-auditor  │  (run in parallel)
        │  coverage + gate green  │        │ round-trips / cache()│
        └────────────┬────────────┘        └──────────┬───────────┘
                     └──────────────┬─────────────────┘
                                    ▼   (fixes loop back to backend-engineer)
                     ┌─────────────────────────┐
                     │      code-reviewer      │  ranked findings → approve / request changes
                     └────────────┬────────────┘
                                  ▼
                        commit / PR (only when the human asks)
```

**Gates between stages**
1. **Design → Build:** design names affected portals, round-trip count, permission story,
   migration plan, and a step plan. No design needed for one-line/obvious fixes.
2. **Build → Test/Perf:** `npx tsc --noEmit` + `npm run build && npm test` must pass before review.
   `code-tester` and `performance-auditor` can run in parallel; their findings loop back to
   `backend-engineer`.
3. **Review → Merge:** `code-reviewer` must **approve**. Any blocker returns to `backend-engineer`.
   Commit/push/PR only on explicit human request.

## Invoking them (Claude Code)

- Let the orchestrator delegate automatically — the `description` fields say when each applies
  ("Use PROACTIVELY …").
- Or call one directly: *"Use the performance-auditor to check the members directory route."*
- These are **project** agents (`.claude/agents/*.md`); they're available to anyone who opens the
  repo in Claude Code. Keep their standards in sync with `CLAUDE.md` when conventions change.
