import { createHash } from "node:crypto";
import { canonicalize } from "./jcs.js";
import { prepareStepForHashing } from "./presence.js";

/**
 * The byte pipeline, aligned with A2A §8.4.1 (Agent Card signing):
 *
 * 1. take the artifact excluding the field that carries the integrity
 *    value — the plan-level `signature` never enters any hash, and a
 *    step's own `idempotencyKey` never enters its own (no circularity);
 * 2. apply the presence rule: omitted optional fields stay omitted,
 *    explicitly-set fields are included even at their documented default
 *    (see ./presence.ts);
 * 3. canonicalize with JCS (RFC 8785);
 * 4. SHA-256 over the canonical UTF-8 bytes.
 *
 * Key = `${sagaId}:${stepId}:${hex(sha256(canonical_step_bytes))}` —
 * the prefix stays for debuggability, the hash suffix carries integrity.
 */

/** Hex SHA-256 of a step's canonical bytes (the step minus its own key). */
export function hashStep(step: Record<string, unknown>): string {
  const canonical = canonicalize(prepareStepForHashing(step));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Derive the canonical-bytes idempotency key for one step of a plan.
 * Accepts a draft plan — the step need not carry any key yet.
 */
export function deriveIdempotencyKey(
  plan: { sagaId: string; steps: readonly Record<string, unknown>[] },
  stepId: string,
): string {
  const step = plan.steps.find((candidate) => candidate.id === stepId);
  if (step === undefined) {
    throw new Error(`plan has no step with id "${stepId}"`);
  }
  return `${plan.sagaId}:${stepId}:${hashStep(step)}`;
}
