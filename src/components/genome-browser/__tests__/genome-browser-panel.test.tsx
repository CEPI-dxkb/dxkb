import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, type JsonBodyType } from "msw";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { clearGenomeBrowserCaches } from "@/lib/genome-browser/client";
import { GenomeBrowserPanel } from "../genome-browser-panel";

const search = vi.hoisted(() => ({ value: "" }));

vi.mock("@/components/views/tab-content-search-params", () => ({
  useTabContentSearchParams: () => new URLSearchParams(search.value),
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function View(props: {
      location?: string;
      highlight?: string;
      hasDefaultHighlight?: boolean;
      tracks: string[];
    }) {
      return (
        <div
          data-testid="view"
          data-location={props.location ?? ""}
          data-highlight={props.highlight ?? ""}
          data-has-default-highlight={String(props.hasDefaultHighlight)}
          data-tracks={props.tracks.join(",")}
        />
      );
    },
}));

function regions(body: JsonBodyType, status = 200) {
  server.use(
    http.get("/api/genome-browser/regions", () =>
      HttpResponse.json(body, { status }),
    ),
  );
}

function renderPanel(props: Parameters<typeof GenomeBrowserPanel>[0]) {
  return render(<GenomeBrowserPanel {...props} />, {
    wrapper: createQueryClientWrapper(),
  });
}

/** Waits until the view opens at `location`, then returns it. */
async function viewOpenedAt(location: string): Promise<HTMLElement> {
  await vi.waitFor(() =>
    expect(screen.getByTestId("view")).toHaveAttribute(
      "data-location",
      location,
    ),
  );
  return screen.getByTestId("view");
}

beforeEach(() => {
  search.value = "";
  clearGenomeBrowserCaches();
});

describe("GenomeBrowserPanel", () => {
  it("opens a genome on its first sequence", async () => {
    regions({
      regions: [{ refName: "470.36849.con.0001", start: 0, end: 305802 }],
    });
    renderPanel({ genomeId: "470.36849" });
    const view = await viewOpenedAt("470.36849.con.0001:1..100000");
    expect(view).toHaveAttribute("data-tracks", "refseqs,PATRICGenes,RefSeqGenes");
  });

  it("reopens where the URL says", async () => {
    search.value =
      "browser.loc=470.36849.con.0001:500..900&browser.tracks=PATRICGenes";
    regions({
      regions: [{ refName: "470.36849.con.0001", start: 0, end: 305802 }],
    });
    renderPanel({ genomeId: "470.36849" });
    const view = await viewOpenedAt("470.36849.con.0001:500..900");
    expect(view).toHaveAttribute("data-tracks", "PATRICGenes");
  });

  it("opens a feature with its flanks and highlight", async () => {
    regions({ regions: [{ refName: "ATGO01000001", start: 0, end: 33406 }] });
    renderPanel({
      genomeId: "1328357.3",
      focus: {
        location: "ATGO01000001:6610..13707",
        highlight: "ATGO01000001:9610..10707",
      },
    });
    const view = await viewOpenedAt("ATGO01000001:6610..13707");
    expect(view).toHaveAttribute("data-highlight", "ATGO01000001:9610..10707");
  });

  it("opens on the default location when the URL's coordinates are malformed", async () => {
    search.value = "browser.loc=470.36849.con.0001:abc";
    regions({
      regions: [{ refName: "470.36849.con.0001", start: 0, end: 305802 }],
    });
    renderPanel({ genomeId: "470.36849" });
    await viewOpenedAt("470.36849.con.0001:1..100000");
  });

  it("drops a malformed highlight from the URL", async () => {
    search.value = "browser.highlight=470.36849.con.0001:abc";
    regions({
      regions: [{ refName: "470.36849.con.0001", start: 0, end: 305802 }],
    });
    renderPanel({ genomeId: "470.36849" });
    const view = await viewOpenedAt("470.36849.con.0001:1..100000");
    expect(view).toHaveAttribute("data-highlight", "");
  });

  it("falls back to the feature's highlight when the URL's is another genome's", async () => {
    search.value = "browser.highlight=other.contig:10..20";
    regions({ regions: [{ refName: "ATGO01000001", start: 0, end: 33406 }] });
    renderPanel({
      genomeId: "1328357.3",
      focus: {
        location: "ATGO01000001:6610..13707",
        highlight: "ATGO01000001:9610..10707",
      },
    });
    const view = await viewOpenedAt("ATGO01000001:6610..13707");
    expect(view).toHaveAttribute("data-highlight", "ATGO01000001:9610..10707");
  });

  it("opens on the genome's default when the feature's focus names a sequence it does not have", async () => {
    // A feature row whose accession is not among the genome's sequences (the
    // two Data API cores disagree): JBrowse would throw on it.
    regions({ regions: [{ refName: "ATGO01000001", start: 0, end: 33406 }] });
    renderPanel({
      genomeId: "1328357.3",
      focus: {
        location: "NZ_OTHER01000001:6610..13707",
        highlight: "NZ_OTHER01000001:9610..10707",
      },
    });
    const view = await viewOpenedAt("ATGO01000001:1..33406");
    expect(view).toHaveAttribute("data-highlight", "");
  });

  it("keeps a cleared highlight cleared instead of restoring the feature's", async () => {
    search.value = "browser.highlight=none";
    regions({
      regions: [{ refName: "ATGO01000001", start: 0, end: 40000 }],
    });
    renderPanel({
      genomeId: "1.1",
      focus: {
        location: "ATGO01000001:6610..13707",
        highlight: "ATGO01000001:9610..10707",
      },
    });
    const view = await viewOpenedAt("ATGO01000001:6610..13707");
    expect(view).toHaveAttribute("data-highlight", "");
    expect(view).toHaveAttribute("data-has-default-highlight", "true");
  });

  it("keeps a valid highlight from the URL", async () => {
    search.value = "browser.highlight=ATGO01000001:100..200";
    regions({ regions: [{ refName: "ATGO01000001", start: 0, end: 33406 }] });
    renderPanel({ genomeId: "1328357.3" });
    await vi.waitFor(() =>
      expect(screen.getByTestId("view")).toHaveAttribute(
        "data-highlight",
        "ATGO01000001:100..200",
      ),
    );
  });

  it("says so when the genome has no sequences", async () => {
    regions({ regions: [] });
    renderPanel({ genomeId: "1.1" });
    expect(
      await screen.findByText("No sequences are available for this genome."),
    ).toBeInTheDocument();
  });

  it("shows the route's error with a Retry", async () => {
    regions(
      {
        error:
          "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance).",
        code: "upstream_error",
      },
      503,
    );
    renderPanel({ genomeId: "1.1" });
    expect(await screen.findByText(/Site Maintenance/)).toBeInTheDocument();
    regions({ regions: [{ refName: "A", start: 0, end: 10 }] });
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await viewOpenedAt("A:1..10");
  });
});
