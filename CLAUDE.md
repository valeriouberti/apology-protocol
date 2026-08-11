# apology-protocol

> Agents can talk. They can't commit. Past the pivot there is no rollback —
> only apology. This library validates typed plan artifacts so that a bad
> plan fails validation, not production.

Named after Pat Helland's "Memories, Guesses, and Apologies" (2007):
at scale you don't get consistency — you get guesses and apologies,
and your job is to make the apologies cheap and correct.

## Context
Reference implementation of the "plan artifact" and "apology protocol" from
the article "Agents Can Talk, But They Can't Commit"
(https://www.valeriouberti.dev/articles/agents-can-talk-but-they-cannot-commit).

The agent protocol stack (MCP, A2A, AP2) standardizes communication but not
commitment. This library validates typed, signed plan artifacts BEFORE
execution: a plan that puts an irreversible step ahead of an unproven one
must fail validation, not production. Pure validation library: no
orchestrator, no LLM integration, no runtime dependency on
Temporal/Restate/DBOS. Zod is the only runtime dependency.

## Status
- v0.0.1 published to npm on 2026-08-11 (name reserved). package.json is at
  0.1.0, unpublished — publish is done manually by Valerio (`npm publish`;
  prepublishOnly runs typecheck + tests + build + schema regeneration).
- All four checks from the article are implemented, plus the v0.2
  class-coherence extension (see below).

## The checks (one rule file per failure mode)
1. pivot-ordering (`src/rules/pivot-ordering.ts`): every step before
   pivotIndex must be class=compensable; everything at/after the pivot is
   one-way (a compensable step there is also an error — its compensation
   would never run). pivotIndex must point at a real step; when it is out
   of bounds this rule reports it and the other rules stay silent.
2. undo-ttl (`src/rules/undo-ttl.ts`): sum of maxDurationSeconds of all
   steps before the pivot must fit (inclusive) inside the shortest
   undoTtlSeconds on that path. No TTL on the path → nothing to prove. A
   pre-pivot step with no maxDurationSeconds is an unbounded wait (e.g.
   human approval): unprovable, therefore invalid — reported per step, and
   the sum check only runs once every duration is declared. TTLs at/after
   the pivot are inert.
3. mandate (`src/rules/mandate.ts`): no step's maxSpendEur may exceed
   mandate.maxSpendEur (inclusive bound); the plan must not outlive
   mandate.expiresAt, checked against RuleContext.now.
4. class-coherence (`src/rules/class-coherence.ts`): irreversible steps
   MUST NOT declare a compensation ("a tool that claims irreversible and
   also ships an undo is lying about one of them"); since v0.2, compensable
   steps MUST declare one ("a step that claims it can be undone must say
   how"). Retriable steps may go either way — retry is their recovery story.

## Plan artifact shape (Zod is the source of truth — src/types.ts)
- $comment? (annotation only, allowed so fixtures can self-document)
- sagaId, planVersion, authoredBy {agent, model}, signature
- pivotIndex: index into steps
- mandate: { maxSpendEur, expiresAt } (borrowed wholesale from AP2)
- steps[]: { id, tool, class: "compensable"|"retriable"|"irreversible",
  compensation? {tool, args?}, idempotencyKey (MUST equal
  `${sagaId}:${stepId}` — enforced by a schema superRefine),
  undoTtlSeconds?, maxSpendEur? (worst-case spend),
  maxDurationSeconds? (worst-case duration/timeout; omitted = unbounded) }
- All objects are strict (unknown keys rejected).

## API (src/validate.ts, src/index.ts)
- validatePlan(raw: unknown, options?: { now?: Date }) →
  { ok: true, plan } | { ok: false, errors }. Collects ALL errors, never
  fail-fast (schema errors first; rules only run on a well-shaped plan).
- ValidationError = { rule, path, message }; rule is "schema" or a check name.
- planJsonSchema() (src/json-schema.ts): JSON Schema draft 2020-12 via
  zod 4's native z.toJSONSchema (NOT the zod-to-json-schema package — that
  targets zod 3). schema/plan.schema.json is the generated, checked-in copy;
  regenerate with `npm run schema`; a test fails if it drifts.

## Structure
- src/types.ts · src/validate.ts · src/json-schema.ts · src/index.ts ·
  src/rules/{pivot-ordering,undo-ttl,mandate,class-coherence}.ts
- test/*.test.ts (one suite per rule + validate + json-schema),
  test/helpers.ts (loadFixture/loadExample/makePlan builder)
- test/fixtures/: one file per failure mode, named after the failure, each
  with a `$comment` explaining it. examples/supplier-onboarding.json is the
  valid 6-step saga from the article (pivot at s3, payments.capture).
- scripts/generate-schema.mjs (runs against dist/), tsconfig.build.json
  (emits dist/), .github/workflows/ci.yml (typecheck, test, schema no-drift).

## Design rules
- TypeScript strict (NodeNext, noUncheckedIndexedAccess). Zod for schema.
  Vitest for tests. ESM only.
- Error messages quote the article's language where it exists.
- Tests are documentation: fixtures stay full, self-contained artifacts
  (article values: sagaId sg_01J8Z9, mandate 250 EUR — expiresAt bumped to
  2027 so examples don't pre-expire). Inline test plans use makePlan.
- Workflow for any new check or schema change: fixture + failing test
  FIRST, then implementation; keep each fixture a single-failure document;
  update README (status table, fixture list) and regenerate the schema.
- Commits and npm publishes are done by Valerio, not by Claude.
