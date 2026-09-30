/**
 * FacetPanel renders the same shared FacetColumn as resource-filter-bar.tsx's
 * facet panel, but through its own error / loading / loaded branches, each
 * with its own panel background. These tests guard that all three branches —
 * and the FacetColumn markup nested inside the loaded one — use theme tokens
 * rather than hardcoded gray-* / text-white utility classes, and that the
 * counts come from the same-origin Data API gateway rather than a direct
 * upstream fetch.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { createQueryClientWrapper } from "@/test-helpers/react";
import { server } from "@/test-helpers/msw-server";
import { FacetPanel } from "../facet-panel";

const gateway = "/api/data/genome";
const fields = [{ id: "genome_status", label: "Genome Status" }];

function renderPanel(query = "", enabled?: boolean) {
  const Wrapper = createQueryClientWrapper();
  const panel = (isEnabled?: boolean) => (
    <Wrapper>
      <FacetPanel
        fields={fields}
        query={query}
        resource="genome"
        enabled={isEnabled}
        onSelect={vi.fn()}
      />
    </Wrapper>
  );
  const view = render(panel(enabled));
  return {
    ...view,
    rerenderPanel: (isEnabled?: boolean) => {
      view.rerender(panel(isEnabled));
    },
  };
}

describe("FacetPanel request", () => {
  it("asks the same-origin gateway for facet counts, not the upstream data API", async () => {
    const requests: URL[] = [];
    server.use(
      http.get(gateway, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({
          rows: [],
          total: 0,
          facets: { genome_status: [{ value: "Complete", count: 5 }] },
          page: 1,
          pageSize: 1,
        });
      }),
    );

    renderPanel("keyword(influenza)");

    await screen.findByText("Complete (5)");
    const url = requests[0];
    expect(url.origin).toBe(window.location.origin);
    expect(url.searchParams.get("operation")).toBe("collection");
    expect(url.searchParams.get("rql")).toBe("keyword(influenza)");
    expect(url.searchParams.getAll("facet")).toEqual(["genome_status"]);
    // Counts, not rows: the smallest page the gateway accepts.
    expect(url.searchParams.get("pageSize")).toBe("1");
  });
});

describe("FacetPanel enabled", () => {
  const loadedBody = {
    rows: [],
    total: 0,
    facets: { genome_status: [{ value: "Complete", count: 5 }] },
    page: 1,
    pageSize: 1,
  };

  it("makes no request while disabled, shows the skeleton, then requests once when enabled", async () => {
    const requests: URL[] = [];
    server.use(
      http.get(gateway, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(loadedBody);
      }),
    );

    const { container, rerenderPanel } = renderPanel("", false);

    // The skeleton, not an empty panel and not the error panel.
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("Facets unavailable")).not.toBeInTheDocument();
    // Long enough for a wrongly started query to reach the handler.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(requests).toHaveLength(0);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);

    rerenderPanel(true);

    await screen.findByText("Complete (5)");
    expect(requests).toHaveLength(1);
    expect(requests[0].searchParams.getAll("facet")).toEqual(["genome_status"]);
  });

  it("fetches at once when not told otherwise", async () => {
    const requests: URL[] = [];
    server.use(
      http.get(gateway, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json(loadedBody);
      }),
    );

    renderPanel();

    await screen.findByText("Complete (5)");
    expect(requests).toHaveLength(1);
  });
});

describe("FacetPanel theme tokens", () => {
  it("renders the error panel with theme tokens, not hardcoded grays", async () => {
    server.use(
      http.get(gateway, () =>
        HttpResponse.json(
          { error: "Facet query failed.", code: "upstream_error" },
          { status: 502 },
        ),
      ),
    );

    renderPanel();

    const message = await screen.findByText("Facets unavailable");
    expect(message.className).not.toMatch(/gray-/);
    expect(message.className).not.toMatch(/text-white/);
  });

  it("renders the loading skeleton panel with theme tokens", async () => {
    let resolveResponse: (value: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });

    server.use(http.get(gateway, async () => pending));

    const { container } = renderPanel();

    const panel = container.querySelector(".overflow-auto");
    expect(panel).not.toBeNull();
    expect(panel?.className).not.toMatch(/gray-/);
    // Includes the Skeleton overrides nested inside the loading branch.
    expect(panel?.innerHTML).not.toMatch(/gray-/);
    expect(panel?.innerHTML).not.toMatch(/text-white/);

    // Resolve so the in-flight request doesn't leak into later tests.
    resolveResponse(
      HttpResponse.json({
        rows: [],
        total: 0,
        facets: {},
        page: 1,
        pageSize: 1,
      }),
    );
    await waitFor(() => {
      expect(screen.getByText("Genome Status")).toBeInTheDocument();
    });
  });

  it("renders the loaded panel (with FacetColumn) using theme tokens", async () => {
    server.use(
      http.get(gateway, () =>
        HttpResponse.json({
          rows: [],
          total: 0,
          facets: { genome_status: [{ value: "Complete", count: 5 }] },
          page: 1,
          pageSize: 1,
        }),
      ),
    );

    const { container } = renderPanel();

    await screen.findByText("Genome Status");
    const panel = container.querySelector(".overflow-auto");
    expect(panel).not.toBeNull();
    expect(panel?.className).not.toMatch(/gray-/);
    expect(panel?.innerHTML).not.toMatch(/gray-/);
    expect(panel?.innerHTML).not.toMatch(/text-white/);
  });
});
