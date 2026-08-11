import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/index.js";
import { loadExample, loadFixture, makePlan } from "./helpers.js";

// The mandate is borrowed wholesale from AP2: bounded in money and in time.
describe("mandate", () => {
  it("passes the supplier onboarding example — spend and expiry inside bounds", () => {
    const result = validatePlan(loadExample("supplier-onboarding.json"), {
      now: new Date("2026-08-11T09:00:00Z"),
    });

    expect(result.ok).toBe(true);
  });

  it("fails a step whose worst-case spend exceeds maxSpendEur", () => {
    // s3 declares 400 EUR; the mandate authorizes 250.
    const result = validatePlan(loadFixture("step-exceeds-mandate.json"), {
      now: new Date("2026-08-11T09:00:00Z"),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.rule).toBe("mandate");
    expect(error.path).toEqual(["steps", 3, "maxSpendEur"]);
    expect(error.message).toContain("400");
    expect(error.message).toContain("250");
  });

  it("allows a step spending exactly maxSpendEur — the bound is inclusive", () => {
    const result = validatePlan(
      makePlan({
        sagaId: "sg_EDGE",
        pivotIndex: 0,
        mandate: { maxSpendEur: 250, expiresAt: "2027-01-01T00:00:00Z" },
        steps: [
          {
            id: "s0",
            tool: "payments.capture",
            class: "irreversible",
            maxSpendEur: 250,
          },
        ],
      }),
      { now: new Date("2026-08-11T09:00:00Z") },
    );

    expect(result.ok).toBe(true);
  });

  it("fails a plan validated after its mandate expired — the plan must not outlive expiresAt", () => {
    // Same artifact, two clocks: valid the day before expiry, refused after.
    const fixture = loadFixture("mandate-expired.json");

    const beforeExpiry = validatePlan(fixture, {
      now: new Date("2026-08-06T18:00:00Z"),
    });
    expect(beforeExpiry.ok).toBe(true);

    const afterExpiry = validatePlan(fixture, {
      now: new Date("2026-08-08T18:00:00Z"),
    });
    expect(afterExpiry.ok).toBe(false);
    if (afterExpiry.ok) return;
    expect(afterExpiry.errors).toHaveLength(1);
    const error = afterExpiry.errors[0]!;
    expect(error.rule).toBe("mandate");
    expect(error.path).toEqual(["mandate", "expiresAt"]);
    expect(error.message).toContain("2026-08-07T18:00:00Z");
  });

  it("defaults to the real clock when now is not injected", () => {
    // The fixture's mandate expired in 2026-08 — permanently in the past.
    const result = validatePlan(loadFixture("mandate-expired.json"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.rule === "mandate")).toBe(true);
  });
});
