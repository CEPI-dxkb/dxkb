type OverviewPrimitiveValue = string | number | boolean | bigint;

function isOverviewPrimitive(value: unknown): value is OverviewPrimitiveValue {
  return (
    (typeof value === "string" && value.trim() !== "") ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  );
}

/**
 * Note on array items: a non-primitive item is dropped, and so is a `null` or
 * `undefined` one. The pre-consolidation `display()` helpers rendered those
 * last two as the literal text `"null"`/`"undefined"` via a bare `String()`.
 * No schema-typed array field can hold them today, so this is unreachable
 * rather than a behaviour change, but it is a divergence worth knowing about.
 */

/**
 * JSON-serializes a plain (non-array, non-primitive) value. A result that
 * carries no content -- `undefined` (`JSON.stringify` returns that for a
 * function or `undefined` itself), `"{}"`, or `"[]"` -- is treated as no
 * serialization at all, so an empty object never renders as empty braces.
 */
function serializeOverviewObject(value: unknown): string | undefined {
  const json = JSON.stringify(value);
  return json && json !== "{}" && json !== "[]" ? json : undefined;
}

/**
 * Whether a raw overview field value has anything worth displaying.
 *
 * `0` and `false` are available. `null`, `undefined`, `""`, an empty array,
 * and an array with no primitive items are not -- an empty array must never
 * render as an empty value. A plain object is available only if it
 * serializes to non-trivial JSON (see `serializeOverviewObject`); it is
 * never stringified as the meaningless "[object Object]".
 */
export function isOverviewValueAvailable(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return isOverviewPrimitive(value);
  if (Array.isArray(value)) return value.some(isOverviewPrimitive);
  if (isOverviewPrimitive(value)) return true;
  return serializeOverviewObject(value) !== undefined;
}

/**
 * Formats an overview field value as display text. Arrays are joined from
 * their primitive items only -- non-primitive items (e.g. objects) are
 * dropped rather than stringified. A plain object renders as its JSON
 * serialization (real, inspectable content, unlike "[object Object]").
 * Unavailable values (see `isOverviewValueAvailable`) format as
 * "Not available"; callers that want to omit the field entirely instead of
 * showing that text should check availability themselves before rendering.
 */
export function formatOverviewValue(value: unknown): string {
  if (!isOverviewValueAvailable(value)) return "Not available";
  if (Array.isArray(value)) {
    return value.filter(isOverviewPrimitive).map(String).join(", ");
  }
  if (isOverviewPrimitive(value)) return String(value);
  return serializeOverviewObject(value) ?? "Not available";
}
