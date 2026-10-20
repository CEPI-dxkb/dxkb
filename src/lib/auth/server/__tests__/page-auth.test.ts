const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("../actions", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { protectedPageRequestHeader } from "../../routes";
import {
  redirectSignedInUser,
  requireCurrentUserOrRedirect,
} from "../page-auth";

function requestHeaders(path?: string): Headers {
  const headers = new Headers();
  if (path) headers.set(protectedPageRequestHeader, path);
  return headers;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireCurrentUserOrRedirect", () => {
  it("returns the authenticated user", async () => {
    const user = {
      id: "alice",
      username: "alice",
      email: "alice@example.test",
    };
    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.headers.mockResolvedValue(requestHeaders("/jobs?page=2"));

    await expect(requireCurrentUserOrRedirect("/jobs")).resolves.toBe(user);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects direct navigation with the complete server-visible URL", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.headers.mockResolvedValue(
      requestHeaders("/services/blast?query=alpha%20beta&filter=a%2Fb"),
    );

    await expect(requireCurrentUserOrRedirect("/services")).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in?redirect=/services/blast?query%3Dalpha%2520beta%26filter%3Da%252Fb",
    );
  });

  it("uses the protected boundary fallback when no forwarded URL exists", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.headers.mockResolvedValue(requestHeaders());

    await expect(requireCurrentUserOrRedirect("/settings")).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in?redirect=/settings",
    );
  });

  it("rejects a forged external request destination", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.headers.mockResolvedValue(
      requestHeaders("//attacker.example/steal-session"),
    );

    await expect(requireCurrentUserOrRedirect("/jobs")).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in?redirect=/jobs",
    );
  });

  it("renders the page for a session the profile service could not verify", async () => {
    const user = {
      id: "alice",
      username: "alice",
      email: "",
      sessionUnverified: true,
    };
    mocks.getCurrentUser.mockResolvedValue(user);

    await expect(requireCurrentUserOrRedirect("/jobs")).resolves.toBe(user);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("redirectSignedInUser", () => {
  const user = { id: "alice", username: "alice", email: "" };

  it("lets a signed-out visitor stay on the auth page", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(redirectSignedInUser("/jobs")).resolves.toBeUndefined();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns a signed-in user to the page they were sent from", async () => {
    mocks.getCurrentUser.mockResolvedValue(user);

    await expect(redirectSignedInUser("/jobs?page=2")).rejects.toThrow(
      "NEXT_REDIRECT:/jobs?page=2",
    );
  });

  it.each([
    ["no destination", undefined],
    ["a repeated parameter", ["/jobs", "/workspace"]],
    ["an external destination", "//attacker.example/steal-session"],
    ["an absolute URL", "https://attacker.example/"],
  ])("sends a signed-in user home for %s", async (_name, destination) => {
    mocks.getCurrentUser.mockResolvedValue(user);

    await expect(redirectSignedInUser(destination)).rejects.toThrow(
      /^NEXT_REDIRECT:\/$/,
    );
  });
});
