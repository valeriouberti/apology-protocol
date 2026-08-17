import { hashStep } from "../canonical/key.js";
import type { Rule, ValidationError } from "../types.js";

/**
 * A canonical-bytes idempotency key binds the key to the payload it was
 * computed over. A legacy `${sagaId}:${stepId}` key claims uniqueness but
 * no integrity, so this rule leaves it alone; a key carrying a hash
 * suffix is a claim about the step's bytes, and the claim is checked by
 * recomputing it. Same key with different bytes is exactly the replay
 * the key exists to catch — refused here, before execution.
 */
export const keyIntegrity: Rule = (plan) => {
  const errors: ValidationError[] = [];

  for (const [index, step] of plan.steps.entries()) {
    const prefix = `${plan.sagaId}:${step.id}:`;
    if (!step.idempotencyKey.startsWith(prefix)) {
      // Legacy key (or not derived at all — the schema already said so).
      continue;
    }
    const claimed = step.idempotencyKey.slice(prefix.length);
    const actual = hashStep(step);
    if (claimed !== actual) {
      errors.push({
        rule: "key-integrity",
        path: ["steps", index, "idempotencyKey"],
        message:
          `step "${step.id}" (${step.tool}) carries idempotencyKey hash ` +
          `"${claimed}", but the canonical bytes of the step hash to ` +
          `"${actual}": same key, different bytes — a replay presented a ` +
          `different payload under the same idempotency key`,
      });
    }
  }

  return errors;
};
