import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalize } from "../src/canonical/jcs.js";

// The official RFC 8785 test vectors, vendored verbatim from
// https://github.com/cyberphone/json-canonicalization (testdata/input and
// testdata/output). The expected files ARE the canonical bytes — the
// fixtures are the spec.
const inputDir = new URL("./fixtures/jcs/input/", import.meta.url);
const expectedDir = new URL("./fixtures/jcs/expected/", import.meta.url);

describe("canonicalize — JCS (RFC 8785)", () => {
  for (const name of readdirSync(inputDir).sort()) {
    it(`matches the official test vector: ${name}`, () => {
      const input = JSON.parse(readFileSync(new URL(name, inputDir), "utf8"));
      const expected = readFileSync(new URL(name, expectedDir), "utf8");

      expect(canonicalize(input)).toBe(expected);
    });
  }

  it("serializes numbers per ES6 ToString (RFC 8785 §3.2.2.3)", () => {
    expect(canonicalize(0)).toBe("0");
    expect(canonicalize(-0)).toBe("0");
    expect(canonicalize(1e21)).toBe("1e+21");
    expect(canonicalize(1e20)).toBe("100000000000000000000");
    expect(canonicalize(0.000001)).toBe("0.000001");
    expect(canonicalize(1e-7)).toBe("1e-7");
    expect(canonicalize(9007199254740992)).toBe("9007199254740992");
    expect(canonicalize(5e-324)).toBe("5e-324");
    expect(canonicalize(1.7976931348623157e308)).toBe(
      "1.7976931348623157e+308",
    );
  });

  it("rejects numbers JSON cannot represent (NaN, Infinity)", () => {
    expect(() => canonicalize(Number.NaN)).toThrow();
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => canonicalize(Number.NEGATIVE_INFINITY)).toThrow();
  });

  it("rejects values that are not JSON data (undefined, functions)", () => {
    expect(() => canonicalize(undefined)).toThrow();
    expect(() => canonicalize({ a: () => {} })).toThrow();
  });

  it("sorts object keys by UTF-16 code units, not code points", () => {
    // U+1F602 (😂) is 😂 in UTF-16; its first code unit 0xD83D
    // sorts BEFORE U+FB33 (דּ, 0xFB33) even though its code point is higher.
    expect(canonicalize({ "דּ": 1, "😂": 2 })).toBe(
      '{"😂":2,"דּ":1}',
    );
  });

  it("escapes lone surrogates the way JSON.stringify does", () => {
    expect(canonicalize("\uD800")).toBe('"\\ud800"');
  });
});
