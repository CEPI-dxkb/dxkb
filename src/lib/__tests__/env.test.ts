import { getAppBaseUrl, getRequiredEnv } from "../env";

describe("getRequiredEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the value when the env var is set", () => {
    vi.stubEnv("TEST_VAR", "hello");

    expect(getRequiredEnv("TEST_VAR")).toBe("hello");
  });

  it("throws when the env var is missing (undefined)", () => {
    vi.stubEnv("TEST_VAR", undefined);

    expect(() => getRequiredEnv("TEST_VAR")).toThrow(
      "Missing required environment variable: TEST_VAR",
    );
  });

  it("throws when the env var is an empty string", () => {
    vi.stubEnv("TEST_VAR", "");

    expect(() => getRequiredEnv("TEST_VAR")).toThrow(
      "Missing required environment variable: TEST_VAR",
    );
  });
});

describe("getAppBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([undefined, ""])(
    "throws when APP_BASE_URL is not set (%j), rather than assume a tier",
    (value) => {
      vi.stubEnv("APP_BASE_URL", value);

      expect(() => getAppBaseUrl()).toThrow(
        "Missing required environment variable: APP_BASE_URL",
      );
    },
  );

  it("normalizes the configured value to its origin", () => {
    vi.stubEnv("APP_BASE_URL", "https://Dev.DXKB.org:443/services/");

    expect(getAppBaseUrl()).toBe("https://dev.dxkb.org");
  });

  it("keeps a non-default port", () => {
    vi.stubEnv("APP_BASE_URL", "http://localhost:3019/");

    expect(getAppBaseUrl()).toBe("http://localhost:3019");
  });

  it.each(["dxkb.org", "javascript:alert(1)", "ftp://dxkb.org"])(
    "throws for a value that is not an absolute http(s) URL (%s)",
    (value) => {
      vi.stubEnv("APP_BASE_URL", value);

      expect(() => getAppBaseUrl()).toThrow(
        `APP_BASE_URL must be an absolute http(s) URL, got "${value}"`,
      );
    },
  );
});
