import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnvFile, substitutePort } from "../env-loader.mjs";

// Plain string-map for the env fixture — avoids NodeJS.ProcessEnv, which Next's type
// augmentation narrows to require NODE_ENV. We only care about key/value semantics here.
type EnvFixture = Record<string, string | undefined>;

describe("substitutePort", () => {
  it("replaces every occurrence of ${E2E_PORT}", () => {
    expect(substitutePort("http://127.0.0.1:${E2E_PORT}/api", "3030")).toBe(
      "http://127.0.0.1:3030/api",
    );
    expect(
      substitutePort("a://h:${E2E_PORT}/x b://h:${E2E_PORT}/y", "4040"),
    ).toBe("a://h:4040/x b://h:4040/y");
  });

  it("leaves values without the token untouched", () => {
    expect(substitutePort("http://127.0.0.1:3020/api", "9999")).toBe(
      "http://127.0.0.1:3020/api",
    );
  });
});

describe("loadEnvFile", () => {
  let tmpDir: string;
  let cwdBefore: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-loader-"));
    cwdBefore = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(cwdBefore);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeEnv(name: string, body: string) {
    fs.writeFileSync(path.join(tmpDir, name), body);
  }

  it("sets keys not already in the env object", () => {
    writeEnv(".env.e2e.test", "APP_SERVICE_URL=http://127.0.0.1:${E2E_PORT}/api");
    const env: EnvFixture = {};
    loadEnvFile(".env.e2e.test", { required: true, port: "3020", env });
    expect(env.APP_SERVICE_URL).toBe("http://127.0.0.1:3020/api");
  });

  it("does not override keys already set — existing value wins", () => {
    writeEnv(".env.e2e.test", "APP_SERVICE_URL=http://committed:3020");
    const env: EnvFixture = { APP_SERVICE_URL: "http://shell-override:9999" };
    loadEnvFile(".env.e2e.test", { required: true, port: "3020", env });
    expect(env.APP_SERVICE_URL).toBe("http://shell-override:9999");
  });

  it("loads local first, then .test fills gaps — local wins on shared keys", () => {
    writeEnv(".env.e2e.local", "APP_SERVICE_URL=http://local-win:${E2E_PORT}/api");
    writeEnv(
      ".env.e2e.test",
      [
        "APP_SERVICE_URL=http://committed:${E2E_PORT}/api",
        "WORKSPACE_API_URL=http://committed:${E2E_PORT}/ws",
      ].join("\n"),
    );
    const env: EnvFixture = {};
    loadEnvFile(".env.e2e.local", { required: false, port: "3030", env });
    loadEnvFile(".env.e2e.test", { required: true, port: "3030", env });
    // Local wins for the key both files declare.
    expect(env.APP_SERVICE_URL).toBe("http://local-win:3030/api");
    // .test fills in keys local did not declare.
    expect(env.WORKSPACE_API_URL).toBe("http://committed:3030/ws");
  });

  it("shell-exported vars beat both files", () => {
    writeEnv(".env.e2e.local", "APP_SERVICE_URL=http://local:3030");
    writeEnv(".env.e2e.test", "APP_SERVICE_URL=http://committed:3020");
    const env: EnvFixture = { APP_SERVICE_URL: "http://shell:7777" };
    loadEnvFile(".env.e2e.local", { required: false, port: "3030", env });
    loadEnvFile(".env.e2e.test", { required: true, port: "3030", env });
    expect(env.APP_SERVICE_URL).toBe("http://shell:7777");
  });

  it("returns silently when an optional file is missing", () => {
    const env: EnvFixture = {};
    expect(() =>
      loadEnvFile(".env.e2e.local", { required: false, port: "3020", env }),
    ).not.toThrow();
    expect(Object.keys(env)).toHaveLength(0);
  });

  it("throws when a required file is missing", () => {
    const env: EnvFixture = {};
    expect(() =>
      loadEnvFile(".env.e2e.test", { required: true, port: "3020", env }),
    ).toThrow(/Required env file not found/);
  });

  it("substitutes ${E2E_PORT} in every value", () => {
    writeEnv(
      ".env.e2e.test",
      [
        "APP_SERVICE_URL=http://127.0.0.1:${E2E_PORT}/api",
        "WORKSPACE_API_URL=http://127.0.0.1:${E2E_PORT}/ws",
        "STATIC=no-substitution-here",
      ].join("\n"),
    );
    const env: EnvFixture = {};
    loadEnvFile(".env.e2e.test", { required: true, port: "4040", env });
    expect(env.APP_SERVICE_URL).toBe("http://127.0.0.1:4040/api");
    expect(env.WORKSPACE_API_URL).toBe("http://127.0.0.1:4040/ws");
    expect(env.STATIC).toBe("no-substitution-here");
  });
});
