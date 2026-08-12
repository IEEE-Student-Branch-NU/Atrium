# Agent System — Design, Orchestration & Thought Process

How Atrium's AI quality squad was designed, why it's shaped the way it is, and how to
extend it. This is the *rationale* doc; the operational reference (roster, flow diagram,
how to invoke) lives in [`README.md`](README.md), and the standards the agents enforce
live in [`../../CLAUDE.md`](../../CLAUDE.md) and [`../../docs/ENGINEERING.md`](../../docs/ENGINEERING.md).

---

## 1. Why agents at all

Atrium is an ops system with sharp, non-obvious invariants — a service-role client that
**bypasses RLS**, an Edge/Node auth split, append-only history, fail-closed status gates,
manual (unrunnered) migrations, and a hard **~100 ms response budget** dominated by
PostgREST round-trip count. These are exactly the rules a generic assistant forgets under
time pressure, and exactly the rules whose violation causes a security hole, a stale-gate
bug, or a latency regression.

The goal was **continuous standards maintenance**: encode those invariants into a small set
of specialists so every change flows through the same design → build → test → review checks,
the same way a real engineering org keeps quality from depending on who happened to write the
diff. The agents are checked into the repo (`.claude/agents/*.md`) so the standards travel
with the code and apply to anyone who opens it in Claude Code.

---

## 2. Design principles

1. **Encode *this* codebase, not software-engineering in general.** Every agent cites Atrium's
   real conventions (file paths, function names, the exact `WHERE ended_at IS NULL` predicate,
   the `sanitizeSearchTerm` rule). Generic advice was deliberately avoided — it's what the base
   model already does.
2. **Separation of duties.** The agent that *writes* code is not the agent that *approves* it.
   Review and performance audit are **read-only** so a sign-off can't quietly rewrite the thing
   it's judging.
3. **Least privilege via tool-scoping.** Each agent gets only the tools its role needs (see §4).
4. **One orchestrator, no runaway nesting.** Only the product-manager can spawn agents; everyone
   else is a leaf. This keeps the topology a predictable hub-and-spoke instead of an unbounded
   tree of agents spawning agents.
5. **Gates, not vibes.** Progress between stages is defined by objective checks (`tsc`, `build`,
   `test`, reviewer approval), not by an agent declaring itself done.

---

## 3. The roster and why the boundaries fall where they do

| Agent | Owns | Why it's its own agent |
| --- | --- | --- |
| `product-manager` | Sequencing, delegation, status, relay | Someone must hold the end-to-end flow and translate intent → outcomes; mixing this into a coder dilutes both. |
| `system-design-engineer` | Architecture, portal boundaries, response budget, plans | Design decisions (round-trip count, freshness-vs-cache, migration risk) need to be made *before* code and reasoned about in isolation. Plan-only so design and implementation stay distinct. |
| `db-engineer` | Schema, migrations, indexes, constraints, SQL perf | The DB has its own discipline (manual apply, append-only, partial indexes, FK behavior) that's easy to get wrong from the app side. It's a distinct expertise. |
| `backend-engineer` | Queries, actions, auth/permissions, API | The implementation seat — turns designs into convention-matching server code. |
| `code-tester` | Vitest coverage + the build/test gate | Testing is a discipline, not an afterthought; giving it an owner means the fail-closed / permission / impersonation edge cases actually get covered. |
| `performance-auditor` | Round-trips, `cache()`, N+1, indexes | The portal's whole purpose is responsiveness; a dedicated watchdog keeps the ~100 ms budget from eroding one PR at a time. |
| `code-reviewer` | Security/correctness/convention/perf sign-off | The last gate. Independent from the author by design. |

**Why split `db-engineer` from `backend-engineer`?** The migration discipline (no runner → code
must degrade until applied), index-to-predicate matching, and constraint/FK choices are a
different failure mode from app-query correctness. Keeping them separate means a schema change
gets DB-specialist scrutiny and the two coordinate explicitly rather than one seat doing both
half-well.

**Why split `performance-auditor` from `code-reviewer`?** Performance is Atrium's headline
requirement and needs a *positive* audit (count the round-trips, check every `cache()`), not
just a reviewer's passing glance. Separating them lets the perf audit run **in parallel** with
testing while review waits for a green gate.

---

## 4. Tool-scoping rationale (least privilege)

| Capability | Who has it | Why |
| --- | --- | --- |
| `Edit` / `Write` | `backend-engineer`, `db-engineer`, `code-tester` | Only the seats that produce artifacts (code, migrations, tests). |
| Read-only (`Read`/`Grep`/`Glob`/`Bash`) | `system-design-engineer`, `code-reviewer`, `performance-auditor` | Judgement/planning roles must not mutate what they assess. |
| `Agent` (spawn) | `product-manager` **only** | Single orchestrator → hub-and-spoke, no runaway nesting. |
| `SendMessage` + `ListAgents` | **every** agent | Lateral hand-offs between peers (see §6). |
| `WebFetch` | `system-design-engineer` | It may need to check the modified Next.js 16 docs / external references while designing. |

The reviewer and auditor having `Bash` but not `Edit` is deliberate: they need to *run* `build`,
`test`, and `git diff` to do their job, but can't change the diff.

---

## 5. Model-selection rationale

- **opus** for the roles whose cost of being wrong is high and whose work is reasoning-heavy:
  `product-manager` (coordination + product judgement), `system-design-engineer` (architecture),
  `db-engineer` (schema/migrations are hard to reverse), `code-reviewer` (the last line on
  security/correctness).
