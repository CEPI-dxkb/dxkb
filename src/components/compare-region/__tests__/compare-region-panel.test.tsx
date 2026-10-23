import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { focusRow, mirroredRow } from "@/test-helpers/compare-region";
import { CompareRegionPanel } from "../compare-region-panel";

const search = vi.hoisted(() => ({ value: "" }));
const download = vi.hoisted(() => ({
  blob: vi.fn<(blob: Blob, fileName: string) => void>(),
}));

vi.mock("@/components/views/tab-content-search-params", () => ({
  useTabContentSearchParams: () => new URLSearchParams(search.value),
}));
// jsdom has no ResizeObserver and no layout: give the chart a fixed width.
vi.mock("@visx/responsive", () => ({
  useParentSize: () => ({ parentRef: { current: null }, width: 900, height: 0 }),
}));
vi.mock("@/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils")>()),
  downloadBlob: download.blob,
}));

function answer(body: JsonBodyType, status = 200) {
  const seen: URLSearchParams[] = [];
  server.use(
    http.get("/api/compare-region", ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return HttpResponse.json(body, { status });
    }),
  );
  return seen;
}

function renderPanel() {
  return render(<CompareRegionPanel patricId="fig|1.1.peg.2" />, {
    wrapper: createQueryClientWrapper(),
  });
}

beforeEach(() => {
  search.value = "";
  download.blob.mockReset();
});

describe("CompareRegionPanel", () => {
  it("compares the focus gene with the default settings", async () => {
    const seen = answer({ rows: [focusRow, mirroredRow] });
    renderPanel();

    expect(
      await screen.findByRole("img", { name: "Compared regions of 2 genomes" }),
    ).toBeInTheDocument();
    expect(Object.fromEntries(seen.at(0) ?? [])).toEqual({
      peg: "fig|1.1.peg.2",
      size: "10000",
      genomes: "10",
      method: "pgfam",
      filter: "reference",
    });
  });

  it("re-joins the request in flight when the tab comes back", async () => {
    let calls = 0;
    // The service answers only once the tab is back.
    const serviceAnswers = Promise.withResolvers<undefined>();
    server.use(
      http.get("/api/compare-region", async () => {
        calls += 1;
        await serviceAnswers.promise;
        return HttpResponse.json({ rows: [focusRow] });
      }),
    );
    // One query client for both mounts, as on a tab switch.
    const wrapper = createQueryClientWrapper();
    const panel = <CompareRegionPanel patricId="fig|1.1.peg.2" />;
    const first = render(panel, { wrapper });
    await waitFor(() => {
      expect(calls).toBe(1);
    });

    first.unmount();
    render(panel, { wrapper });
    serviceAnswers.resolve(undefined);

    expect(await screen.findByRole("img")).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it("says what it is doing while the service works", () => {
    answer({ rows: [focusRow] });
    renderPanel();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Comparing regions across 10 genomes",
    );
  });

  it("sends the settings the URL carries", async () => {
    search.value = "tab=compare-region&compare.genomes=20&compare.method=plfam";
    const seen = answer({ rows: [focusRow] });
    renderPanel();

    await screen.findByRole("img");
    expect(seen.at(0)?.get("genomes")).toBe("20");
    expect(seen.at(0)?.get("method")).toBe("plfam");
  });

  it("applies changed settings on Update only", async () => {
    const user = userEvent.setup();
    answer({ rows: [focusRow] });
    window.history.replaceState(null, "", "/feature/PATRIC.1?tab=compare-region");
    const replace = vi.spyOn(window.history, "replaceState");
    renderPanel();
    await screen.findByRole("img");

    const update = screen.getByRole("button", { name: "Update" });
    expect(update).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Number of genomes" }));
    await user.click(await screen.findByRole("option", { name: "20" }));
    expect(replace).not.toHaveBeenCalled();
    await user.click(update);

    expect(replace).toHaveBeenCalledWith(
      null,
      "",
      "/feature/PATRIC.1?tab=compare-region&compare.genomes=20",
    );
    replace.mockRestore();
  });

  it("shows the service's own error with a Retry", async () => {
    answer(
      {
        error:
          "The compare region service is busy with other requests. Please try again in a minute.",
        code: "server_busy",
      },
      503,
    );
    renderPanel();

    expect(await screen.findByText(/busy with other requests/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("says so when the service finds nothing to compare", async () => {
    answer({ rows: [] });
    renderPanel();
    expect(
      await screen.findByText("No comparable regions were found for this gene."),
    ).toBeInTheDocument();
  });

  it("exports the chart as an SVG file", async () => {
    const user = userEvent.setup();
    answer({ rows: [focusRow, mirroredRow] });
    renderPanel();
    await screen.findByRole("img");

    await user.click(screen.getByRole("button", { name: "Export SVG" }));

    expect(download.blob).toHaveBeenCalledWith(
      expect.any(Blob),
      "compare-regions-fig_1.1.peg.2.svg",
    );
    const [blob] = download.blob.mock.calls.at(0) ?? [];
    expect(blob?.type).toBe("image/svg+xml");
    expect(await blob?.text()).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});
