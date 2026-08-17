# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-08-17

Canonical-bytes idempotency keys, aligned with A2A §8.4.1 (Agent Card
signing) — design settled in
[a2aproject/A2A#2124](https://github.com/a2aproject/A2A/discussions/2124).

### Added

- **`deriveIdempotencyKey(plan, stepId)`** — keys of the form
  `${sagaId}:${stepId}:${hex(sha256(canonical_step_bytes))}`: prefix for
  debuggability, hash suffix for integrity. Byte pipeline: exclude the
  field carrying the integrity value (plan-level `signature`, the step's
  own `idempotencyKey`) → presence rule → JCS (RFC 8785) → SHA-256.
- **`key-integrity` check** — a plan carrying canonical-bytes keys has
  them recomputed; same key with different bytes fails validation ("a
  replay presented a different payload under the same idempotency key").
  Legacy `${sagaId}:${stepId}` keys claim no integrity and are left alone.
- **Vendored JCS (RFC 8785)** in `src/canonical/jcs.ts`, verified against
  the official test vectors (vendored in `test/fixtures/jcs/`). Zod
  remains the only runtime dependency.
- **The presence rule**, explicit and testable
  (`src/canonical/presence.ts`): omitted optional fields stay omitted;
  explicitly-set fields are included even at their documented default —
  defaults are validator semantics, not bytes. Pinned by the fixture pair
  `presence-divergence-omitted.json` /
  `presence-divergence-explicit-default.json`, which MUST hash
  differently.
- Fixture `key-mismatch-replay.json`: same key, different bytes, refused
  before execution.
- Exports: `deriveIdempotencyKey`, `hashStep`, `canonicalize`,
  `preparePlanForHashing`, `prepareStepForHashing`, `keyIntegrity`.

### Changed

- The schema now accepts both key forms: legacy `${sagaId}:${stepId}` and
  canonical-bytes `${sagaId}:${stepId}:${sha256hex}`. Existing plans keep
  validating unchanged.

## [0.1.0] - unpublished

- The four checks from the article: `pivot-ordering`, `undo-ttl`,
  `mandate`, `class-coherence` (with the v0.2 compensable-must-declare
  extension), JSON Schema generation, CI.

[0.2.0]: https://github.com/valeriouberti/apology-protocol/releases/tag/v0.2.0
