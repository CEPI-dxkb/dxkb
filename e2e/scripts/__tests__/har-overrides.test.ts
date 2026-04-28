import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { harOverridesFor } from "../har-overrides";

interface MinimalEntry {
  request: { method: string; url: string; postData?: { text: string } };
  response: {
    status: number;
    headers?: { name: string; value: string }[];
    content?: { text?: string };
  };
}

function buildHar(entries: MinimalEntry[]): string {
  return JSON.stringify({ log: { version: "1.2", entries } });
}

function writeHar(dir: string, name: string, entries: MinimalEntry[]): string {
  const harPath = path.join(dir, name);
  fs.writeFileSync(harPath, buildHar(entries));
  return harPath;
}

describe("harOverridesFor", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "har-overrides-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("emits one override per recorded entry when URLs are unique", () => {
    const harPath = writeHar(tmpDir, "auth.har", [
      {
        request: { method: "GET", url: "http://e2e-har-replay.local/api/auth/get-session" },
        response: { status: 200, content: { text: '{"user":null}' } },
      },
      {
        request: {
          method: "POST",
          url: "http://e2e-har-replay.local/api/auth/sign-in/email",
          postData: { text: '{"username":"e2e-test-user","password":"REDACTED-PASSWORD"}' },
        },
        response: { status: 200, content: { text: '{"user":{"id":"u1"}}' } },
      },
    ]);

    const overrides = harOverridesFor(harPath);
    expect(overrides).toHaveLength(2);
    expect(overrides[0]).toMatchObject({
      url: "/api/auth/get-session",
      method: "GET",
      status: 200,
      body: '{"user":null}',
    });
    expect(overrides[1]).toMatchObject({
      url: "/api/auth/sign-in/email",
      method: "POST",
      status: 200,
      body: '{"user":{"id":"u1"}}',
    });
    // No matchBody on the sign-in entry: its body has no `method` field, so
    // it isn't a JSON-RPC envelope. Plain URL+method matching is enough.
    expect(overrides[1].matchBody).toBeUndefined();
  });

  it("fans /api/services/workspace out by JSON-RPC method via matchBody", () => {
    const harPath = writeHar(tmpDir, "workspace.har", [
      {
        request: {
          method: "POST",
          url: "http://e2e-har-replay.local/api/services/workspace",
          postData: { text: '{"id":1,"method":"Workspace.ls","params":[]}' },
        },
        response: { status: 200, content: { text: '{"result":"ls-data"}' } },
      },
      {
        request: {
          method: "POST",
          url: "http://e2e-har-replay.local/api/services/workspace",
          postData: { text: '{"id":1,"method":"Workspace.list_permissions","params":[]}' },
        },
        response: { status: 200, content: { text: '{"result":"perm-data"}' } },
      },
    ]);

    const overrides = harOverridesFor(harPath);
    expect(overrides).toHaveLength(2);

    const lsOverride = overrides.find((o) => o.matchBody?.({ method: "Workspace.ls" }));
    const permOverride = overrides.find((o) =>
      o.matchBody?.({ method: "Workspace.list_permissions" }),
    );
    expect(lsOverride?.body).toBe('{"result":"ls-data"}');
    expect(permOverride?.body).toBe('{"result":"perm-data"}');
    // Bodies that don't carry the right RPC method must not match either override.
    expect(lsOverride?.matchBody?.({ method: "Workspace.get" })).toBe(false);
    expect(permOverride?.matchBody?.({ method: "Workspace.get" })).toBe(false);
    expect(lsOverride?.matchBody?.(null)).toBe(false);
  });

  it("serves sequential same-key entries in HAR order via callIndex", () => {
    // Models the upload journey: a Workspace.ls before the upload (no new
    // file) followed by a Workspace.ls after the upload (new file present).
    // Both calls share the same URL+method+RPC method; the spec needs each
    // call to receive the next recorded response, not just the first one.
    const harPath = writeHar(tmpDir, "upload.har", [
      {
        request: {
          method: "POST",
          url: "http://e2e-har-replay.local/api/services/workspace",
          postData: { text: '{"method":"Workspace.ls","id":1}' },
        },
        response: { status: 200, content: { text: '{"result":"before"}' } },
      },
      {
        request: {
          method: "POST",
          url: "http://e2e-har-replay.local/api/services/workspace",
          postData: { text: '{"method":"Workspace.ls","id":1}' },
        },
        response: { status: 200, content: { text: '{"result":"after"}' } },
      },
    ]);

    const overrides = harOverridesFor(harPath);
    expect(overrides).toHaveLength(1);
    const body = overrides[0].body;
    if (typeof body !== "function") throw new Error("expected body function");
    expect(body({ callIndex: 0, parsedBody: null })).toBe('{"result":"before"}');
    expect(body({ callIndex: 1, parsedBody: null })).toBe('{"result":"after"}');
    // Beyond the recorded sequence, freeze on the last entry rather than
    // returning undefined and serving an empty body.
    expect(body({ callIndex: 7, parsedBody: null })).toBe('{"result":"after"}');
  });

  it("strips sensitive headers and preserves the rest", () => {
    const harPath = writeHar(tmpDir, "headers.har", [
      {
        request: { method: "GET", url: "http://e2e-har-replay.local/api/auth/get-session" },
        response: {
          status: 200,
          headers: [
            { name: "Set-Cookie", value: "session=secret" },
            { name: "Authentication-Info", value: "nextnonce=..." },
            { name: "Content-Type", value: "application/json" },
            { name: "X-Trace-Id", value: "abc-123" },
          ],
          content: { text: "{}" },
        },
      },
    ]);

    const headers = harOverridesFor(harPath)[0].headers ?? {};
    expect(headers).toHaveProperty("Content-Type", "application/json");
    expect(headers).toHaveProperty("X-Trace-Id", "abc-123");
    expect(headers).not.toHaveProperty("Set-Cookie");
    expect(headers).not.toHaveProperty("Authentication-Info");
  });

  it("uses path+search so the host placeholder is irrelevant", () => {
    // The recorder rewrites every recorded host to `http://e2e-har-replay.local`.
    // The override matcher does a `requestUrl.includes(override.url)` check
    // against the live request URL (which uses 127.0.0.1:<E2E_PORT>), so the
    // override's URL must not pin the host.
    const harPath = writeHar(tmpDir, "path.har", [
      {
        request: {
          method: "GET",
          url: "http://e2e-har-replay.local/api/services/app-service/jobs/job-42",
        },
        response: { status: 200, content: { text: '{"id":"job-42"}' } },
      },
    ]);

    expect(harOverridesFor(harPath)[0]).toMatchObject({
      url: "/api/services/app-service/jobs/job-42",
      method: "GET",
    });
  });

  it("propagates non-200 status from the first entry of a group", () => {
    const harPath = writeHar(tmpDir, "error.har", [
      {
        request: { method: "GET", url: "http://e2e-har-replay.local/api/services/genome/by-ids" },
        response: { status: 502, content: { text: '{"error":"upstream"}' } },
      },
    ]);

    expect(harOverridesFor(harPath)[0]).toMatchObject({ status: 502 });
  });

  it("resolves relative HAR paths against e2e/fixtures/hars/", () => {
    // The committed HARs are read by name (e.g. `harOverridesFor("workspace-browse.har")`).
    // We point CWD at a tmp dir, drop a fixture in the expected subpath, and
    // confirm the helper finds it.
    const fixtureDir = path.join(tmpDir, "e2e/fixtures/hars");
    fs.mkdirSync(fixtureDir, { recursive: true });
    writeHar(fixtureDir, "fixture.har", [
      {
        request: { method: "GET", url: "http://e2e-har-replay.local/api/auth/get-session" },
        response: { status: 200, content: { text: "{}" } },
      },
    ]);
    const cwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const overrides = harOverridesFor("fixture.har");
      expect(overrides).toHaveLength(1);
    } finally {
      process.chdir(cwd);
    }
  });
});
