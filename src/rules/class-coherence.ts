import type { Rule, ValidationError } from "../types.js";

/**
 * A step's class and its compensation are two claims about the same tool.
 * They must not contradict each other.
 */
export const classCoherence: Rule = (plan) => {
  const errors: ValidationError[] = [];

  for (const [index, step] of plan.steps.entries()) {
    if (step.class === "irreversible" && step.compensation !== undefined) {
      errors.push({
        rule: "class-coherence",
        path: ["steps", index, "compensation"],
        message:
          `step "${step.id}" (${step.tool}) declares class "irreversible" ` +
          `and a compensation (${step.compensation.tool}): a tool that ` +
          `claims irreversible and also ships an undo is lying about one of them`,
      });
    }
  }

  return errors;
};
