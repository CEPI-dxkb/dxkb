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
import { requireCurrentUserOrRedirect } from "../page-auth";

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
      "NEXT_REDIRECT:/sign-in?redirect=%2Fservices%2Fblast%3Fquery%3Dalpha%2520beta%26filter%3Da%252Fb",
    );
  });

  it("uses the protected boundary fallback when no forwarded URL exists", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.headers.mockResolvedValue(requestHeaders());

    await expect(requireCurrentUserOrRedirect("/settings")).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in?redirect=%2Fsettings",
    );
  });

  it("rejects a forged external request destination", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.headers.mockResolvedValue(
      requestHeaders("//attacker.example/steal-session"),
    );

    await expect(requireCurrentUserOrRedirect("/jobs")).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in?redirect=%2Fjobs",
    );
  });
});
