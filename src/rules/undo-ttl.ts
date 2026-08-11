import type { Rule, ValidationError } from "../types.js";

/**
 * An undo with a TTL is a rollback path that expires. "The orchestrator
 * checks that the worst-case time to reach the pivot fits inside the
 * shortest TTL on the path." If any step on the path declares no worst-case
 * duration, that time cannot be computed — unprovable is invalid.
 */
export const undoTtl: Rule = (plan) => {
  const { pivotIndex, steps } = plan;
  if (pivotIndex >= steps.length) {
    return []; // pivot-ordering owns this failure
  }

  const path = steps.slice(0, pivotIndex);

  const ttlSteps = path.filter((step) => step.undoTtlSeconds !== undefined);
  if (ttlSteps.length === 0) {
    return []; // no undo on the path expires — nothing to prove
  }
  const ttlStep = ttlSteps.reduce((shortest, step) =>
    step.undoTtlSeconds! < shortest.undoTtlSeconds! ? step : shortest,
  );
  const shortestTtl = ttlStep.undoTtlSeconds!;
  const shortestTtlIndex = path.indexOf(ttlStep);

  const errors: ValidationError[] = [];
  for (const [index, step] of path.entries()) {
    if (step.maxDurationSeconds === undefined) {
      errors.push({
        rule: "undo-ttl",
        path: ["steps", index, "maxDurationSeconds"],
        message:
          `step "${step.id}" (${step.tool}) declares no maxDurationSeconds, ` +
          `so the worst-case time to reach the pivot cannot be computed: an ` +
          `unbounded wait cannot sit inside a bounded undo window (shortest ` +
          `undo TTL on the path is ${shortestTtl}s, step "${ttlStep.id}")`,
      });
    }
  }
  if (errors.length > 0) {
    return errors;
  }

  const worstCase = path.reduce(
    (total, step) => total + step.maxDurationSeconds!,
    0,
  );
  if (worstCase > shortestTtl) {
    return [
      {
        rule: "undo-ttl",
        path: ["steps", shortestTtlIndex, "undoTtlSeconds"],
        message:
          `worst-case time to reach the pivot is ${worstCase}s, but the ` +
          `shortest undo TTL on the path is ${shortestTtl}s (step ` +
          `"${ttlStep.id}", ${ttlStep.tool}): the worst-case time to reach ` +
          `the pivot must fit inside the shortest undo TTL on the path, or ` +
          `the rollback everyone is counting on has already expired`,
      },
    ];
  }

  return [];
};
