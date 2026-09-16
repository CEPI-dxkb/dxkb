/**
 * FacetPanel renders the same shared FacetColumn as resource-filter-bar.tsx's
 * facet panel, but through its own error / loading / loaded branches, each
 * with its own panel background. These tests guard that all three branches —
 * and the FacetColumn markup nested inside the loaded one — use theme tokens
 * rather than hardcoded gray-* / text-white utility classes.
 *
 * KNOWN ARCHITECTURAL VIOLATION, not a sanctioned pattern: `FacetPanel` is a
 * `"use client"` component that reads `NEXT_PUBLIC_DATA_API` and raw-`fetch`es the
 * upstream Data API (`facet-panel.tsx`), which `AGENTS.md` forbids — every backend
 * call belongs behind the `/api/data/[resource]` gateway. The env var set below and
 * the MSW handlers for `${dataApi}/genome/` exist only to drive the component as it
 * is *today*, so these theme-token assertions can run at all. Nothing here asserts
 * that the upstream call is correct, and no new test should. Migrating the component
 * off the env var and onto the gateway is tracked separately (whole-branch review
 * F10 / the Search+filterbar Data API migration follow-up); when it lands, delete
 * the `beforeEach`/`afterEach` env plumbing and point the handlers at the gateway.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { createQueryClientWrapper } from "@/test-helpers/react";
import { server } from "@/test-helpers/msw-server";
import { FacetPanel } from "../facet-panel";

const dataApi = "https://test-facet-panel.example.com";

const fields = [{ id: "genome_status", label: "Genome Status", facet: true }];

beforeEach(() => {
  process.env.NEXT_PUBLIC_DATA_API = dataApi;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DATA_API;
});

describe("FacetPanel theme tokens", () => {
  it("renders the error panel with theme tokens, not hardcoded grays", async () => {
    server.use(
      http.get(
        `${dataApi}/genome/`,
        () => new HttpResponse("boom", { status: 500 }),
      ),
    );

    const Wrapper = createQueryClientWrapper();
    render(
      <Wrapper>
        <FacetPanel
          fields={fields}
          query=""
          resource="genome"
          onSelect={vi.fn()}
        />
      </Wrapper>,
    );

    const message = await screen.findByText("Facets unavailable");
    expect(message.className).not.toMatch(/gray-/);
    expect(message.className).not.toMatch(/text-white/);
  });

  it("renders the loading skeleton panel with theme tokens", async () => {
    let resolveResponse: (value: Response) => void = () => undefined;
    const pending = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });

    server.use(http.get(`${dataApi}/genome/`, async () => pending));

    const Wrapper = createQueryClientWrapper();
    const { container } = render(
      <Wrapper>
        <FacetPanel
          fields={fields}
          query=""
          resource="genome"
          onSelect={vi.fn()}
        />
      </Wrapper>,
    );

    const panel = container.querySelector(".overflow-auto");
    expect(panel).not.toBeNull();
    expect(panel?.className).not.toMatch(/gray-/);
    // Includes the Skeleton overrides nested inside the loading branch.
    expect(panel?.innerHTML).not.toMatch(/gray-/);
    expect(panel?.innerHTML).not.toMatch(/text-white/);

    // Resolve so the in-flight request doesn't leak into later tests.
    resolveResponse(HttpResponse.json({}));
    await waitFor(() => {
      expect(screen.getByText("Genome Status")).toBeInTheDocument();
    });
  });

  it("renders the loaded panel (with FacetColumn) using theme tokens", async () => {
    server.use(
      http.get(`${dataApi}/genome/`, () =>
        HttpResponse.json({
          facet_counts: {
            facet_fields: { genome_status: ["Complete", 5] },
          },
        }),
      ),
    );

    const Wrapper = createQueryClientWrapper();
    const { container } = render(
      <Wrapper>
        <FacetPanel
          fields={fields}
          query=""
          resource="genome"
          onSelect={vi.fn()}
        />
      </Wrapper>,
    );

    await screen.findByText("Genome Status");
    const panel = container.querySelector(".overflow-auto");
    expect(panel).not.toBeNull();
    expect(panel?.className).not.toMatch(/gray-/);
    expect(panel?.innerHTML).not.toMatch(/gray-/);
    expect(panel?.innerHTML).not.toMatch(/text-white/);
  });
});
