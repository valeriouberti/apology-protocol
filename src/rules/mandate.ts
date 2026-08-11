import type { Rule, ValidationError } from "../types.js";

/**
 * The mandate is borrowed wholesale from AP2: bounded in money and in time.
 * No step may exceed maxSpendEur, and the plan must not outlive expiresAt.
 */
export const mandate: Rule = (plan, ctx) => {
  const errors: ValidationError[] = [];

  for (const [index, step] of plan.steps.entries()) {
    if (
      step.maxSpendEur !== undefined &&
      step.maxSpendEur > plan.mandate.maxSpendEur
    ) {
      errors.push({
        rule: "mandate",
        path: ["steps", index, "maxSpendEur"],
        message:
          `step "${step.id}" (${step.tool}) declares a worst-case spend of ` +
          `${step.maxSpendEur} EUR, but the mandate authorizes at most ` +
          `${plan.mandate.maxSpendEur} EUR: the mandate is bounded in money, ` +
          `and the orchestrator refuses the plan if a step exceeds it`,
      });
    }
  }

  const expiresAt = new Date(plan.mandate.expiresAt);
  if (ctx.now.getTime() >= expiresAt.getTime()) {
    errors.push({
      rule: "mandate",
      path: ["mandate", "expiresAt"],
      message:
        `the mandate expired at ${plan.mandate.expiresAt} and validation ` +
        `ran at ${ctx.now.toISOString()}: the mandate is bounded in time, ` +
        `and the plan must not outlive expiresAt`,
    });
  }

  return errors;
};
