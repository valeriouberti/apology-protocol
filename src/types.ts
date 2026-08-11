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
      if (step.idempotencyKey !== expected) {
        ctx.addIssue({
          code: "custom",
          path: ["steps", index, "idempotencyKey"],
          message:
            `idempotencyKey must be derived as \`\${sagaId}:\${stepId}\` — ` +
            `expected "${expected}", got "${step.idempotencyKey}"`,
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
  | "class-coherence";

/** One violation. validatePlan collects all of them — never fail-fast. */
export interface ValidationError {
  rule: RuleName;
  path: (string | number)[];
  message: string;
}

/** A static check over an already well-shaped plan. */
export type Rule = (plan: Plan) => ValidationError[];
