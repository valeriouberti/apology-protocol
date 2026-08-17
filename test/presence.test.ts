import { describe, expect, it } from "vitest";
import { canonicalize } from "../src/canonical/jcs.js";
import {
  preparePlanForHashing,
  prepareStepForHashing,
} from "../src/canonical/presence.js";

describe("presence — what goes into the canonical bytes", () => {
  it("removes the plan-level signature field and touches nothing else", () => {
    const plan = {
      sagaId: "sg_01J8Z9",
      planVersion: 1,
      signature: "ed25519:abc",
      pivotIndex: 0,
      steps: [],
    };

    const prepared = preparePlanForHashing(plan);

    expect(prepared).not.toHaveProperty("signature");
    expect(prepared).toEqual({
      sagaId: "sg_01J8Z9",
      planVersion: 1,
      pivotIndex: 0,
      steps: [],
    });
    // The input is not mutated.
    expect(plan.signature).toBe("ed25519:abc");
  });

  it("removes the step's own idempotencyKey field and touches nothing else", () => {
    const step = {
      id: "s1",
      tool: "vendor.create",
      class: "compensable",
      compensation: { tool: "vendor.delete" },
      idempotencyKey: "sg_01J8Z9:s1",
    };

    const prepared = prepareStepForHashing(step);

    expect(prepared).not.toHaveProperty("idempotencyKey");
    expect(prepared).toEqual({
      id: "s1",
      tool: "vendor.create",
      class: "compensable",
      compensation: { tool: "vendor.delete" },
    });
    expect(step.idempotencyKey).toBe("sg_01J8Z9:s1");
  });

  it("keeps omitted optional fields omitted — defaults are never materialized", () => {
    const step = {
      id: "s1",
      tool: "vendor.create",
      class: "retriable",
      idempotencyKey: "sg_01J8Z9:s1",
    };

    const prepared = prepareStepForHashing(step);

    expect(Object.keys(prepared).sort()).toEqual(["class", "id", "tool"]);
  });

  it("keeps explicitly-set fields even when the value equals a documented default", () => {
    // The presence rule from the A2A discussion: omitted and
    // explicitly-set-to-default are DIFFERENT canonical forms.
    const omitted = prepareStepForHashing({
      id: "s1",
      tool: "vendor.create",
      class: "retriable",
      idempotencyKey: "sg_01J8Z9:s1",
    });
    const explicit = prepareStepForHashing({
      id: "s1",
      tool: "vendor.create",
      class: "retriable",
      maxSpendEur: 0,
      idempotencyKey: "sg_01J8Z9:s1",
    });

    expect(explicit).toHaveProperty("maxSpendEur", 0);
    expect(canonicalize(omitted)).not.toBe(canonicalize(explicit));
  });
});
