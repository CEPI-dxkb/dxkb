import {
  parseUiPreference,
  parseUiPreferences,
  serializeUiPreferenceCookie,
} from "../cookie";
import { defaultUiPreferences } from "../definitions";

describe("parseUiPreference", () => {
  it("returns the default when the cookie is absent", () => {
    expect(parseUiPreference("viewNavCollapsed", undefined)).toBe(false);
  });

  it("returns a stored value that matches the schema", () => {
    expect(parseUiPreference("viewNavCollapsed", "true")).toBe(true);
    expect(
      parseUiPreference(
        "workspacePanelLayout",
        '{"workspace-main":30,"workspace-details":70}',
      ),
    ).toStrictEqual({ "workspace-main": 30, "workspace-details": 70 });
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["the wrong type", '"yes"'],
  ])("falls back to the default on %s", (_label, raw) => {
    expect(parseUiPreference("viewNavCollapsed", raw)).toBe(false);
  });

  it.each([
    ["a missing panel id", '{"workspace-main":30}'],
    ["an unknown panel id", '{"workspace-main":30,"workspace-details":70,"x":1}'],
    ["an out-of-range size", '{"workspace-main":-5,"workspace-details":105}'],
    // The app never saves a share <= 0. Show would call resize("0%") and do nothing,
    // and {0, 0} makes the library compute a NaN width.
    ["a zero details share", '{"workspace-main":100,"workspace-details":0}'],
    ["a zero main share", '{"workspace-main":0,"workspace-details":100}'],
    ["both shares zero", '{"workspace-main":0,"workspace-details":0}'],
  ])("rejects a panel layout with %s", (_label, raw) => {
    expect(parseUiPreference("workspacePanelLayout", raw)).toStrictEqual(
      defaultUiPreferences.workspacePanelLayout,
    );
  });
});

describe("workspaceSort", () => {
  it("accepts a known field and direction", () => {
    expect(
      parseUiPreference("workspaceSort", '{"field":"size","direction":"desc"}'),
    ).toStrictEqual({ field: "size", direction: "desc" });
  });

  it.each(['{"field":"bogus","direction":"asc"}', '{"field":"name"}'])(
    "falls back to name ascending for %s",
    (raw) => {
      expect(parseUiPreference("workspaceSort", raw)).toStrictEqual({
        field: "name",
        direction: "asc",
      });
    },
  );
});

describe("parseUiPreferences", () => {
  it("reads each preference from its own cookie", () => {
    const cookies: Record<string, string> = {
      "dxkb-view-nav-collapsed": "true",
      "dxkb-jobs-panel-layout": '{"jobs-main":60,"jobs-details":40}',
    };
    expect(parseUiPreferences((name) => cookies[name])).toStrictEqual({
      ...defaultUiPreferences,
      viewNavCollapsed: true,
      jobsPanelLayout: { "jobs-main": 60, "jobs-details": 40 },
    });
  });
});

describe("serializeUiPreferenceCookie", () => {
  const layout = { "workspace-main": 38.52, "workspace-details": 61.48 };

  it("writes a root-path, year-long, Lax cookie with a URI-encoded JSON value", () => {
    expect(
      serializeUiPreferenceCookie("workspacePanelLayout", layout, {
        secure: false,
      }),
    ).toBe(
      "dxkb-workspace-panel-layout=%7B%22workspace-main%22%3A38.52%2C%22workspace-details%22%3A61.48%7D; Path=/; Max-Age=31536000; SameSite=Lax",
    );
  });

  it("adds Secure on https", () => {
    expect(
      serializeUiPreferenceCookie("viewNavCollapsed", true, { secure: true }),
    ).toBe(
      "dxkb-view-nav-collapsed=true; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
  });

  it("round-trips through the parser after the URI decoding Next applies", () => {
    const cookie = serializeUiPreferenceCookie("workspacePanelLayout", layout, {
      secure: false,
    });
    const encodedValue = cookie.split("; ")[0].slice(cookie.indexOf("=") + 1);
    expect(
      parseUiPreference("workspacePanelLayout", decodeURIComponent(encodedValue)),
    ).toStrictEqual(layout);
  });
});
