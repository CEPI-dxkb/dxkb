vi.mock("@visx/responsive", () => ({
  useParentSize: () => ({ parentRef: { current: null }, width: 400, height: 400, resize: () => undefined }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/lib/svg-figure-export", () => ({ exportSvgFigure: vi.fn() }));

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { toast } from "sonner";
import { exportSvgFigure } from "@/lib/svg-figure-export";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { CircularViewerPanel } from "../circular-viewer-panel";

const unavailable = { error: "The BV-BRC data service is unavailable (HTTP 503).", code: "upstream_unavailable" };

function serveGenome() {
  server.use(
    http.get("*/api/circular-viewer/contigs", () =>
      HttpResponse.json({ contigs: [{ accession: "NC_1", sequenceId: "s1", length: 50_000 }], truncated: false }),
    ),
    http.get("*/api/circular-viewer/track", ({ request }) =>
      HttpResponse.json({
        features:
          new URL(request.url).searchParams.get("preset") === "cds-forward"
            ? [{ featureId: "F1", accession: "NC_1", start: 1, end: 900, strand: "+", featureType: "CDS" }]
            : [],
        truncated: false,
      }),
    ),
    http.get("*/api/circular-viewer/gc", () =>
      HttpResponse.json({ windowSize: 50, contigs: [{ accession: "NC_1", length: 50_000, gc: [0.5, 0.6], skew: [0, 0.1] }] }),
    ),
  );
}

describe("CircularViewerPanel", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(exportSvgFigure).mockClear();
  });

  it("loads the genome and every default track", async () => {
    serveGenome();
    render(<CircularViewerPanel genomeId="1.1" />, { wrapper: createQueryClientWrapper() });
    const figure = await screen.findByRole("img", { name: "Circular view of genome 1.1" });
    await waitFor(() => {
      expect(figure.querySelector('[data-track="cds-forward"]')).toHaveAttribute("data-state", "ready");
      expect(figure.querySelector('[data-track="gc-content"]')).toHaveAttribute("data-state", "ready");
      expect(screen.getByRole("listitem", { name: "AMR Genes" })).toHaveTextContent("None found");
    });
    // An empty default track says so in its row only (deviation 5).
    expect(toast.error).not.toHaveBeenCalled();
    // On the card surface, where muted text meets 4.5:1 (the page background gives 4.42:1).
    expect(screen.getByTestId("circular-viewer")).toHaveClass("flex", "min-h-0", "flex-1", "bg-card");
  });

  it("shows the real error with a retry when the sequences cannot load", async () => {
    server.use(
      http.get("*/api/circular-viewer/contigs", () => HttpResponse.json(unavailable, { status: 503 })),
    );
    render(<CircularViewerPanel genomeId="1.1" />, { wrapper: createQueryClientWrapper() });
    expect(await screen.findByText(/The BV-BRC data service is unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("says so when a genome has no sequences", async () => {
    server.use(http.get("*/api/circular-viewer/contigs", () => HttpResponse.json({ contigs: [], truncated: false })));
    render(<CircularViewerPanel genomeId="1.1" />, { wrapper: createQueryClientWrapper() });
    expect(await screen.findByText("No sequences are available for this genome.")).toBeInTheDocument();
  });

  it("says when only the first sequences are drawn", async () => {
    serveGenome();
    server.use(
      http.get("*/api/circular-viewer/contigs", () =>
        HttpResponse.json({ contigs: [{ accession: "NC_1", sequenceId: "s1", length: 50_000 }], truncated: true }),
      ),
    );
    render(<CircularViewerPanel genomeId="1.1" />, { wrapper: createQueryClientWrapper() });
    expect(await screen.findByText("Showing the first 1,000 sequences of this genome.")).toBeInTheDocument();
  });

  it("keeps a failed track's error while its retry runs, then shows the retry's answer", async () => {
    serveGenome();
    let vfCalls = 0;
    server.use(
      http.get("*/api/circular-viewer/track", async ({ request }) => {
        if (new URL(request.url).searchParams.get("preset") !== "vf") return HttpResponse.json({ features: [], truncated: false });
        vfCalls += 1;
        if (vfCalls === 1) return HttpResponse.json(unavailable, { status: 503 });
        await delay(50);
        return HttpResponse.json({ features: [], truncated: false });
      }),
    );
    render(<CircularViewerPanel genomeId="1.1" />, { wrapper: createQueryClientWrapper() });
    const vf = await screen.findByRole("listitem", { name: "VF Genes" });
    expect(await within(vf).findByRole("alert")).toHaveTextContent("The BV-BRC data service is unavailable (HTTP 503).");
    await userEvent.click(within(vf).getByRole("button", { name: "Retry" }));
    expect(within(vf).getByRole("button", { name: "Retrying…" })).toBeDisabled();
    expect(vf).toHaveTextContent("The BV-BRC data service is unavailable (HTTP 503).");
    await waitFor(() => {
      expect(vf).toHaveTextContent("None found");
    });
    expect(within(vf).queryByRole("alert")).toBeNull();
    expect(vfCalls).toBe(2);
  });

  it("gives both GC tracks the GC query's error and one retry", async () => {
    serveGenome();
    let gcCalls = 0;
    server.use(
      http.get("*/api/circular-viewer/gc", () => {
        gcCalls += 1;
        return HttpResponse.json(unavailable, { status: 503 });
      }),
    );
    render(<CircularViewerPanel genomeId="1.1" />, { wrapper: createQueryClientWrapper() });
    const content = await screen.findByRole("listitem", { name: "GC Content" });
    const skew = screen.getByRole("listitem", { name: "GC Skew" });
    await waitFor(() => {
      expect(within(content).getByRole("alert")).toHaveTextContent("The BV-BRC data service is unavailable");
      expect(within(skew).getByRole("alert")).toHaveTextContent("The BV-BRC data service is unavailable");
    });
    await userEvent.click(within(skew).getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(gcCalls).toBe(2);
    });
    await waitFor(() => {
      expect(within(content).getByRole("button", { name: "Retry" })).toBeEnabled();
    });
  });

  it("fills both GC tracks when the GC read answers on Retry", async () => {
    serveGenome();
    let gcCalls = 0;
    server.use(
      http.get("*/api/circular-viewer/gc", () => {
        gcCalls += 1;
        if (gcCalls === 1) return HttpResponse.json(unavailable, { status: 503 });
        return HttpResponse.json({ windowSize: 50, contigs: [{ accession: "NC_1", length: 50_000, gc: [0.5, 0.6], skew: [0, 0.1] }] });
      }),
    );
    render(<CircularViewerPanel genomeId="1.1" />, { wrapper: createQueryClientWrapper() });
    const figure = await screen.findByRole("img", { name: "Circular view of genome 1.1" });
    const skew = await screen.findByRole("listitem", { name: "GC Skew" });
    await userEvent.click(await within(skew).findByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(figure.querySelector('[data-track="gc-content"]')).toHaveAttribute("data-state", "ready");
      expect(figure.querySelector('[data-track="gc-skew"]')).toHaveAttribute("data-state", "ready");
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(gcCalls).toBe(2);
  });

  it("adds a custom track and raises legacy's toast when it matches nothing", async () => {
    serveGenome();
    let customQuery: URLSearchParams | undefined;
    server.use(
      http.get("*/api/circular-viewer/custom", ({ request }) => {
        customQuery = new URL(request.url).searchParams;
        return HttpResponse.json({ features: [], truncated: false });
      }),
    );
    render(<CircularViewerPanel genomeId="1.1" />, { wrapper: createQueryClientWrapper() });
    await screen.findByRole("img", { name: "Circular view of genome 1.1" });
    const form = within(screen.getByRole("form", { name: "Add custom tracks" }));
    await userEvent.click(form.getByRole("combobox", { name: "Feature type" }));
    await userEvent.click(await screen.findByRole("option", { name: "CDS" }));
    await userEvent.click(form.getByRole("combobox", { name: "Strand" }));
    await userEvent.click(await screen.findByRole("option", { name: "Both" }));
    await userEvent.type(form.getByRole("textbox", { name: "Keyword" }), "secretion");
    await userEvent.type(form.getByRole("textbox", { name: "Track name (optional)" }), "   ");
    await userEvent.click(form.getByRole("button", { name: "Add custom track" }));
    const row = await screen.findByRole("listitem", { name: "secretion" });
    await waitFor(() => {
      expect(row).toHaveTextContent("None found");
    });
    expect(customQuery?.get("keyword")).toBe("secretion");
    expect(customQuery?.get("type")).toBe("CDS");
    expect(customQuery?.get("strand")).toBe("both");
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("No data found.");
  });

  it("exports the figure as an SVG named for the genome once every shown track has loaded", async () => {
    serveGenome();
    server.use(
      http.get("*/api/circular-viewer/gc", async () => {
        await delay(100);
        return HttpResponse.json({ windowSize: 50, contigs: [{ accession: "NC_1", length: 50_000, gc: [0.5, 0.6], skew: [0, 0.1] }] });
      }),
    );
    render(<CircularViewerPanel genomeId="1.1" />, { wrapper: createQueryClientWrapper() });
    const figure = await screen.findByRole("img", { name: "Circular view of genome 1.1" });
    const exportButton = screen.getByRole("button", { name: "Export SVG" });
    // A loading ring would be exported mid-pulse.
    expect(figure.querySelector('[data-track="gc-content"]')).toHaveAttribute("data-state", "pending");
    expect(exportButton).toBeDisabled();
    await waitFor(() => {
      expect(exportButton).toBeEnabled();
    });
    await userEvent.click(exportButton);
    expect(exportSvgFigure).toHaveBeenCalledWith(figure, "circular-genome-1.1.svg");
    const guide = screen.getByRole("link", { name: "User guide (opens in a new tab)" });
    expect(guide).toHaveAttribute(
      "href",
      "https://www.bv-brc.org/docs/quick_references/organisms_genome/circular_genome_viewer.html",
    );
    expect(guide).toHaveAttribute("target", "_blank");
    expect(guide).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("stacks the sidebar above a square figure below md, and sets them side by side from md", async () => {
    serveGenome();
    render(<CircularViewerPanel genomeId="1.1" />, { wrapper: createQueryClientWrapper() });
    await screen.findByRole("img", { name: "Circular view of genome 1.1" });
    const card = screen.getByTestId("circular-viewer");
    expect(card).toHaveClass("flex-col", "md:flex-row", "max-md:overflow-y-auto");
    const sidebar = card.querySelector("aside");
    expect(sidebar).toHaveClass("md:w-80", "md:shrink-0", "md:overflow-y-auto", "md:border-r");
    expect(sidebar).not.toHaveClass("w-80");
    // A square figure when stacked, so its measured size is never zero.
    expect(screen.getByTestId("circular-viewer-figure-area")).toHaveClass("max-md:aspect-square", "max-md:shrink-0", "md:flex-1");
  });
});
