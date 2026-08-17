import { describe, expect, it } from "vitest";
import { deriveIdempotencyKey } from "../src/canonical/key.js";
import { validatePlan } from "../src/index.js";
import { loadExample, loadFixture, makePlan } from "./helpers.js";

describe("key-integrity — same key, different bytes", () => {
  it("stays silent on legacy `${sagaId}:${stepId}` keys — the article's example still validates", () => {
    const result = validatePlan(loadExample("supplier-onboarding.json"));

    expect(result.ok).toBe(true);
  });

  it("accepts a canonical-bytes key whose hash matches the step", () => {
    const plan = makePlan({
      sagaId: "sg_01J8Z9",
      pivotIndex: 0,
      steps: [{ id: "s0", tool: "payments.capture", class: "irreversible" }],
    });
    plan.steps[0]!.idempotencyKey = deriveIdempotencyKey(plan, "s0");

    const result = validatePlan(plan);

    expect(result.ok).toBe(true);
  });

  it("rejects a canonical-bytes key whose payload changed after the key was computed", () => {
    const plan = makePlan({
      sagaId: "sg_01J8Z9",
      pivotIndex: 0,
      steps: [{ id: "s0", tool: "payments.capture", class: "irreversible" }],
    });
    plan.steps[0]!.idempotencyKey = deriveIdempotencyKey(plan, "s0");
    // The replay: same key, different payload bytes.
    plan.steps[0]!.maxSpendEur = 180;

    const result = validatePlan(plan);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.errors.find((e) => e.rule === "key-integrity");
    expect(issue).toBeDefined();
    expect(issue?.path).toEqual(["steps", 0, "idempotencyKey"]);
    expect(issue?.message).toContain("replay");
  });

  it("collects every mismatched key, not just the first", () => {
    const plan = makePlan({
      sagaId: "sg_01J8Z9",
      pivotIndex: 0,
      steps: [
        { id: "s0", tool: "payments.capture", class: "irreversible" },
        { id: "s1", tool: "email.credentials", class: "retriable" },
      ],
    });
    plan.steps[0]!.idempotencyKey = deriveIdempotencyKey(plan, "s0");
    plan.steps[1]!.idempotencyKey = deriveIdempotencyKey(plan, "s1");
    plan.steps[0]!.maxSpendEur = 180;
    plan.steps[1]!.tool = "email.credentials.v2";

    const result = validatePlan(plan);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.filter((e) => e.rule === "key-integrity")).toHaveLength(
      2,
    );
  });

  it("rejects the key-mismatch-replay fixture", () => {
    const result = validatePlan(loadFixture("key-mismatch-replay.json"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.rule).toBe("key-integrity");
    expect(result.errors[0]?.message).toContain("replay");
  });

  it("presence divergence: omitted vs explicit-default are different bytes, and both plans are valid", () => {
    // The §5.7 fixture pair promised in the A2A thread: one plan omits
    // maxSpendEur, the other sets it explicitly to 0 (its documented
    // effective default). Both carry correct canonical-bytes keys — so
    // both validate — and those keys MUST differ.
    const omitted = validatePlan(loadFixture("presence-divergence-omitted.json"));
    const explicit = validatePlan(
      loadFixture("presence-divergence-explicit-default.json"),
    );

    expect(omitted.ok).toBe(true);
    expect(explicit.ok).toBe(true);
    if (!omitted.ok || !explicit.ok) return;
    const omittedKey = omitted.plan.steps[0]!.idempotencyKey;
    const explicitKey = explicit.plan.steps[0]!.idempotencyKey;
    expect(omittedKey).not.toBe(explicitKey);
    // Same saga, same step id — the divergence is entirely in the hash.
    expect(omittedKey.startsWith("sg_01J8Z9:s0:")).toBe(true);
    expect(explicitKey.startsWith("sg_01J8Z9:s0:")).toBe(true);
  });

  it("schema accepts both key formats and still rejects a made-up key", () => {
    const plan = makePlan({
      sagaId: "sg_01J8Z9",
      pivotIndex: 0,
      steps: [{ id: "s0", tool: "payments.capture", class: "irreversible" }],
    });
    plan.steps[0]!.idempotencyKey = "sg_01J8Z9:s0:not-a-sha256-hash";

    const result = validatePlan(plan);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.rule).toBe("schema");
  });
});
