import { PlanSchema, type Plan, type Rule, type ValidationError } from "./types.js";
import { pivotOrdering } from "./rules/pivot-ordering.js";

// One rule per failure mode from the article. Sessions 2–3 add
// class-coherence, mandate, and undo-ttl here.
const rules: Rule[] = [pivotOrdering];

export type ValidatePlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; errors: ValidationError[] };

/**
 * Validate an untrusted plan artifact. Returns the typed plan, or every
 * violation found — all errors, not fail-fast: a plan author needs the
 * full picture.
 */
export function validatePlan(raw: unknown): ValidatePlanResult {
  const parsed = PlanSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        rule: "schema" as const,
        path: issue.path.map((key) =>
          typeof key === "number" ? key : String(key),
        ),
        message: issue.message,
      })),
    };
  }

  const errors = rules.flatMap((rule) => rule(parsed.data));
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, plan: parsed.data };
}
