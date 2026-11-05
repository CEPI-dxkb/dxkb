import type { UserProfile } from "@/lib/auth/types";
import {
  forgetProfile,
  profileGeneration,
  readCachedProfile,
  rememberProfile,
} from "../profile-cache";

const profile: UserProfile = {
  id: "alice@patricbrc.org",
  l_id: "alice",
  email: "alice@example.com",
  email_verified: true,
  first_name: "Alice",
  last_name: "User",
  creation_date: "",
  last_login: "",
  organisms: "",
  reverification: false,
  source: "test",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("profile cache", () => {
  it("answers a remembered profile for the same user id and token", () => {
    rememberProfile("alice@patricbrc.org", "token-a", profile);

    expect(readCachedProfile("alice@patricbrc.org", "token-a")).toEqual(
      profile,
    );
  });

  it("misses for another token", () => {
    rememberProfile("alice@patricbrc.org", "token-a", profile);

    expect(readCachedProfile("alice@patricbrc.org", "token-b")).toBeUndefined();
  });

  it("misses when the session claims another user id with the same token", () => {
    rememberProfile("alice@patricbrc.org", "token-a", profile);

    expect(
      readCachedProfile("mallory@patricbrc.org", "token-a"),
    ).toBeUndefined();
    // The stored entry is untouched by the mismatched read.
    expect(readCachedProfile("alice@patricbrc.org", "token-a")).toEqual(
      profile,
    );
  });

  it("expires an entry after 30 seconds", () => {
    vi.useFakeTimers({ now: 0, toFake: ["Date"] });
    rememberProfile("alice@patricbrc.org", "token-a", profile);

    vi.setSystemTime(29_999);
    expect(readCachedProfile("alice@patricbrc.org", "token-a")).toEqual(
      profile,
    );
    vi.setSystemTime(30_000);
    expect(readCachedProfile("alice@patricbrc.org", "token-a")).toBeUndefined();
  });

  it("forgets one token's entry and keeps the others", () => {
    rememberProfile("alice@patricbrc.org", "token-a", profile);
    rememberProfile("alice@patricbrc.org", "token-b", profile);

    forgetProfile("token-a");

    expect(readCachedProfile("alice@patricbrc.org", "token-a")).toBeUndefined();
    expect(readCachedProfile("alice@patricbrc.org", "token-b")).toEqual(
      profile,
    );
  });

  it("skips a write whose token was forgotten after its generation was taken", () => {
    const generation = profileGeneration("token-a");
    forgetProfile("token-a");

    rememberProfile("alice@patricbrc.org", "token-a", profile, generation);
    expect(readCachedProfile("alice@patricbrc.org", "token-a")).toBeUndefined();

    rememberProfile(
      "alice@patricbrc.org",
      "token-a",
      profile,
      profileGeneration("token-a"),
    );
    expect(readCachedProfile("alice@patricbrc.org", "token-a")).toEqual(
      profile,
    );
  });

  it("skips a stale write even when the generation it took expired and was re-created", () => {
    vi.useFakeTimers({ now: 0, toFake: ["Date"] });
    forgetProfile("token-a");
    vi.setSystemTime(28_000);
    // Taken from the first forget's record, which expires at 30 s.
    const generation = profileGeneration("token-a");
    vi.setSystemTime(30_500);
    // A sign-out or save while the lookup is in flight re-creates the record.
    forgetProfile("token-a");
    vi.setSystemTime(31_000);

    rememberProfile("alice@patricbrc.org", "token-a", profile, generation);
    expect(readCachedProfile("alice@patricbrc.org", "token-a")).toBeUndefined();
  });

  it("keeps a write whose generation only another token's forget changed", () => {
    const generation = profileGeneration("token-a");
    forgetProfile("token-b");

    rememberProfile("alice@patricbrc.org", "token-a", profile, generation);
    expect(readCachedProfile("alice@patricbrc.org", "token-a")).toEqual(
      profile,
    );
  });

  it("stores a frozen copy, so an in-place change fails instead of leaking", () => {
    const original = { ...profile };
    rememberProfile("alice@patricbrc.org", "token-a", original);
    const cached = readCachedProfile("alice@patricbrc.org", "token-a");

    expect(cached).toEqual(profile);
    expect(Object.isFrozen(cached)).toBe(true);
    expect(Object.isFrozen(original)).toBe(false);
    expect(() =>
      Object.assign(cached ?? {}, { first_name: "Mallory" }),
    ).toThrow(TypeError);
  });

  it("is shared by every copy of the module, as Next loads one per server runtime", async () => {
    vi.resetModules();
    const otherCopy = await import("../profile-cache");
    expect(otherCopy.rememberProfile).not.toBe(rememberProfile);

    otherCopy.rememberProfile("alice@patricbrc.org", "token-a", profile);
    expect(readCachedProfile("alice@patricbrc.org", "token-a")).toEqual(
      profile,
    );

    forgetProfile("token-a");
    expect(
      otherCopy.readCachedProfile("alice@patricbrc.org", "token-a"),
    ).toBeUndefined();
  });
});
