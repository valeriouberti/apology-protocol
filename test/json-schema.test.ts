import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planJsonSchema } from "../src/index.js";

// The Zod schema is the source of truth; schema/plan.schema.json is a
// generated artifact. This test fails if they drift — regenerate with
// `npm run schema`.
describe("JSON Schema generation", () => {
  it("the checked-in schema/plan.schema.json matches the Zod source of truth", () => {
    const onDisk: unknown = JSON.parse(
      readFileSync(new URL("../schema/plan.schema.json", import.meta.url), "utf8"),
    );

    expect(onDisk).toEqual(planJsonSchema());
  });

  it("targets draft 2020-12 and rejects unknown properties", () => {
    const schema = planJsonSchema() as {
      $schema?: string;
      additionalProperties?: boolean;
      required?: string[];
    };

    expect(schema.$schema).toContain("2020-12");
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toContain("pivotIndex");
    expect(schema.required).toContain("mandate");
  });

  it("carries the three step classes", () => {
    const schema = JSON.stringify(planJsonSchema());

    for (const stepClass of ["compensable", "retriable", "irreversible"]) {
      expect(schema).toContain(stepClass);
    }
  });
});
