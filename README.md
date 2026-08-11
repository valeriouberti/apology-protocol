# apology-protocol

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
which there is no rollback. Four static checks, one per failure mode:

| Check | Rule | Status |
| --- | --- | --- |
| `pivot-ordering` | Everything before the pivot must be compensable; everything at or after it is one-way. | ✅ implemented |
| `class-coherence` | A tool that claims "irreversible" and also ships an undo is lying about one of them. | ⏳ planned |
| `mandate` | No step may exceed `maxSpendEur`; the plan must not outlive `expiresAt`. | ⏳ planned |
| `undo-ttl` | Worst-case time to reach the pivot must fit inside the shortest `undoTtlSeconds` on the path. | ⏳ planned |

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
      "undoTtlSeconds": 86400,
      "idempotencyKey": "sg_01J8Z9:s1"      // always `${sagaId}:${stepId}`
    }
  ]
}
```

## Tests as documentation

The fixtures in [`test/fixtures/`](test/fixtures/) are one file per failure
mode, named after the failure — reading them (and their `$comment` fields)
should teach you the whole article:

- [`pivot-before-unproven-step.json`](test/fixtures/pivot-before-unproven-step.json)
- [`compensable-step-after-pivot.json`](test/fixtures/compensable-step-after-pivot.json)
- [`pivot-index-out-of-bounds.json`](test/fixtures/pivot-index-out-of-bounds.json)

## Development

```sh
npm install
npm test           # vitest run
npm run typecheck  # tsc --noEmit
```
