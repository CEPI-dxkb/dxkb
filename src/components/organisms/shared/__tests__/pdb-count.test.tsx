import { act, render, screen, within } from "@testing-library/react";
import { CountRetryScope } from "../count-retry-scope";
import { PdbStatTile } from "../pdb-count";
import type { CountResult } from "@/lib/services/organisms/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const fulfilled = (value: number) =>
  Promise.resolve<CountResult>({ status: "fulfilled", value });
const rejected = (message: string) =>
  Promise.resolve<CountResult>({ status: "rejected", reason: new Error(message) });

const href = "/taxonomy/234?tab=protein-structures&rql=ne(method,Predicted)";

// `use` retries after its promise settles, so a test renders inside an async act.
async function renderTile(pdb: Promise<CountResult>) {
  await act(async () => {
    render(
      <CountRetryScope taxonIds={[234]}>
        <PdbStatTile
          id="pdb"
          testId="taxon-stat-pdb"
          label="3D Protein Structures (PDB)"
          description="Experimentally determined structures"
          href={href}
          pdb={pdb}
          formatReason={(reason) =>
            `PDB structures: ${reason instanceof Error ? reason.message : "?"}`
          }
        />
      </CountRetryScope>,
    );
    await Promise.resolve();
  });
  return screen.getByTestId("taxon-stat-pdb");
}

describe("PdbStatTile", () => {
  it("shows a loading skeleton in the linked tile, not a number, until the count settles", async () => {
    const tile = await renderTile(new Promise(() => undefined));

    expect(within(tile).getByText("Loading")).toBeInTheDocument();
    expect(tile.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(within(tile).getByRole("link")).toHaveAttribute("href", href);
    expect(within(tile).queryByText("Unavailable")).toBeNull();
  });

  it("shows the formatted count in the linked tile once it loads", async () => {
    const tile = await renderTile(fulfilled(1234));

    expect(within(tile).getByRole("link")).toHaveTextContent("1,234");
    expect(within(tile).getByRole("link")).toHaveAccessibleDescription(
      "Experimentally determined structures",
    );
    expect(within(tile).getByRole("link")).toHaveAttribute("href", href);
    expect(within(tile).queryByText("Loading")).toBeNull();
  });

  it("shows an unlinked tile with a retrying Unavailable, never a number, when the count failed", async () => {
    const tile = await renderTile(rejected("join timed out"));

    const button = within(tile).getByRole("button", { name: /^Unavailable$/ });
    expect(button).toHaveAccessibleDescription(
      "Click to retry. PDB structures: join timed out",
    );
    expect(tile.querySelector("[title]")).toBeNull();
    // The tile's own description (its tooltip and sr-only text) gives the reason.
    expect(
      within(tile).getByText(
        "Experimentally determined structures. Could not load: PDB structures: join timed out. Click Unavailable to retry.",
      ),
    ).toHaveClass("sr-only");
    expect(within(tile).queryByRole("link")).toBeNull();
    expect(within(tile).getByText("3D Protein Structures (PDB)")).toBeInTheDocument();
    expect(within(tile).queryByText("0")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});
