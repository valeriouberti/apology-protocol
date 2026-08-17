# apology-protocol

[![CI](https://github.com/valeriouberti/apology-protocol/actions/workflows/ci.yml/badge.svg)](https://github.com/valeriouberti/apology-protocol/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/apology-protocol)](https://www.npmjs.com/package/apology-protocol)

> Agents can talk. They can't commit. Past the pivot there is no rollback —
> only apology. This library validates typed plan artifacts so that a bad
> plan fails validation, not production.

Reference implementation of the **plan artifact** and **apology protocol**
from [Agents Can Talk, But They Can't Commit](https://www.valeriouberti.dev/articles/agents-can-talk-but-they-cannot-commit).
Named after Pat Helland's *Memories, Guesses, and Apologies* (2007): at scale
you don't get consistency — you get guesses and apologies, and your job is to
make the apologies cheap and correct.

The agent protocol stack (MCP, A2A, AP2) standardizes communication but not
commitment: the protocol carries the request and the response, and nothing
carries the commitment. This library validates typed, signed plan artifacts
**before** execution. Agents propose. The runtime disposes.

## What it checks

A plan is a saga: an ordered list of steps with a **pivot** — the line past
which there is no rollback. Five static checks, one per failure mode:

| Check | Rule | Status |
| --- | --- | --- |
| `pivot-ordering` | Everything before the pivot must be compensable; everything at or after it is one-way. | ✅ implemented |
| `class-coherence` | A tool that claims "irreversible" and also ships an undo is lying about one of them — and a compensable step must ship the undo it promises. | ✅ implemented |
| `mandate` | No step may exceed `maxSpendEur`; the plan must not outlive `expiresAt`. | ✅ implemented |
| `undo-ttl` | Worst-case time to reach the pivot must fit inside the shortest `undoTtlSeconds` on the path. | ✅ implemented |
| `key-integrity` | A canonical-bytes idempotency key must match the step's bytes — same key with different bytes is a replay with a different payload. | ✅ implemented |

Pure validation library: no orchestrator, no LLM integration, no runtime
dependency on Temporal/Restate/DBOS. Zod is the only dependency.

## Usage

```ts
import { validatePlan } from "apology-protocol";

const result = validatePlan(untrustedPlanArtifact);

if (result.ok) {
  result.plan; // fully typed Plan
} else {
  result.errors; // ALL violations, not fail-fast — [{ rule, path, message }]
}

// Mandate expiry is checked against the clock; inject it for determinism:
validatePlan(artifact, { now: new Date("2026-08-11T09:00:00Z") });
```

## The plan artifact

See [`examples/supplier-onboarding.json`](examples/supplier-onboarding.json)
for the full 6-step saga from the article. The shape:

```jsonc
{
  "sagaId": "sg_01J8Z9",
  "planVersion": 1,
  "authoredBy": { "agent": "planner@acme", "model": "claude-opus-5" },
  "signature": "ed25519:...",
  "pivotIndex": 3,                          // index of the first one-way step
  "mandate": {                              // borrowed wholesale from AP2:
    "maxSpendEur": 250,                     // bounded in money
    "expiresAt": "2027-08-07T18:00:00Z"     // and in time
  },
  "steps": [
    {
      "id": "s1",
      "tool": "budget.reserve",
      "class": "compensable",               // compensable | retriable | irreversible
      "compensation": { "tool": "budget.release", "args": { "ref": "$s1.hold" } },
      "undoTtlSeconds": 86400,              // how long the undo stays valid
      "maxSpendEur": 180,                   // worst-case spend of this step (optional)
      "maxDurationSeconds": 60,             // worst-case duration — omitted = unbounded
      "idempotencyKey": "sg_01J8Z9:s1"      // `${sagaId}:${stepId}`, optionally
                                            // + `:${sha256hex}` (see below)
    }
  ]
}
```

## Canonical bytes and idempotency keys

`${sagaId}:${stepId}` guarantees uniqueness, not integrity: a replay can
present a different payload under the same key. Since 0.2.0 a key can carry
a hash of the step's canonical bytes, and the validator holds the key to it:

```
key = `${sagaId}:${stepId}:${hex(sha256(canonical_step_bytes))}`
```

The byte pipeline, aligned with
[A2A §8.4.1 (Agent Card signing — canonicalization requirements)](https://a2a-protocol.org/latest/specification/#841-canonicalization-requirements)
— settled in [a2aproject/A2A#2124](https://github.com/a2aproject/A2A/discussions/2124):

1. **Exclude the field that carries the integrity value** — the plan-level
   `signature` never enters any hash, and a step's own `idempotencyKey`
   never enters its own. Mirrors §8.4.1's signature exclusion: no circular
   dependency, no divergence on whether an artifact is hashed with or
   without its own proof.
2. **The presence rule** — omitted optional fields stay omitted; fields
   explicitly set to a value are included even when the value equals a
   documented default. Defaults are validator semantics, not bytes: a
   canonicalizer that materializes them lets two differently-authored
   artifacts hash identically, and an integrity check that cannot see the
   difference cannot defend it.
3. **JCS ([RFC 8785](https://www.rfc-editor.org/rfc/rfc8785))** — vendored,
   verified against the official test vectors; Zod stays the only runtime
   dependency.
4. **SHA-256** over the canonical UTF-8 bytes.

```ts
import { deriveIdempotencyKey } from "apology-protocol";

step.idempotencyKey = deriveIdempotencyKey(plan, step.id);
```

Legacy two-part keys still validate — they claim no integrity, so the
`key-integrity` check leaves them alone. A three-part key is a claim, and
the validator recomputes it: the failing fixture is
[`key-mismatch-replay.json`](test/fixtures/key-mismatch-replay.json) — same
key, different bytes, refused before execution. The presence rule is pinned
by the fixture pair
[`presence-divergence-omitted.json`](test/fixtures/presence-divergence-omitted.json) /
[`presence-divergence-explicit-default.json`](test/fixtures/presence-divergence-explicit-default.json):
a field omitted and the same field explicitly set to its default are
different bytes, so they MUST produce different hashes.

## JSON Schema

The Zod schema is the source of truth; a JSON Schema (draft 2020-12) is
generated from it for non-TypeScript consumers:

```ts
import { planJsonSchema } from "apology-protocol"; // at runtime
import schema from "apology-protocol/schema.json"; // or the generated file
```

The checked-in [`schema/plan.schema.json`](schema/plan.schema.json) is kept
honest by a test; regenerate it with `npm run schema`. It describes the shape
only — the four checks are cross-field rules JSON Schema cannot express.

## Tests as documentation

The fixtures in [`test/fixtures/`](test/fixtures/) are one file per failure
mode, named after the failure — reading them (and their `$comment` fields)
should teach you the whole article:

- [`pivot-before-unproven-step.json`](test/fixtures/pivot-before-unproven-step.json)
- [`compensable-step-after-pivot.json`](test/fixtures/compensable-step-after-pivot.json)
- [`pivot-index-out-of-bounds.json`](test/fixtures/pivot-index-out-of-bounds.json)
- [`irreversible-with-compensation.json`](test/fixtures/irreversible-with-compensation.json)
- [`step-exceeds-mandate.json`](test/fixtures/step-exceeds-mandate.json)
- [`mandate-expired.json`](test/fixtures/mandate-expired.json)
- [`undo-ttl-shorter-than-path.json`](test/fixtures/undo-ttl-shorter-than-path.json)
- [`unbounded-wait-inside-undo-window.json`](test/fixtures/unbounded-wait-inside-undo-window.json)
- [`compensable-without-compensation.json`](test/fixtures/compensable-without-compensation.json)
- [`key-mismatch-replay.json`](test/fixtures/key-mismatch-replay.json)
- [`presence-divergence-omitted.json`](test/fixtures/presence-divergence-omitted.json) / [`presence-divergence-explicit-default.json`](test/fixtures/presence-divergence-explicit-default.json) (both valid — the divergence is the point)

The official RFC 8785 (JCS) test vectors live in
[`test/fixtures/jcs/`](test/fixtures/jcs/), vendored from the
[reference implementation](https://github.com/cyberphone/json-canonicalization).

## Development

```sh
npm install
npm test           # vitest run
npm run typecheck  # tsc --noEmit
npm run build      # emit dist/ (ESM + .d.ts)
npm run schema     # regenerate schema/plan.schema.json from the Zod schema
```
