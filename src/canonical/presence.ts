/**
 * The presence rule, made explicit and testable.
 *
 * What goes into the canonical bytes is exactly what the author wrote:
 * omitted optional fields stay omitted; fields explicitly set to a value
 * are included even when that value equals a documented default. Defaults
 * are validator semantics, not bytes — materializing them here would let
 * two artifacts that the author wrote differently hash identically, and
 * an integrity check that cannot see the difference cannot defend it.
 *
 * The only fields these functions remove are the ones that CARRY an
 * integrity value, mirroring A2A §8.4.1's exclusion of the signature from
 * the signed bytes: a field cannot protect itself without circularity.
 * - plan level: `signature` (the signature is over the plan);
 * - step level: `idempotencyKey` (the key's hash suffix is over the step).
 * Nothing else is added, removed, defaulted, or reordered.
 */

export function preparePlanForHashing<T extends Record<string, unknown>>(
  plan: T,
): Omit<T, "signature"> {
  const { signature: _signature, ...rest } = plan;
  return rest;
}

export function prepareStepForHashing<T extends Record<string, unknown>>(
  step: T,
): Omit<T, "idempotencyKey"> {
  const { idempotencyKey: _idempotencyKey, ...rest } = step;
  return rest;
}
