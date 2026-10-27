import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { setTestSession } from "@/test-helpers/api-route-helpers";
import SigninPage from "../sign-in/page";
import SignupPage from "../sign-up/page";
import ForgotPasswordPage from "../forgot-password/page";

const userUrl = "http://mock-user-url";

const validProfile = {
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

function signedInProfile(status = 200) {
  setTestSession({ token: "tok", userId: "alice@patricbrc.org" });
  server.use(
    http.get(`${userUrl}/:userId`, () =>
      status === 200
        ? HttpResponse.json(validProfile)
        : new HttpResponse(null, { status }),
    ),
  );
}

beforeEach(() => {
  process.env.USER_URL = userUrl;
});

afterEach(() => {
  delete process.env.USER_URL;
});

describe("auth pages for a signed-in user", () => {
  it.each([
    ["sign-in", SigninPage],
    ["sign-up", SignupPage],
  ])("%s returns the user to its ?redirect= destination", async (_name, Page) => {
    signedInProfile();

    await expect(
      Page({ searchParams: Promise.resolve({ redirect: "/jobs?page=2" }) }),
    ).rejects.toThrow("NEXT_REDIRECT: /jobs?page=2");
  });

  it("returns a session kept through a profile outage to its destination", async () => {
    signedInProfile(503);

    await expect(
      SigninPage({ searchParams: Promise.resolve({ redirect: "/workspace" }) }),
    ).rejects.toThrow("NEXT_REDIRECT: /workspace");
  });

  it("never follows an external ?redirect=", async () => {
    signedInProfile();

    await expect(
      SigninPage({
        searchParams: Promise.resolve({ redirect: "//attacker.example" }),
      }),
    ).rejects.toThrow(/^NEXT_REDIRECT: \/$/);
  });

  it("sends a signed-in user home from forgot-password", async () => {
    signedInProfile();

    await expect(ForgotPasswordPage()).rejects.toThrow(/^NEXT_REDIRECT: \/$/);
  });

  it("renders sign-in for a rejected session", async () => {
    signedInProfile(401);

    await expect(
      SigninPage({ searchParams: Promise.resolve({ redirect: "/jobs" }) }),
    ).resolves.toBeTruthy();
  });
});
