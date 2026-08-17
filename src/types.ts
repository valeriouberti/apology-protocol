import { z } from "zod";

/**
 * Saga step classes, per Garcia-Molina & Salem by way of the article:
 * compensable steps can be undone, retriable steps can be safely repeated
 * until they succeed, irreversible steps are the pivot and beyond.
 */
export const StepClassSchema = z.enum([
  "compensable",
  "retriable",
  "irreversible",
]);
export type StepClass = z.infer<typeof StepClassSchema>;

export const CompensationSchema = z.strictObject({
  tool: z.string().min(1),
  args: z.record(z.string(), z.unknown()).optional(),
});
export type Compensation = z.infer<typeof CompensationSchema>;

export const StepSchema = z.strictObject({
  id: z.string().min(1),
  tool: z.string().min(1),
  class: StepClassSchema,
  compensation: CompensationSchema.optional(),
  idempotencyKey: z.string().min(1),
  undoTtlSeconds: z.int().positive().optional(),
  /** Worst-case spend of this step, checked against mandate.maxSpendEur. */
  maxSpendEur: z.number().nonnegative().optional(),
  /**
   * Worst-case duration of this step — operationally, its timeout. Omitted
   * means the wait is unbounded: undo-ttl then refuses the plan whenever an
   * undo TTL is at stake before the pivot, because the path time cannot be
   * proven to fit.
   */
  maxDurationSeconds: z.int().nonnegative().optional(),
});
export type Step = z.infer<typeof StepSchema>;

/** Bounded in money and in time — borrowed wholesale from AP2. */
export const MandateSchema = z.strictObject({
  maxSpendEur: z.number().nonnegative(),
  expiresAt: z.iso.datetime(),
});
export type Mandate = z.infer<typeof MandateSchema>;

export const PlanSchema = z
  .strictObject({
    /** Annotation only, never validated — same role as JSON Schema's $comment. */
    $comment: z.string().optional(),
    sagaId: z.string().min(1),
    planVersion: z.int().positive(),
    authoredBy: z.strictObject({
      agent: z.string().min(1),
      model: z.string().min(1),
    }),
    signature: z.string().min(1),
    pivotIndex: z.int().nonnegative(),
    mandate: MandateSchema,
    steps: z.array(StepSchema).min(1),
  })
  .superRefine((plan, ctx) => {
    for (const [index, step] of plan.steps.entries()) {
      const expected = `${plan.sagaId}:${step.id}`;
      // The canonical-bytes form with a SHA-256 hex
      // suffix (whether that hash matches the step's bytes is the
      // key-integrity rule's question, not the schema's).
      const wellFormed =
        step.idempotencyKey === expected ||
        (step.idempotencyKey.startsWith(`${expected}:`) &&
          /^[0-9a-f]{64}$/.test(step.idempotencyKey.slice(expected.length + 1)));
      if (!wellFormed) {
        ctx.addIssue({
          code: "custom",
          path: ["steps", index, "idempotencyKey"],
          message:
            `idempotencyKey must be derived as \`\${sagaId}:\${stepId}\` or ` +
            `\`\${sagaId}:\${stepId}:\${sha256hex}\` — ` +
            `expected "${expected}" (with an optional canonical-bytes hash ` +
            `suffix), got "${step.idempotencyKey}"`,
        });
      }
    }
  });
export type Plan = z.infer<typeof PlanSchema>;

export type RuleName =
  | "schema"
  | "pivot-ordering"
  | "undo-ttl"
  | "mandate"
  | "class-coherence"
  | "key-integrity";

/** One violation. validatePlan collects all of them — never fail-fast. */
export interface ValidationError {
  rule: RuleName;
  path: (string | number)[];
  message: string;
}

/** Ambient facts a rule may need beyond the plan itself. */
export interface RuleContext {
  /** The instant validation runs at — injectable for deterministic tests. */
  now: Date;
}

/** A static check over an already well-shaped plan. */
export type Rule = (plan: Plan, ctx: RuleContext) => ValidationError[];
