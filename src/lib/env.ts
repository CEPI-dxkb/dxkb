export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** The deployment's public origin from `APP_BASE_URL`, which BV-BRC services match exactly; required so one tier cannot pass as another, and normalized to a bare origin. */
export function getAppBaseUrl(): string {
  const configured = getRequiredEnv("APP_BASE_URL");
  let url: URL | null = null;
  try {
    url = new URL(configured);
  } catch {
    // invalid URL: rejected below
  }
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new Error(
      `APP_BASE_URL must be an absolute http(s) URL, got "${configured}"`,
    );
  }
  return url.origin;
}
