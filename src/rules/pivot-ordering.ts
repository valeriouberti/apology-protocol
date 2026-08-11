import type { Rule, ValidationError } from "../types.js";

/**
 * The pivot is the line in the plan past which there is no rollback — only
 * apology. "Everything before it must be compensable; everything at or
 * after it is one-way. Validating this is a static check."
 */
export const pivotOrdering: Rule = (plan) => {
  const { pivotIndex, steps } = plan;
  const errors: ValidationError[] = [];

  if (pivotIndex >= steps.length) {
    return [
      {
        rule: "pivot-ordering",
        path: ["pivotIndex"],
        message:
          `pivotIndex ${pivotIndex} points past the last step (the plan has ` +
          `${steps.length}): the pivot is the line past which there is no ` +
          `rollback, and it must point at a real step`,
      },
    ];
  }

  for (const [index, step] of steps.entries()) {
    if (index < pivotIndex && step.class !== "compensable") {
      errors.push({
        rule: "pivot-ordering",
        path: ["steps", index, "class"],
        message:
          `step "${step.id}" (${step.class}) sits before the pivot at index ` +
          `${pivotIndex}: everything before the pivot must be compensable, ` +
          `so the plan can still roll back if a later step fails`,
      });
    }
    if (index >= pivotIndex && step.class === "compensable") {
      errors.push({
        rule: "pivot-ordering",
        path: ["steps", index, "class"],
        message:
          `step "${step.id}" is compensable but sits at or after the pivot ` +
          `at index ${pivotIndex}: everything at or after the pivot is ` +
          `one-way — past that line there is no rollback, only apology, ` +
          `and its compensation would never run`,
      });
    }
  }

  return errors;
};
