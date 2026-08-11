import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/index.js";
import { loadExample, loadFixture, makePlan } from "./helpers.js";

// An undo with a TTL is a rollback path that expires. "The orchestrator
// checks that the worst-case time to reach the pivot fits inside the
// shortest TTL on the path."
describe("undo-ttl", () => {
  it("passes the supplier onboarding example — 3720s to the pivot, 86400s of undo window", () => {
    const result = validatePlan(loadExample("supplier-onboarding.json"));

    expect(result.ok).toBe(true);
  });

  it("fails a plan whose worst-case path to the pivot outlives the shortest undo TTL", () => {
    // The compliance registry can take 48h; the budget hold releases after 24h.
    const result = validatePlan(loadFixture("undo-ttl-shorter-than-path.json"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.rule).toBe("undo-ttl");
    expect(error.path).toEqual(["steps", 1, "undoTtlSeconds"]);
    expect(error.message).toContain("172920");
    expect(error.message).toContain("86400");
  });

  it("fails a human-approval step with unbounded wait inside an undo window", () => {
    // approvals.humanReview declares no maxDurationSeconds while the budget
    // hold's undo expires after 24h: unprovable, therefore invalid.
    const result = validatePlan(loadFixture("unbounded-wait-inside-undo-window.json"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.rule).toBe("undo-ttl");
    expect(error.path).toEqual(["steps", 2, "maxDurationSeconds"]);
    expect(error.message).toContain("unbounded wait");
  });

  it("passes a plan with no TTL on the path — nothing expires, nothing to prove", () => {
    // No pre-pivot step declares undoTtlSeconds, so missing durations are fine.
    const result = validatePlan(
      makePlan({
        sagaId: "sg_NOTTL",
        pivotIndex: 1,
        steps: [
          {
            id: "s0",
            tool: "vendor.create",
            class: "compensable",
            compensation: { tool: "vendor.archive" },
          },
          { id: "s1", tool: "payments.capture", class: "irreversible" },
        ],
      }),
    );

    expect(result.ok).toBe(true);
  });

  it("passes when the worst-case path exactly equals the shortest TTL — 'fits inside' is inclusive", () => {
    const result = validatePlan(
      makePlan({
        sagaId: "sg_EXACT",
        pivotIndex: 2,
        steps: [
          {
            id: "s0",
            tool: "budget.reserve",
            class: "compensable",
            compensation: { tool: "budget.release" },
            undoTtlSeconds: 3600,
            maxDurationSeconds: 600,
          },
          {
            id: "s1",
            tool: "compliance.check",
            class: "compensable",
            compensation: { tool: "compliance.discard" },
            maxDurationSeconds: 3000,
          },
          { id: "s2", tool: "payments.capture", class: "irreversible" },
        ],
      }),
    );

    expect(result.ok).toBe(true);
  });

  it("ignores TTLs at or after the pivot — the path ends where rollback ends", () => {
    // A TTL on a post-pivot step is inert: there is no rollback back there.
    const result = validatePlan(
      makePlan({
        sagaId: "sg_POST",
        pivotIndex: 0,
        steps: [
          { id: "s0", tool: "payments.capture", class: "irreversible" },
          {
            id: "s1",
            tool: "sandbox.provision",
            class: "retriable",
            undoTtlSeconds: 60,
          },
        ],
      }),
    );

    expect(result.ok).toBe(true);
  });
});
