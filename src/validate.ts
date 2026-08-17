import {
  PlanSchema,
  type Plan,
  type Rule,
  type RuleContext,
  type ValidationError,
} from "./types.js";
import { pivotOrdering } from "./rules/pivot-ordering.js";
import { classCoherence } from "./rules/class-coherence.js";
import { mandate } from "./rules/mandate.js";
import { undoTtl } from "./rules/undo-ttl.js";
import { keyIntegrity } from "./rules/key-integrity.js";

const rules: Rule[] = [
  pivotOrdering,
  classCoherence,
  mandate,
  undoTtl,
  keyIntegrity,
];

export type ValidatePlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; errors: ValidationError[] };

export interface ValidatePlanOptions {
  /** The instant to validate against (mandate expiry). Defaults to now. */
  now?: Date;
}

/**
 * Validate an untrusted plan artifact. Returns the typed plan, or every
 * violation found — all errors, not fail-fast: a plan author needs the
 * full picture.
 */
export function validatePlan(
  raw: unknown,
  options: ValidatePlanOptions = {},
): ValidatePlanResult {
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

  const ctx: RuleContext = { now: options.now ?? new Date() };
  const errors = rules.flatMap((rule) => rule(parsed.data, ctx));
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, plan: parsed.data };
}
