/**
 * JCS — JSON Canonicalization Scheme, RFC 8785
 * (https://www.rfc-editor.org/rfc/rfc8785).
 *
 * Vendored rather than depended on: Zod stays this library's only runtime
 * dependency. Verified against the official test vectors from the RFC
 * reference implementation (https://github.com/cyberphone/json-canonicalization),
 * vendored in test/fixtures/jcs/.
 *
 * The three obligations of RFC 8785, and where each is met:
 * - object keys sorted lexicographically by UTF-16 code units (§3.2.3):
 *   Array.prototype.sort's default comparator is exactly that order;
 * - numbers serialized per ES6 ToString (§3.2.2.3): JavaScript's own
 *   JSON.stringify already implements it — NaN and the infinities have no
 *   JSON representation and are rejected here before they reach it;
 * - strings escaped per §3.2.2.2 (two-char escapes, lowercase \u00xx for
 *   other control characters, everything else literal): again exactly
 *   JSON.stringify's behavior, including \u-escaping lone surrogates.
 */
export function canonicalize(value: unknown): string {
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "boolean":
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(
          `cannot canonicalize non-finite number ${String(value)}: it has no JSON representation`,
        );
      }
      return JSON.stringify(value);
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalize(item)).join(",")}]`;
      }
      return `{${Object.keys(value)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${canonicalize(
              (value as Record<string, unknown>)[key],
            )}`,
        )
        .join(",")}}`;
    default:
      // undefined, function, symbol, bigint: not JSON data. JSON.stringify
      // would silently drop or mangle these; canonical bytes must be total.
      throw new TypeError(`cannot canonicalize value of type ${typeof value}`);
  }
}
