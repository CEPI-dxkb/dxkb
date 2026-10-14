import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { downloadBlob } from "@/lib/utils";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { FastaDownloadButtons } from "../fasta-download-buttons";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils")>()),
  downloadBlob: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(downloadBlob).mockClear();
});

describe("FastaDownloadButtons", () => {
  it("offers one download per requested sequence type, in order", () => {
    render(
      <FastaDownloadButtons
        resource="genome_feature"
        ids={["PATRIC.1"]}
        types={["dna", "protein"]}
        fileNameBase="fig|1.1.peg.1"
      />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["DNA FASTA", "Protein FASTA"]);
  });

  it("renders nothing without records to download", () => {
    const { container } = render(
      <FastaDownloadButtons
        resource="genome_sequence"
        ids={[]}
        types={["dna"]}
        fileNameBase="contigs"
      />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("downloads the clicked type and holds every button until it finishes", async () => {
    const user = userEvent.setup();
    const requested: unknown[] = [];
    let release: () => void = () => undefined;
    server.use(
      http.post("*/api/data/genome_feature/fasta", async ({ request }) => {
        requested.push(await request.json());
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return new Response(">a\nMNEA\n");
      }),
    );
    render(
      <FastaDownloadButtons
        resource="genome_feature"
        ids={["PATRIC.1"]}
        types={["dna", "protein"]}
        fileNameBase="fig|1.1.peg.1"
      />,
      { wrapper: createQueryClientWrapper() },
    );

    await user.click(screen.getByRole("button", { name: "Protein FASTA" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Protein FASTA/ })).toHaveAttribute(
        "aria-busy",
        "true",
      );
    });
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    // The button turns busy before the handler has read the body; once it has,
    // `release` is the handler's own.
    await waitFor(() => {
      expect(requested).toEqual([{ type: "protein", ids: ["PATRIC.1"] }]);
    });

    release();
    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        "fig_1.1.peg.1.protein.fasta",
      );
    });
    await waitFor(() => {
      for (const button of screen.getAllByRole("button")) {
        expect(button).toBeEnabled();
      }
    });
  });
});
