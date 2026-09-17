const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requireAuthSessionOrRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/server/route", () => ({
  requireAuthSessionOrRedirect: mocks.requireAuthSessionOrRedirect,
}));

import WorkspaceHomeRedirect from "../home/[[...path]]/page";
import WorkspaceSharedRedirect from "../shared/[[...path]]/page";

const userId = "e2e-test-user@patricbrc.org";

/**
 * These two pages take a catch-all segment list and re-encode it into a
 * redirect target. A page component receives those segments already
 * percent-encoded (`getParamValue` maps `encodeURIComponent` over the array),
 * so re-encoding without reading them back produced a doubly encoded target
 * — and the destination page decodes exactly once, landing one level short.
 * The tests therefore feed the segments the way Next does, not the way a
 * human would type them.
 */
function pageParams(segments: string[]) {
  return {
    params: Promise.resolve({ path: segments.map(encodeURIComponent) }),
  };
}

async function redirectTargetOf(
  page: (props: { params: Promise<{ path?: string[] }> }) => Promise<unknown>,
  segments: string[],
): Promise<string> {
  try {
    await page(pageParams(segments));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace("NEXT_REDIRECT:", "");
  }
  throw new Error("expected the page to redirect");
}

describe("workspace catch-all redirects", () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
    mocks.requireAuthSessionOrRedirect.mockResolvedValue({ userId });
  });

  it.each([
    ["no segments", [], ""],
    ["a plain segment", ["reads"], "/reads"],
    ["a space", ["my folder"], "/my%20folder"],
    ["a slash inside one segment", ["a/b"], "/a%2Fb"],
    ["a literal percent", ["100%done"], "/100%25done"],
  ])(
    "home: encodes %s exactly once in the redirect target",
    async (_name, segments, expectedSuffix) => {
      await expect(
        redirectTargetOf(WorkspaceHomeRedirect, segments),
      ).resolves.toBe(
        `/workspace/e2e-test-user@patricbrc.org/home${expectedSuffix}`,
      );
    },
  );

  it.each([
    ["a space", ["my folder"], "/my%20folder"],
    ["a literal percent", ["100%done"], "/100%25done"],
  ])(
    "shared: encodes %s exactly once in the redirect target",
    async (_name, segments, expectedSuffix) => {
      await expect(
        redirectTargetOf(WorkspaceSharedRedirect, segments),
      ).resolves.toBe(
        `/workspace/e2e-test-user@patricbrc.org${expectedSuffix}`,
      );
    },
  );

  it("passes the singly encoded path to the auth redirect target too", async () => {
    // `requireAuthSessionOrRedirect` receives the path a signed-out visitor
    // is sent back to, so it has the same double-encoding exposure.
    await redirectTargetOf(WorkspaceHomeRedirect, ["my folder"]);

    expect(mocks.requireAuthSessionOrRedirect).toHaveBeenCalledWith(
      "/workspace/home/my%20folder",
    );
  });
});
