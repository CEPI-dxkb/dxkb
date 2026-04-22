export function extractRealmFromToken(token: string): string | undefined {
  const unMatch = token.match(/un=([^|]+)/);
  if (!unMatch) return undefined;
  const unValue = unMatch[1];
  const atIndex = unValue.indexOf("@");
  if (atIndex === -1) return undefined;
  return unValue.substring(atIndex + 1);
}
