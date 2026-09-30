vi.mock("server-only", () => ({}));

import { mergeSettingsPatches } from "../profile-settings";

describe("mergeSettingsPatches", () => {
  it("sets each changed key in place when the profile stores a settings object", () => {
    expect(
      mergeSettingsPatches(
        [{ op: "replace", path: "/settings", value: { default_job_folder: "/b" } }],
        { default_job_folder: "/a", legacy_key: "keep" },
      ),
    ).toStrictEqual([
      { op: "add", path: "/settings/default_job_folder", value: "/b" },
    ]);
  });

  it("does not resend stored keys, so a concurrent change to them is kept", () => {
    const upstream = mergeSettingsPatches(
      [{ op: "replace", path: "/settings", value: { default_job_folder: "/b" } }],
      { legacy_key: "read-before-another-client-changed-it" },
    );
    expect(JSON.stringify(upstream)).not.toContain("legacy_key");
  });

  it("adds the settings object when the profile has none", () => {
    expect(
      mergeSettingsPatches(
        [{ op: "replace", path: "/settings", value: { default_job_folder: "/b" } }],
        undefined,
      ),
    ).toStrictEqual([
      { op: "add", path: "/settings", value: { default_job_folder: "/b" } },
    ]);
  });

  it.each([
    ["null", null],
    ["an array", ["a", "b"]],
    ["a string", "abc"],
  ])("replaces settings the profile stores as %s with the patch value alone", (_label, stored) => {
    expect(
      mergeSettingsPatches(
        [{ op: "replace", path: "/settings", value: { default_job_folder: "/b" } }],
        stored,
      ),
    ).toStrictEqual([
      { op: "replace", path: "/settings", value: { default_job_folder: "/b" } },
    ]);
  });

  it("passes other patches through untouched", () => {
    const patch = { op: "replace", path: "/email", value: "a@b.c" } as const;
    expect(mergeSettingsPatches([patch], undefined)).toStrictEqual([patch]);
  });
});