- **sonnet** for the execution/iteration roles where speed compounds and the work is more
  mechanical against clear conventions: `backend-engineer`, `code-tester`, `performance-auditor`.

This mirrors how you'd staff the work: senior judgement where a mistake is expensive, fast hands
where the spec is clear.

---

## 6. Orchestration & inter-agent communication

**Hub-and-spoke.** The product-manager is the entry point and hub. It spawns specialists (it
alone holds `Agent`), sequences the stages, and — because a subagent's final report is *not*
shown to the human — **relays** what matters between agents and back to you.

**Lateral hand-offs.** Every agent also has `SendMessage` + `ListAgents` so peers can pass work
directly where the runtime allows it — e.g. `performance-auditor` → `backend-engineer` with fix
items, or `db-engineer` ↔ `backend-engineer` on a coupled schema+query change.

**Honest limitation.** The *reliable* channel is the hub relay: the PM spawns each agent and can
continue it with context intact. True peer-to-peer messaging between two **sibling** subagents
depends on what the harness exposes to a spawned agent (`ListAgents` primarily surfaces agents the
caller itself spawned). So lateral `SendMessage` may fall back to routing through the PM. We wired
the tools for both and treat the PM relay as the dependable path rather than promising peer-to-peer
the runtime might not grant. See `README.md` § "How they interact".

---

## 7. The end-to-end flow and its gates

```
request → product-manager → [design?] system-design-engineer ⇄ db-engineer
        → backend-engineer  (tsc + build + test)
        → code-tester ∥ performance-auditor   →  fixes loop back
        → code-reviewer (approve / request changes)  →  PM reports → commit/PR (on request)
```

Gates the PM enforces:
1. **Design → Build.** A design names the affected portal(s), the round-trip count, the permission
   story, and the migration plan. Skipped for one-line/obvious fixes.
2. **Build → Test/Perf.** `npx tsc --noEmit` + `npm run build && npm test` must pass before review;
   `code-tester` and `performance-auditor` run in parallel and loop findings back.
3. **Review → Merge.** `code-reviewer` must **approve**; any blocker returns to the engineer.
   Migrations are applied by hand in the Supabase editor. Commit/push/PR only on explicit request.

The full diagram is in [`README.md`](README.md).

---

## 8. How the agents trace back to Atrium's standards

Each agent is a projection of the same source of truth, so they can't drift from the codebase:

| Standard (source) | Enforced by |
| --- | --- |
| Service-role client never in client bundle | `code-reviewer`, `backend-engineer` |
| Request-scoped reads → `cache()` w/ primitive args | `backend-engineer`, `performance-auditor`, `code-reviewer` |
| Append-only `memberships`/`member_permissions` | `db-engineer`, `backend-engineer`, `code-reviewer` |
| Edge-safety (`proxy.ts`/`auth.config.ts` no bcrypt) | `system-design-engineer`, `backend-engineer`, `code-reviewer` |
| Fail-closed status gating | `system-design-engineer`, `code-tester`, `code-reviewer` |
| `sanitizeSearchTerm` on `.or(...ilike...)` | `backend-engineer`, `code-reviewer` |
| Manual migrations that degrade until applied | `db-engineer`, `backend-engineer` |
| `npm run build && npm test` gate | `code-tester`, everyone |
| ~100 ms / round-trip budget | `system-design-engineer`, `performance-auditor` |

When a convention in `CLAUDE.md` / `docs/ENGINEERING.md` changes, update the agents that cite it
(this is the one maintenance cost of the system — see §10).

---

## 9. Design decisions & trade-offs (alternatives considered)

1. **One mega-agent vs. a squad.** A single "senior engineer" agent is simpler but conflates author
   and reviewer and can't parallelize. Chose the squad for separation of duties and parallel
   test/perf. *Cost:* more files to keep in sync.
2. **PM-only spawning vs. everyone spawns.** Letting every agent spawn enables organic collaboration
   but risks unbounded nesting and cost blow-ups. Chose single-orchestrator hub-and-spoke.
3. **Read-only reviewers vs. auto-fixing reviewers.** An auto-fixing reviewer is faster but erases
   the independent-sign-off guarantee. Chose read-only; fixes route back to the engineer.
4. **Project agents (checked in) vs. personal agents.** Checked-in agents apply to the whole team
   and version with the code. Chose project scope so standards are shared, not per-developer.
5. **Encode conventions inline vs. "read the docs."** Inlining the key rules into each agent makes
   them robust even if a doc link is missed, at the cost of some duplication with `CLAUDE.md`.
   Chose inline for reliability, with pointers back to the source of truth.

---

## 10. Extending & maintaining the squad

**Add an agent** by dropping a new `.claude/agents/<name>.md` with frontmatter
(`name`, `description` with a "Use PROACTIVELY…" trigger, a least-privilege `tools` list, and a
`model`), then add it to the roster + flow in `README.md` and, if it owns a standard, to §8 here.
Candidates if the need arises: `security-reviewer` (split from `code-reviewer`), `frontend-engineer`
(Base-UI/Tailwind/client components), `docs-writer`.

**Keep them honest.** The agents mirror `CLAUDE.md`/`docs/ENGINEERING.md`. When a convention changes
— a new invariant, a changed budget, a new sharp edge — update the citing agents in the same PR.
Treat the agent files as part of the codebase's standards, not as static config.
