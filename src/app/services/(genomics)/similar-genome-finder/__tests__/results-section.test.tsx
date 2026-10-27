import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";

import { ServiceDebuggingProvider } from "@/contexts/service-debugging-context";
import { setTestSession } from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { ResultsSection } from "../results-section";
import { useSimilarGenomeFinderForm } from "../use-similar-genome-finder-form";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// jsdom has no layout, so the real virtualizer would render no rows.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number;
    estimateSize: () => number;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * estimateSize(),
        size: estimateSize(),
        end: (index + 1) * estimateSize(),
        key: index,
        lane: 0,
      })),
    getTotalSize: () => count * estimateSize(),
    measure: vi.fn(),
  }),
}));

const minhashUrl = "https://p3.theseed.test/services/minhash_service";
const websiteApi = "https://www.bv-brc.test/api";

// The real Server Action runs in the test, so its MinHash and genome calls
// reach MSW exactly as they leave the server.
function Harness() {
  const controller = useSimilarGenomeFinderForm();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          controller.form.setFieldValue("selectedGenomeId", "83332.12");
          void controller.form.handleSubmit();
        }}
      >
        Search
      </button>
      <ResultsSection controller={controller} />
    </>
  );
}

function renderHarness() {
  const QueryWrapper = createQueryClientWrapper();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <ServiceDebuggingProvider>{children}</ServiceDebuggingProvider>
      </QueryWrapper>
    );
  }
  return render(<Harness />, { wrapper: Wrapper });
}

// The results grid sizes its columns to its container, which jsdom cannot observe.
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

beforeEach(() => {
  vi.stubEnv("MINHASH_SERVICE_URL", minhashUrl);
  vi.stubEnv("BVBRC_WEBSITE_API_URL", websiteApi);
  setTestSession();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Similar Genome Finder results", () => {
  it("asks for a search before the first one instead of showing an empty table", () => {
    renderHarness();

    expect(
      screen.getByText("Run a search to see similar genomes."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No results/i)).not.toBeInTheDocument();
  });

  it("shows a failed search inline with a Retry that runs it again", async () => {
    let attempts = 0;
    server.use(
      http.post(minhashUrl, () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.text("down", {
              status: 503,
              statusText: "Service Unavailable",
            })
          : HttpResponse.json({
              result: [{ genome_id: "83332.12", distance: 0, pvalue: 0 }],
            });
      }),
      http.post(`${websiteApi}/genome/`, () =>
        HttpResponse.json([
          { genome_id: "83332.12", genome_name: "Mycobacterium tuberculosis H37Rv" },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Search" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Search failed");
    expect(alert).toHaveTextContent(
      "The BV-BRC minhash service is unavailable (HTTP 503 Service Unavailable: down).",
    );
    expect(screen.queryByText(/No results/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findAllByText("Mycobacterium tuberculosis H37Rv"),
    ).not.toHaveLength(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("keeps the hits and notes why genome names are missing", async () => {
    server.use(
      http.post(minhashUrl, () =>
        HttpResponse.json({
          result: [{ genome_id: "83332.12", distance: 0, pvalue: 0 }],
        }),
      ),
      http.post(`${websiteApi}/genome/`, () =>
        HttpResponse.text("", { status: 500, statusText: "Internal Server Error" }),
      ),
    );
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Genome names could not be loaded",
      );
    });
    expect(screen.getByText("83332.12")).toBeInTheDocument();
  });
});
