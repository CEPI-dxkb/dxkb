import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { startNativeDownload } from "@/lib/data-api/download-transport";
import type { DownloadRequest } from "@/lib/data-api/downloads";
import { downloadBlob } from "@/lib/utils";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { useCollectionDownload } from "../use-collection-download";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils")>()),
  downloadBlob: vi.fn(),
}));
// The form POST itself is `download-transport.test.ts`'s; here only the
// choice of path matters, and jsdom cannot navigate a form anyway.
vi.mock("@/lib/data-api/download-transport", () => ({
  startNativeDownload: vi.fn(() => Promise.resolve()),
}));

const downloadRoute = "*/api/data/genome/download";
// A feature's own sequences are small, so they stay on the buffered path.
const featureDownloadRoute = "*/api/data/genome_feature/download";

const selection: DownloadRequest = {
  format: "csv",
  scope: { kind: "selected", ids: ["1.1"] },
  fileNameBase: "genome-selected",
  total: 1,
};

const query = (total: number): DownloadRequest => ({
  format: "tsv",
  scope: { kind: "query", rql: "eq(genome_status,Complete)" },
  fileNameBase: "genome",
  total,
});

function renderDownload() {
  return renderHook(() => useCollectionDownload(), {
    wrapper: createQueryClientWrapper(),
  });
}

beforeEach(() => {
  vi.mocked(toast.error).mockClear();
  vi.mocked(downloadBlob).mockClear();
  vi.mocked(startNativeDownload).mockClear();
});

describe("useCollectionDownload", () => {
  it("fetches a selection through the gateway and saves it under its file name", async () => {
    server.use(
      http.post(downloadRoute, () =>
        new Response("a,b\n", { headers: { "Content-Type": "text/csv" } }),
      ),
    );
    const { result } = renderDownload();
    const onSuccess = vi.fn();

    act(() => {
      result.current.download("genome", selection, { onSuccess });
    });

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledTimes(1);
    });
    const [blob, fileName] = vi.mocked(downloadBlob).mock.calls[0];
    expect(fileName).toBe("genome-selected.csv");
    await expect(blob.text()).resolves.toBe("a,b\n");
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(startNativeDownload).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("buffers a query of at most 10,000 rows and streams a larger one to disk", async () => {
    server.use(http.post(downloadRoute, () => new Response("a\tb\n")));
    const { result } = renderDownload();

    act(() => {
      result.current.download("genome", query(10_000));
    });
    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledTimes(1);
    });
    expect(startNativeDownload).not.toHaveBeenCalled();

    act(() => {
      result.current.download("genome", query(10_001));
    });
    await waitFor(() => {
      expect(startNativeDownload).toHaveBeenCalledWith("genome", query(10_001));
    });
    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });

  it("streams a genome selection's contigs to disk, however few rows it names", async () => {
    const contigs: DownloadRequest = {
      ...selection,
      format: "dna-fasta",
    };
    const { result } = renderDownload();

    act(() => {
      result.current.download("genome", contigs);
    });

    await waitFor(() => {
      expect(startNativeDownload).toHaveBeenCalledWith("genome", contigs);
    });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("reports which format is in flight, and clears it when done", async () => {
    // Made before the request, so releasing it never depends on the handler
    // having started.
    const gate = Promise.withResolvers<undefined>();
    server.use(
      http.post(featureDownloadRoute, async () => {
        await gate.promise;
        return new Response(">a\nACGT\n");
      }),
    );
    const { result } = renderDownload();
    expect(result.current.pending).toBeNull();

    act(() => {
      result.current.download("genome_feature", {
        ...selection,
        format: "dna-fasta",
      });
    });

    await waitFor(() => {
      expect(result.current.pending).toBe("dna-fasta");
    });
    gate.resolve(undefined);
    await waitFor(() => {
      expect(result.current.pending).toBeNull();
    });
  });

  it("toasts the gateway's own message", async () => {
    server.use(
      http.post(downloadRoute, () =>
        HttpResponse.json(
          { error: "Selections: 10,000 rows at most.", code: "invalid_request" },
          { status: 400 },
        ),
      ),
    );
    const { result } = renderDownload();

    act(() => {
      result.current.download("genome", selection);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Selections: 10,000 rows at most.",
      );
    });
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("toasts a native download's failure in its own words", async () => {
    vi.mocked(startNativeDownload).mockRejectedValueOnce(
      new Error("Over 2,500,000 rows: narrow the filters."),
    );
    const { result } = renderDownload();

    act(() => {
      result.current.download("genome", query(3_000_000));
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Over 2,500,000 rows: narrow the filters.",
      );
    });
  });

  it("treats an empty file as a failure instead of saving it", async () => {
    server.use(http.post(featureDownloadRoute, () => new Response("")));
    const { result } = renderDownload();

    act(() => {
      result.current.download("genome_feature", {
        ...selection,
        format: "dna-fasta",
      });
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "No DNA sequence is available for the requested records.",
      );
    });
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
