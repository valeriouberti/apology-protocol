import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/index.js";
import { loadExample, loadFixture, makePlan } from "./helpers.js";

// The pivot is the line in the plan past which there is no rollback — only
// apology. "Everything before it must be compensable; everything at or after
// it is one-way. Validating this is a static check."
describe("pivot-ordering", () => {
  it("passes a plan where every step before the pivot is compensable", () => {
    const result = validatePlan(loadExample("supplier-onboarding.json"));

    expect(result.ok).toBe(true);
  });

  it("fails a plan that puts an unproven (retriable) step before the pivot", () => {
    // The compliance check hits an external registry. Classed retriable, it
    // has no rollback path — yet it sits before the irreversible payment.
    const result = validatePlan(loadFixture("pivot-before-unproven-step.json"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.rule).toBe("pivot-ordering");
    expect(error.path).toEqual(["steps", 2, "class"]);
    expect(error.message).toContain(
      "everything before the pivot must be compensable",
    );
  });

  it("fails a plan with a compensable step at or after the pivot", () => {
    // A compensation declared past the pivot would never run: past that
    // line there is no rollback, only apology.
    const result = validatePlan(loadFixture("compensable-step-after-pivot.json"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.rule).toBe("pivot-ordering");
    expect(error.path).toEqual(["steps", 5, "class"]);
    expect(error.message).toContain("one-way");
  });

  it("fails a plan whose pivotIndex points past the last step", () => {
    const result = validatePlan(loadFixture("pivot-index-out-of-bounds.json"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.rule).toBe("pivot-ordering");
    expect(error.path).toEqual(["pivotIndex"]);
  });

  it("allows the pivot at index 0 — a plan that is one-way from the first step", () => {
    const result = validatePlan(
      makePlan({
        sagaId: "sg_ONEWAY",
        pivotIndex: 0,
        steps: [{ id: "s0", tool: "payments.capture", class: "irreversible" }],
      }),
    );

    expect(result.ok).toBe(true);
  });
});
