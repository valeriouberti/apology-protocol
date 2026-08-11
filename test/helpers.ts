import { readFileSync } from "node:fs";
import type { Mandate, Plan, Step } from "../src/index.js";

/** Load a JSON fixture as `unknown` — exactly what validatePlan receives. */
export function loadFixture(name: string): unknown {
  const url = new URL(`./fixtures/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8"));
}

/** Load a JSON file from the top-level examples/ directory. */
export function loadExample(name: string): unknown {
  const url = new URL(`../examples/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8"));
}

/**
 * Build a minimal valid plan for inline test cases, so each test shows only
 * the fields it is actually about. idempotencyKeys are derived correctly;
 * the fixtures remain full, self-contained artifacts.
 */
export function makePlan(init: {
  sagaId: string;
  pivotIndex: number;
  steps: Omit<Step, "idempotencyKey">[];
  mandate?: Mandate;
}): Plan {
  return {
    sagaId: init.sagaId,
    planVersion: 1,
    authoredBy: { agent: "planner@acme", model: "claude-opus-5" },
    signature: "ed25519:abc",
    pivotIndex: init.pivotIndex,
    mandate: init.mandate ?? { maxSpendEur: 10, expiresAt: "2027-01-01T00:00:00Z" },
    steps: init.steps.map((step) => ({
      ...step,
      idempotencyKey: `${init.sagaId}:${step.id}`,
    })),
  };
}
