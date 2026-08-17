import { describe, expect, it } from "vitest";
import { deriveIdempotencyKey } from "../src/canonical/key.js";
import { makePlan } from "./helpers.js";

const HASH_SUFFIX = /^[0-9a-f]{64}$/;

describe("deriveIdempotencyKey — canonical-bytes keys", () => {
  const plan = makePlan({
    sagaId: "sg_01J8Z9",
    pivotIndex: 0,
    steps: [{ id: "s0", tool: "payments.capture", class: "irreversible" }],
  });

  it("produces `${sagaId}:${stepId}:${sha256-hex}` — prefix for debuggability, hash for integrity", () => {
    const key = deriveIdempotencyKey(plan, "s0");

    expect(key.startsWith("sg_01J8Z9:s0:")).toBe(true);
    expect(key.slice("sg_01J8Z9:s0:".length)).toMatch(HASH_SUFFIX);
  });

  it("is deterministic", () => {
    expect(deriveIdempotencyKey(plan, "s0")).toBe(
      deriveIdempotencyKey(plan, "s0"),
    );
  });

  it("hashes the step minus its own idempotencyKey — deriving is not circular", () => {
    // Whatever key the step currently carries (legacy, wrong, or absent
    // from the hash's point of view), the derived key is the same.
    const withDerivedKey = structuredClone(plan);
    withDerivedKey.steps[0]!.idempotencyKey = deriveIdempotencyKey(plan, "s0");

    expect(deriveIdempotencyKey(withDerivedKey, "s0")).toBe(
      deriveIdempotencyKey(plan, "s0"),
    );
  });

  it("changes when the step's payload changes", () => {
    const mutated = structuredClone(plan);
    mutated.steps[0]!.maxSpendEur = 180;

    expect(deriveIdempotencyKey(mutated, "s0")).not.toBe(
      deriveIdempotencyKey(plan, "s0"),
    );
  });

  it("diverges between an omitted field and the same field explicitly set to its default", () => {
    const explicit = structuredClone(plan);
    explicit.steps[0]!.maxSpendEur = 0;

    expect(deriveIdempotencyKey(explicit, "s0")).not.toBe(
      deriveIdempotencyKey(plan, "s0"),
    );
  });

  it("does not depend on plan-level fields outside the key's prefix — the signature above all", () => {
    const resigned = structuredClone(plan);
    resigned.signature = "ed25519:completely-different";

    expect(deriveIdempotencyKey(resigned, "s0")).toBe(
      deriveIdempotencyKey(plan, "s0"),
    );
  });

  it("throws on a stepId the plan does not contain", () => {
    expect(() => deriveIdempotencyKey(plan, "s404")).toThrow(/s404/);
  });
});
