import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockSignOut } = vi.hoisted(() => ({ mockSignOut: vi.fn() }));

vi.mock("@/app/(auth)/redirect-action", () => ({
  signOutAndRedirect: mockSignOut,
}));

import * as accountCaches from "@/lib/account-caches";
import { SignoutButton } from "../signout-button";

function renderSignoutButton(props: { confirmDialog: boolean }) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(["private"], { secret: true });
  render(
    <QueryClientProvider client={queryClient}>
      <SignoutButton {...props} />
    </QueryClientProvider>,
  );
  return queryClient;
}

describe("SignoutButton", () => {
  it.each([
    { name: "without a confirmation dialog", confirmDialog: false },
    { name: "after confirming the dialog", confirmDialog: true },
  ])(
    "clears the query cache and the account caches $name",
    async ({ confirmDialog }) => {
      const accountCachesSpy = vi.spyOn(accountCaches, "clearAccountCaches");
      const queryClient = renderSignoutButton({ confirmDialog });
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: "Sign Out" }));
      if (confirmDialog) {
        await user.click(
          within(await screen.findByRole("alertdialog")).getByRole("button", {
            name: "Sign Out",
          }),
        );
      }

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
      expect(queryClient.getQueryData(["private"])).toBeUndefined();
      // Module-level caches (the Genome Browser's) outlive queryClient.clear().
      expect(accountCachesSpy).toHaveBeenCalledOnce();
    },
  );
});
