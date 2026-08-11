import { describe, expect, it } from "vitest";
import { validatePlan } from "../src/index.js";
import { loadExample, loadFixture } from "./helpers.js";

describe("validatePlan — the plan artifact schema", () => {
  it("accepts the supplier onboarding example from the article and returns a typed plan", () => {
    const result = validatePlan(loadExample("supplier-onboarding.json"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.sagaId).toBe("sg_01J8Z9");
    expect(result.plan.pivotIndex).toBe(3);
    expect(result.plan.steps).toHaveLength(6);
    expect(result.plan.steps[3]?.class).toBe("irreversible");
    expect(result.plan.mandate.maxSpendEur).toBe(250);
  });

  it("rejects input that is not a plan at all", () => {
    const result = validatePlan("not a plan");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.rule).toBe("schema");
  });

  it("rejects a step class outside compensable | retriable | irreversible", () => {
    const plan = structuredClone(
      loadExample("supplier-onboarding.json"),
    ) as Record<string, unknown>;
    (plan.steps as { class: string }[])[0]!.class = "undoable";

    const result = validatePlan(plan);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.rule === "schema")).toBe(true);
  });

  it("rejects an idempotencyKey that is not derived as `${sagaId}:${stepId}`", () => {
    const plan = structuredClone(
      loadExample("supplier-onboarding.json"),
    ) as Record<string, unknown>;
    (plan.steps as { idempotencyKey: string }[])[0]!.idempotencyKey =
      "made-up-by-hand";

    const result = validatePlan(plan);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.errors.find((e) =>
      e.path.join(".").endsWith("idempotencyKey"),
    );
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("sg_01J8Z9:s0");
  });

  it("reports ALL errors, not fail-fast — a plan author needs the full picture", () => {
    // Two independent pivot-ordering violations in one plan: an unproven
    // step before the pivot AND a compensable step after it.
    const plan = structuredClone(loadFixture("pivot-before-unproven-step.json")) as {
      steps: { class: string; compensation?: unknown }[];
    };
    plan.steps[5]!.class = "compensable";
    plan.steps[5]!.compensation = { tool: "email.retract" };

    const result = validatePlan(plan);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const pivotErrors = result.errors.filter((e) => e.rule === "pivot-ordering");
    expect(pivotErrors).toHaveLength(2);
  });

  it("collects errors across rules — one broken plan, every rule reports", () => {
    // Retriable step before the pivot (pivot-ordering), an irreversible
    // step shipping an undo (class-coherence), and a spend over the
    // mandate (mandate) — all in one artifact, all reported at once.
    const plan = structuredClone(loadFixture("pivot-before-unproven-step.json")) as {
      steps: {
        class: string;
        compensation?: unknown;
        maxSpendEur?: number;
      }[];
    };
    plan.steps[3]!.compensation = { tool: "payments.refund" };
    plan.steps[3]!.maxSpendEur = 400;

    const result = validatePlan(plan, { now: new Date("2026-08-11T09:00:00Z") });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const rules = new Set(result.errors.map((e) => e.rule));
    expect(rules).toContain("pivot-ordering");
    expect(rules).toContain("class-coherence");
    expect(rules).toContain("mandate");
  });
});
