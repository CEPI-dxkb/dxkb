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

/**
 * This deployment's public origin, from the required `APP_BASE_URL`. It is what
 * DXKB declares to the shared BV-BRC services: the `registration_site_url` on
 * sign-up and the `base_url` on every job, which the AppService matches
 * exactly against its per-site container table and exports to the job as
 * `P3_BASE_URL` for links in reports. Required rather than defaulted because
 * each tier (dev, test, production) is a different site to those services; a
 * fallback would let a tier that forgot to set it pass as another one.
 * Normalized to the bare origin so the exact matches do not depend on a
 * trailing slash or case; a value that is not an absolute http(s) URL throws
 * rather than being sent.
 */
export function getAppBaseUrl(): string {
  const configured = getRequiredEnv("APP_BASE_URL");
  let url: URL | null = null;
  try {
    url = new URL(configured);
  } catch {
    // Reported below with the other malformed values.
  }
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new Error(
      `APP_BASE_URL must be an absolute http(s) URL, got "${configured}"`,
    );
  }
  return url.origin;
}
