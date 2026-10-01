import { redirect } from "next/navigation";
import { requireCurrentUserOrRedirect } from "@/lib/auth/server/page-auth";
import type { AuthUser } from "@/lib/auth/types";
import WorkspacePage from "../page";
import WorkspaceHomePage from "../[username]/home/[[...path]]/page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));
vi.mock("@/lib/auth/server/page-auth", () => ({
  requireCurrentUserOrRedirect: vi.fn(),
}));
vi.mock("@/components/workspace/workspace-browser", () => ({
  WorkspaceBrowser: () => null,
}));

/**
 * The profile's login name (`l_id`) can differ from its canonical `id`. The
 * workspace is provisioned and owned under `id@realm`, matching the session
 * user id the `/workspace/home` and `/workspace/shared` shortcuts redirect
 * with, so these pages must not send the user to `l_id@realm`.
 */
const user: AuthUser = {
  id: "Clark.Cucinell",
  username: "clark.cucinell",
  email: "clark@example.org",
  realm: "patricbrc.org",
};

async function redirectTargetOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace("NEXT_REDIRECT:", "");
  }
  throw new Error("expected the page to redirect");
}

describe("workspace owner redirects", () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
    vi.mocked(requireCurrentUserOrRedirect).mockResolvedValue(user);
  });

  it("/workspace redirects to the canonical id@realm", async () => {
    await expect(redirectTargetOf(() => WorkspacePage())).resolves.toBe(
      "/workspace/Clark.Cucinell@patricbrc.org/home",
    );
  });

  it.each([
    ["login name", "clark.cucinell"],
    ["canonical id", "Clark.Cucinell"],
  ])(
    "[username]/home sends the bare %s to the canonical id@realm",
    async (_name, username) => {
      await expect(
        redirectTargetOf(() =>
          WorkspaceHomePage({
            params: Promise.resolve({ username, path: ["reads"] }),
          }),
        ),
      ).resolves.toBe("/workspace/Clark.Cucinell@patricbrc.org/home/reads");
    },
  );
});
