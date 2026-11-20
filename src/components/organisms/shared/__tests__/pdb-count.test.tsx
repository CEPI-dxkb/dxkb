import { act, render, screen } from "@testing-library/react";
import { PdbCountAlert, PdbCountValue } from "../pdb-count";
import type { CountResult } from "@/lib/services/organisms/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const fulfilled = (value: number) =>
  Promise.resolve<CountResult>({ status: "fulfilled", value });
const rejected = (message: string) =>
  Promise.resolve<CountResult>({ status: "rejected", reason: new Error(message) });

// `use` retries after its promise settles, so a test renders inside an async act.
async function renderAsync(node: React.ReactElement) {
  await act(async () => {
    render(node);
    await Promise.resolve();
  });
}

describe("PdbCountValue", () => {
  it("shows a loading skeleton, not a number, until the count settles", async () => {
    await renderAsync(<PdbCountValue pdb={new Promise(() => undefined)} />);

    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(screen.queryByText("Unavailable")).toBeNull();
  });

  it("shows the formatted count once it loads", async () => {
    await renderAsync(<PdbCountValue pdb={fulfilled(1234)} />);

    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.queryByText("Loading")).toBeNull();
  });

  it("shows Unavailable, never a number, when the count failed", async () => {
    await renderAsync(<PdbCountValue pdb={rejected("join timed out")} />);

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("0")).toBeNull();
  });
});

describe("PdbCountAlert", () => {
  const props = {
    lead: "Some counts could not be loaded",
    formatReason: (reason: unknown) =>
      `PDB structures: ${reason instanceof Error ? reason.message : "?"}`,
  };

  it("renders nothing while the count is pending or when it loaded", async () => {
    await renderAsync(
      <>
        <PdbCountAlert pdb={new Promise(() => undefined)} {...props} />
        <PdbCountAlert pdb={fulfilled(3)} {...props} />
      </>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says why the count failed, with a Retry", async () => {
    await renderAsync(<PdbCountAlert pdb={rejected("join timed out")} {...props} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Some counts could not be loaded: PDB structures: join timed out",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
