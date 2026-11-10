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
 * `{}`, `[]` and `undefined` serialize to nothing, so an empty object never
 * renders as braces.
 */
function serializeOverviewObject(value: unknown): string | undefined {
  const json = JSON.stringify(value);
  return json && json !== "{}" && json !== "[]" ? json : undefined;
}

/** `0` and `false` are available; empty arrays and trivial objects are not. */
export function isOverviewValueAvailable(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return isOverviewPrimitive(value);
  if (Array.isArray(value)) return value.some(isOverviewPrimitive);
  if (isOverviewPrimitive(value)) return true;
  return serializeOverviewObject(value) !== undefined;
}

export function formatOverviewValue(value: unknown): string {
  if (!isOverviewValueAvailable(value)) return "Not available";
  if (Array.isArray(value)) {
    return value.filter(isOverviewPrimitive).map(String).join(", ");
  }
  if (isOverviewPrimitive(value)) return String(value);
  return serializeOverviewObject(value) ?? "Not available";
}
