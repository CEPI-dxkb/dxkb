import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/utils";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { useFastaDownload } from "../use-fasta-download";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils")>()),
  downloadBlob: vi.fn(),
}));

const fastaRoute = "*/api/data/genome_feature/fasta";

function renderDownload() {
  return renderHook(() => useFastaDownload(), {
    wrapper: createQueryClientWrapper(),
  });
}

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(downloadBlob).mockClear();
});

describe("useFastaDownload", () => {
  it("saves the sequences under a safe, typed file name", async () => {
    server.use(http.post(fastaRoute, () => new Response(">a\nMNEA\n")));
    const { result } = renderDownload();

    act(() => {
      result.current.download({
        resource: "genome_feature",
        type: "protein",
        ids: ["PATRIC.1"],
        fileNameBase: "fig|644340.17.peg.16",
      });
    });

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledTimes(1);
    });
    const [blob, fileName] = vi.mocked(downloadBlob).mock.calls[0];
    expect(fileName).toBe("fig_644340.17.peg.16.protein.fasta");
    await expect(blob.text()).resolves.toBe(">a\nMNEA\n");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("reports which sequence type is in flight, and clears it when done", async () => {
    let release: () => void = () => undefined;
    server.use(
      http.post(fastaRoute, async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return new Response(">a\nACGT\n");
      }),
    );
    const { result } = renderDownload();
    expect(result.current.pendingType).toBeUndefined();

    act(() => {
      result.current.download({
        resource: "genome_feature",
        type: "dna",
        ids: ["PATRIC.1"],
        fileNameBase: "fig|1.1.peg.1",
      });
    });

    await waitFor(() => {
      expect(result.current.pendingType).toBe("dna");
    });
    release();
    await waitFor(() => {
      expect(result.current.pendingType).toBeUndefined();
    });
  });

  it("treats an empty result as a failure instead of saving a zero-byte file", async () => {
    server.use(http.post(fastaRoute, () => new Response("")));
    const { result } = renderDownload();

    act(() => {
      result.current.download({
        resource: "genome_feature",
        type: "protein",
        ids: ["PATRIC.rna"],
        fileNameBase: "fig|1.1.rna.1",
      });
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "No protein sequence is available for the requested records.",
      );
    });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("toasts the server's own message, not a generic one", async () => {
    server.use(
      http.post(fastaRoute, () =>
        HttpResponse.json(
          {
            error: "The data service is temporarily unavailable. Please try again.",
            code: "service_unavailable",
          },
          { status: 503 },
        ),
      ),
    );
    const { result } = renderDownload();

    act(() => {
      result.current.download({
        resource: "genome_feature",
        type: "dna",
        ids: ["PATRIC.1"],
        fileNameBase: "fig|1.1.peg.1",
      });
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "The data service is temporarily unavailable. Please try again.",
      );
    });
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
