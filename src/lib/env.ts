/**
 * Returns the value of a required environment variable.
 * Throws if the variable is missing or empty.
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
