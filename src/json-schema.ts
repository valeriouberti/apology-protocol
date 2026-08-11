import { z } from "zod";
import { PlanSchema } from "./types.js";

/**
 * JSON Schema (draft 2020-12) for the plan artifact, generated from the Zod
 * schema — Zod is the source of truth. Note: the cross-field checks live in
 * the rules (and the idempotencyKey refinement), which JSON Schema cannot
 * express; this describes the shape only.
 */
export function planJsonSchema(): Record<string, unknown> {
  return {
    $id: "https://raw.githubusercontent.com/valeriouberti/apology-protocol/main/schema/plan.schema.json",
    title: "Plan artifact (apology-protocol)",
    description:
      "A typed, signed plan artifact for agent sagas. Shape only — pivot-ordering, undo-ttl, mandate, and class-coherence are cross-field checks enforced by validatePlan.",
    ...z.toJSONSchema(PlanSchema),
  };
}
