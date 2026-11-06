import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  setTestSession,
  testCookieStore,
} from "@/test-helpers/api-route-helpers";
import {
  exitImpersonation,
  getCurrentUser,
  signIn,
  signOut,
  startImpersonation,
  verifyEmailToken,
} from "../actions";
import { forgetProfile } from "../profile-cache";

// React's `cache()` memoizes only inside a server render; outside one (as here)
// every `getCurrentUser()` call runs `readCurrentUser` again, so two calls stand
// in for two requests and any reuse comes from the cross-request profile cache.

const userUrl = "http://mock-user-url";
const userAuthUrl = "http://mock-user-auth-url";
const userVerificationUrl = "http://mock-user-verification-url";
const aliceToken = "un=alice@patricbrc.org|alice-sig";
const bobToken = "un=bob@patricbrc.org|bob-sig";

const baseProfile = {
  email_verified: true,
  last_name: "User",
  creation_date: "",
  last_login: "",
  organisms: "",
  reverification: false,
  source: "test",
};
const aliceProfile = {
  ...baseProfile,
  id: "alice@patricbrc.org",
  l_id: "alice",
  email: "alice@example.com",
  first_name: "Alice",
  roles: ["admin"],
};
const bobProfile = {
  ...baseProfile,
  id: "bob@patricbrc.org",
  l_id: "bob",
  email: "bob@example.com",
  first_name: "Bob",
  roles: [],
};

/** User ids of every profile request the user service received. */
let profileRequests: string[];

function profileFor(userId: string, token: string | null) {
  if (
    token === aliceToken &&
    (userId === aliceProfile.id || userId === "alice")
  ) {
    return aliceProfile;
  }
  if (token === bobToken && (userId === bobProfile.id || userId === "bob")) {
    return bobProfile;
  }
  return null;
}

/** Answers profile lookups; `failFirst` answers the first one with that status. */
function serveProfiles(failFirst?: number): void {
  server.use(
    http.get(`${userUrl}/:userId`, ({ params, request }) => {
      const userId = String(params.userId);
      profileRequests.push(userId);
      if (failFirst !== undefined && profileRequests.length === 1) {
        return new HttpResponse(null, { status: failFirst });
      }
      const profile = profileFor(userId, request.headers.get("Authorization"));
      return profile
        ? HttpResponse.json(profile)
        : new HttpResponse(null, { status: 401 });
    }),
  );
}

function signInAsAlice(): void {
  setTestSession({
    token: aliceToken,
    userId: aliceProfile.id,
    realm: "patricbrc.org",
  });
}

beforeEach(() => {
  process.env.USER_URL = userUrl;
  process.env.USER_AUTH_URL = userAuthUrl;
  process.env.USER_VERIFICATION_URL = userVerificationUrl;
  profileRequests = [];
});

afterEach(() => {
  delete process.env.USER_URL;
  delete process.env.USER_AUTH_URL;
  delete process.env.USER_VERIFICATION_URL;
});

