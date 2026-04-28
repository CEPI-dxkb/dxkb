import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assertNoSensitiveData, sanitizeHar } from "../record-har";

interface MinimalEntry {
  request: {
    method: string;
    url: string;
    headers?: { name: string; value: string }[];
    postData?: { text: string };
  };
  response: {
    status: number;
    headers?: { name: string; value: string }[];
    content?: { text?: string };
    redirectURL?: string;
    cookies?: unknown[];
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

describe("sanitizeHar", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "record-har-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("replaces plain credentials, emails, and the recorded origin", () => {
    const harPath = writeHar(tmpDir, "plain.har", [
      {
        request: {
          method: "POST",
          url: "http://localhost:3010/api/auth/sign-in",
          postData: {
            text: '{"username":"liveuser","password":"livepass","email":"someone@example.org"}',
          },
        },
        response: {
          status: 200,
          redirectURL: "http://localhost:3010/workspace/liveuser/home",
          content: { text: '{"ok":true}' },
        },
      },
    ]);

    sanitizeHar(harPath, "liveuser", "livepass", "http://localhost:3010");

    const out = fs.readFileSync(harPath, "utf8");
    expect(out).not.toContain("liveuser");
    expect(out).not.toContain("livepass");
    expect(out).not.toContain("someone@example.org");
    expect(out).not.toContain("http://localhost:3010");
    expect(out).toContain("e2e-test-user");
    expect(out).toContain("REDACTED-PASSWORD");
    expect(out).toContain("e2e@example.com");
  });

  // Regression for the "scrub-after-stringify misses JSON-escaped credentials"
  // bug. A password with `"` would survive the old approach because
  // JSON.stringify wrote it as `\"` in the output text and the raw-credential
  // regex no longer matched.
  it("scrubs credentials that contain JSON-escaped characters", () => {
    const trickyPassword = 'pa$$"word\\with\\slash';
    const trickyUser = 'odd"name';
    const harPath = writeHar(tmpDir, "escaped.har", [
      {
        request: {
          method: "POST",
          url: "http://localhost:3010/api/auth/sign-in",
          // postData.text is the literal HTTP body — when parsed back into a
          // JS string the credential characters are present in unescaped form.
          postData: {
            text: `body-with-creds: user=${trickyUser} pwd=${trickyPassword}`,
          },
        },
        response: {
          status: 200,
          content: { text: `echo: ${trickyUser} :: ${trickyPassword}` },
        },
      },
    ]);

    sanitizeHar(harPath, trickyUser, trickyPassword, "http://localhost:3010");

    const out = fs.readFileSync(harPath, "utf8");
    // Neither raw nor JSON-escaped form of the credential should remain.
    expect(out).not.toContain(trickyPassword);
    expect(out).not.toContain(JSON.stringify(trickyPassword).slice(1, -1));
    expect(out).not.toContain(trickyUser);
    expect(out).not.toContain(JSON.stringify(trickyUser).slice(1, -1));
    expect(out).toContain("REDACTED-PASSWORD");
    expect(out).toContain("e2e-test-user");
  });

  it("strips sensitive headers and clears response cookies", () => {
    const harPath = writeHar(tmpDir, "headers.har", [
      {
        request: {
          method: "GET",
          url: "http://localhost:3010/api/auth/get-session",
          headers: [
            { name: "Cookie", value: "bvbrc_token=abc|sig=deadbeefdeadbeefdeadbeefdeadbeef" },
            { name: "X-Trace-Id", value: "trace-123" },
          ],
        },
        response: {
          status: 200,
          headers: [
            { name: "Set-Cookie", value: "bvbrc_token=abc|sig=deadbeefdeadbeefdeadbeefdeadbeef" },
            { name: "Authentication-Info", value: "nextnonce=..." },
            { name: "Content-Type", value: "application/json" },
          ],
          content: { text: "{}" },
          cookies: [{ name: "bvbrc_token", value: "abc" }],
        },
      },
    ]);

    sanitizeHar(harPath, "liveuser", "livepass", "http://localhost:3010");

    const har = JSON.parse(fs.readFileSync(harPath, "utf8")) as {
      log: { entries: MinimalEntry[] };
    };
    const entry = har.log.entries[0];
    const requestHeaderNames = (entry.request.headers ?? []).map((h) => h.name.toLowerCase());
    const responseHeaderNames = (entry.response.headers ?? []).map((h) => h.name.toLowerCase());
    expect(requestHeaderNames).not.toContain("cookie");
    expect(requestHeaderNames).toContain("x-trace-id");
    expect(responseHeaderNames).not.toContain("set-cookie");
    expect(responseHeaderNames).not.toContain("authentication-info");
    expect(responseHeaderNames).toContain("content-type");
    expect(entry.response.cookies).toEqual([]);
  });
});

describe("assertNoSensitiveData", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "assert-har-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes when the file contains no sensitive markers", () => {
    const harPath = path.join(tmpDir, "clean.har");
    fs.writeFileSync(harPath, JSON.stringify({ log: { entries: [] } }));
    expect(() => assertNoSensitiveData(harPath, "liveuser", "livepass")).not.toThrow();
  });

  it("detects credentials in their JSON-escaped on-disk form", () => {
    const trickyPassword = 'pa$$"word';
    // Simulate a leaked credential: HAR file contains the JSON-escaped form
    // (\") because it was written via JSON.stringify of an object that had
    // the password as a raw string value.
    const harPath = path.join(tmpDir, "leaked.har");
    fs.writeFileSync(
      harPath,
      JSON.stringify({ log: { entries: [{ note: `leak:${trickyPassword}` }] } }),
    );

    expect(() => assertNoSensitiveData(harPath, "", trickyPassword)).toThrow(
      /live password appears in HAR/,
    );
    // The assertion deletes the file when it finds violations.
    expect(fs.existsSync(harPath)).toBe(false);
  });

  it("detects BV-BRC-shaped session tokens", () => {
    const harPath = path.join(tmpDir, "token.har");
    fs.writeFileSync(harPath, '{"x":"un=foo|sig=deadbeefdeadbeefdeadbeefdeadbeef"}');
    expect(() => assertNoSensitiveData(harPath, "", "")).toThrow(/sig=<hex>/);
  });
});
