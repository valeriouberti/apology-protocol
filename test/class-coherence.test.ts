import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/index.js";
import { loadExample, loadFixture, makePlan } from "./helpers.js";

// A step's class is a claim about the world. The compensation field is
// another claim. class-coherence checks they don't contradict each other.
describe("class-coherence", () => {
  it("passes the supplier onboarding example — every claim is coherent", () => {
    const result = validatePlan(loadExample("supplier-onboarding.json"));

    expect(result.ok).toBe(true);
  });

  it("fails an irreversible step that also ships an undo", () => {
    // payments.capture claims irreversible AND declares payments.refund.
    // A refund is a new payment, not an undo.
    const result = validatePlan(loadFixture("irreversible-with-compensation.json"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.rule).toBe("class-coherence");
    expect(error.path).toEqual(["steps", 3, "compensation"]);
    expect(error.message).toContain(
      "a tool that claims irreversible and also ships an undo is lying about one of them",
    );
  });

  it("fails a compensable step that ships no compensation — the promised undo must exist", () => {
    // s2 claims it can be undone but never says how. Everyone before the
    // pivot is counting on that rollback path; it does not exist.
    const result = validatePlan(loadFixture("compensable-without-compensation.json"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.rule).toBe("class-coherence");
    expect(error.path).toEqual(["steps", 2, "compensation"]);
    expect(error.message).toContain("ships no compensation");
  });

  it("allows a retriable step without a compensation — retry is its recovery story", () => {
    const result = validatePlan(
      makePlan({
        sagaId: "sg_RETRY",
        pivotIndex: 0,
        steps: [{ id: "s0", tool: "email.credentials", class: "retriable" }],
      }),
    );

    expect(result.ok).toBe(true);
  });
});
