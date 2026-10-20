---
name: deliver
description: "Full implementation harness: GitHub issue to merged PR, with a gate after every phase. Use when the user wants to take an issue end-to-end through implementation."
---

# Deliver

This harness orchestrates the pipeline from a GitHub issue to a merged PR. Each phase ends in a **gate** — a binary barrier that opens only when the user confirms. A closed gate blocks every phase after it.

## Prerequisites

Before starting any work, create a git worktree branched from the latest `main`:

```bash
git fetch origin main
git worktree add ../la-haute-tour-<issue-number> origin/main -b <type>/<issue-number>-<description>
```

All implementation, commits, and PR creation happen inside this worktree. This keeps the main checkout clean and avoids interference from uncommitted changes on the issuing branch.

## Process

### 1. Fetch the issue

Use `gh issue view <number> --comments` to fetch the GitHub issue the user pointed at. Include description, labels, and comments.

If the issue references a spec under [`specs/`](specs/spec.md) (e.g. `spec.md`, `architecture.md`, or a domain-specific file), read that too — specs are the source of truth for the domain.

Summarize:
- What the issue asks for (1-3 sentences)
- Any linked spec file under `specs/`
- Acceptance criteria (if present)

**Gate 1**: Issue fetched, all comments reviewed, all acceptance criteria listed — present for confirmation.

### 2. Grill the approach

Load and follow the `grilling` skill. Key areas to cover:

- Which layers does this touch? (`pages/`, `components/`, `server/api/`, `server/db/schema.ts`...)
- Which domain terms are involved — check the **Nom en code** column in [`specs/spec.md`](specs/spec.md)'s glossary; a term missing there gets added to the glossary first, then coded
- Which API endpoints are needed? (check existing `server/api/**`)
- Are there existing patterns/components to follow? (search for similar features, reuse `Base*` components)
- What are the TDD seams? (Nitro handlers, composables, components)
- Any Drizzle schema change / migration needed? (`server/db/schema.ts`, `drizzle-kit generate`)
- Any design decisions that need the user's call?

**Gate 2**: Every key area above resolved with a decision — present the consolidated approach for approval.

### 3. Plan

Break the work into implementation steps. Each step should be:
- A vertical slice (cuts through all layers touched: schema, API route, composable, component, tests)
- Sized to fit in one focused session
- Ordered by dependency

Present the plan as a numbered checklist:

```
## Implementation Plan

1. [step description] — files affected, tests to write
2. [step description] — files affected, tests to write
...
```

**Gate 3**: Every step lists affected files and tests; dependency order verified — present for approval.

**Session boundary**: If this issue is complex, consider using `/handoff` to compact the conversation and starting a fresh session for implementation. For simple issues, continue in the same session.

### 4. Implement with TDD

Load and follow the `tdd` skill. For each step in the plan, run the red → green cycle at the TDD seams identified in step 2. Run typechecking regularly, single test files regularly, and the full test suite once at the end. Present progress after each step. If a step is complex or has subdecisions, pause and ask.

**Gate 4**: All steps implemented and tests pass — present a summary of what was built.

### 5. Code review

Load and follow the `code-review` skill. It runs a two-axis review in parallel (Standards and Spec).

Present both reports side by side under `## Standards` and `## Spec` headings.

**Gate 5**: Present the review results. Hard violations trigger the loop; judgement calls go to the user.

### 6. Grill the review

Load and follow the `grilling` skill on the code review results:

- For each finding from step 5, grill whether it's been adequately addressed
- For each "pass", stress-test whether it really passes or if the reviewer missed something

**Gate 6**: Present the grilled review conclusions. Unresolved issues trigger the loop; all clear proceeds.

### 7. Simplify

Load and follow the `simplify` skill on the code implemented in step 4 (the diff for this issue, not the whole repo).

**Gate 7**: Present proposed simplifications for approval. After applying, run typecheck and tests to verify no regressions.

**Re-review after simplify**: if the simplifications changed any code, run step 5 again (both axes) on the simplify diff only — the changes made since Gate 6, not the whole issue diff. A simplification can break a convention or a spec behaviour that the first review already cleared. Present the results under `## Standards` and `## Spec` as in step 5; any finding goes back through the loop. If simplify changed nothing, skip this pass and say so.

### 8. Spec verification

Re-read the original GitHub issue and any linked file under `specs/`. Go through each acceptance criterion:

- Is it implemented?
- Is it tested?
- Does the behavior match the spec?

Present a checklist:

```
## Spec Verification

- [x] Criterion 1 — implemented in `file.ts:42`, tested in `file.spec.ts:15`
- [ ] Criterion 2 — NOT IMPLEMENTED
- [x] Criterion 3 — implemented, but behavior differs from spec (explain)
```

**Gate 8**: Every criterion verified — present the checklist. Any failure triggers the loop; all pass proceeds.

### 9. Quality checks

Before committing, run all quality checks — same order as CI:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

If any fail, fix and re-run.

**Gate 9**: Show quality check results.

### 10. Commit

Load and follow the `commit` skill. Conventional commits (`feat:`, `fix:`, `refactor:`, etc.).

**Gate 10**: Staged files and commit message presented for explicit validation.

### 11. Merge to main

```bash
git checkout main
git merge --ff-only <type>/<issue-number>-<description>
git worktree remove ../la-haute-tour-<issue-number>
```

**Gate 11**: Commit shown, merge command presented for validation before running it.

## Loop behavior

Steps 4 → 5 → 6 → 7 → 8 form a loop. If any review, grilling, simplify, or spec check fails:
- Note the specific issues
- Return to step 4 to implement fixes for those specific issues
- Re-run steps 5-8 on the fixes only (not the entire diff from scratch)
- Code changed by simplify (step 7) always gets its own review pass before step 8 — see "Re-review after simplify"
- Continue until all gates pass

## Scope boundaries

- Issue creation is handled by `to-tickets`
- No PR — work merges straight into `main`
- Push only when the user explicitly requests it