describe("getCurrentUser across requests", () => {
  it("answers a second lookup for the same session without the user service", async () => {
    serveProfiles();
    signInAsAlice();

    const first = await getCurrentUser();
    const second = await getCurrentUser();

    expect(first).toMatchObject({ id: aliceProfile.id, username: "alice" });
    expect(second).toEqual(first);
    expect(profileRequests).toEqual([aliceProfile.id]);
  });

  it("keeps the impersonation markers on a cached answer", async () => {
    serveProfiles();
    signInAsAlice();
    testCookieStore.set("bvbrc_su_original_token", "un=admin@bvbrc|sig");
    testCookieStore.set("bvbrc_su_original_user_id", "admin@bvbrc");

    await getCurrentUser();
    await expect(getCurrentUser()).resolves.toMatchObject({
      id: aliceProfile.id,
      isImpersonating: true,
      originalUsername: "admin@bvbrc",
    });
    expect(profileRequests).toHaveLength(1);
  });

  it.each([
    {
      status: 503,
      firstAnswer: expect.objectContaining({
        sessionUnverified: true,
      }) as unknown,
    },
    { status: 401, firstAnswer: null },
  ])(
    "does not cache a failed lookup (HTTP $status)",
    async ({ status, firstAnswer }) => {
      serveProfiles(status);
      signInAsAlice();

      await expect(getCurrentUser()).resolves.toEqual(firstAnswer);
      await expect(getCurrentUser()).resolves.toMatchObject({
        id: aliceProfile.id,
        email: aliceProfile.email,
      });
      expect(profileRequests).toHaveLength(2);
    },
  );

  it("does not store an answer whose token was forgotten while it was in flight", async () => {
    const requestArrived = Promise.withResolvers<undefined>();
    const releaseAnswer = Promise.withResolvers<undefined>();
    server.use(
      http.get(`${userUrl}/:userId`, async ({ params }) => {
        profileRequests.push(String(params.userId));
        if (profileRequests.length === 1) {
          requestArrived.resolve(undefined);
          await releaseAnswer.promise;
        }
        return HttpResponse.json(aliceProfile);
      }),
    );
    signInAsAlice();

    const pending = getCurrentUser();
    await requestArrived.promise;
    // A sign-out or profile save handled by another request meanwhile.
    forgetProfile(aliceToken);
    releaseAnswer.resolve(undefined);
    await expect(pending).resolves.toMatchObject({ id: aliceProfile.id });

    await getCurrentUser();
    expect(profileRequests).toHaveLength(2);
    // The lookup after the forget is stored as usual.
    await getCurrentUser();
    expect(profileRequests).toHaveLength(2);
  });

  it("asks the user service again after the email is verified", async () => {
    let emailVerified = false;
    server.use(
      http.get(`${userUrl}/:userId`, ({ params }) => {
        profileRequests.push(String(params.userId));
        return HttpResponse.json({
          ...aliceProfile,
          email_verified: emailVerified,
        });
      }),
      http.post(userVerificationUrl, () => {
        emailVerified = true;
        return HttpResponse.json({ success: true });
      }),
    );
    signInAsAlice();
    await expect(getCurrentUser()).resolves.toMatchObject({
      email_verified: false,
    });

    await expect(verifyEmailToken("email-token", "alice")).resolves.toEqual({
      data: undefined,
      error: null,
    });

    await expect(getCurrentUser()).resolves.toMatchObject({
      email_verified: true,
    });
    expect(profileRequests).toHaveLength(2);
  });

  it("asks the user service again after sign-out", async () => {
    serveProfiles();
    signInAsAlice();
    await getCurrentUser();

    await signOut();
    await expect(getCurrentUser()).resolves.toBeNull();
    // A copy of the cleared cookie presented again is not answered from cache.
    signInAsAlice();
    await getCurrentUser();

    expect(profileRequests).toHaveLength(2);
  });

  it("seeds the cache with the profile sign-in fetched", async () => {
    serveProfiles();
    server.use(
      http.post(
        userAuthUrl,
        () =>
          new HttpResponse(aliceToken, {
            headers: { Authorization: aliceToken },
          }),
      ),
    );

    await expect(
      signIn({ username: "alice", password: "pw" }),
    ).resolves.toMatchObject({ error: null });
    expect(profileRequests).toEqual(["alice"]);

    await expect(getCurrentUser()).resolves.toMatchObject({
      id: aliceProfile.id,
      username: "alice",
    });
    expect(profileRequests).toEqual(["alice"]);
  });

  it("seeds the impersonated profile, then the restored one", async () => {
    serveProfiles();
    server.use(
      http.post(`${userAuthUrl}/sulogin`, () => new HttpResponse(bobToken)),
    );
    signInAsAlice();

    await expect(startImpersonation("bob", "pw")).resolves.toMatchObject({
      error: null,
    });
    // The admin check, then the target's profile.
    expect(profileRequests).toEqual([aliceProfile.id, "bob"]);
    await expect(getCurrentUser()).resolves.toMatchObject({
      id: bobProfile.id,
      isImpersonating: true,
      originalUsername: aliceProfile.id,
    });
    expect(profileRequests).toHaveLength(2);

    await expect(exitImpersonation()).resolves.toMatchObject({ error: null });
    expect(profileRequests).toHaveLength(3);
    const restored = await getCurrentUser();
    expect(restored).toMatchObject({ id: aliceProfile.id });
    expect(restored).not.toHaveProperty("isImpersonating");
    expect(profileRequests).toHaveLength(3);
  });
});
