import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import {
  genomeSearchErrorMessage,
  shouldSearch,
  useGenomeTypeahead,
} from "../use-genome-typeahead";

describe("shouldSearch", () => {
  it("returns false for empty string", () => {
    expect(shouldSearch("", 0)).toBe(false);
  });

  it("returns false for whitespace-only", () => {
    expect(shouldSearch("   ", 0)).toBe(false);
  });

  it("returns true when trimmed length meets minLength", () => {
    expect(shouldSearch("abc", 3)).toBe(true);
  });

  it("returns false when trimmed length is below minLength", () => {
    expect(shouldSearch("ab", 3)).toBe(false);
  });

  it("allows 0 minLength for non-numeric strings", () => {
    expect(shouldSearch("x", 0)).toBe(true);
  });

  it("requires >= 2 chars for numeric genome IDs regardless of minLength", () => {
    expect(shouldSearch("1", 0)).toBe(false);
    expect(shouldSearch("12", 0)).toBe(true);
    expect(shouldSearch("123.45", 0)).toBe(true);
  });

  it("treats dotted numeric as genome ID pattern", () => {
    expect(shouldSearch("1.1", 0)).toBe(true);
    expect(shouldSearch("1.", 5)).toBe(false); // not matching numeric pattern — treated as text, length 2 < 5
  });
});

describe("useGenomeTypeahead failed search", () => {
  const outage = "BV-BRC genome search failed: 503 Service Unavailable";

  it("keeps the route's reason behind what failed, and retries the same query", async () => {
    let down = true;
    const queries: (string | null)[] = [];
    server.use(
      http.get("*/api/services/genome/search", ({ request }) => {
        queries.push(new URL(request.url).searchParams.get("q"));
        return down
          ? HttpResponse.json(
              { error: outage, code: "upstream" },
              { status: 503 },
            )
          : HttpResponse.json({
              results: [{ genome_id: "83332.12", genome_name: "M. tb H37Rv" }],
            });
      }),
    );
    const { result } = renderHook(() => useGenomeTypeahead({ minQueryLength: 3 }));

    act(() => {
      result.current.setQuery("Mycobacterium");
    });

    await waitFor(() => {
      expect(result.current.error).toBe(`Genome search unavailable: ${outage}`);
    });
    expect(result.current.isLoading).toBe(false);

    down = false;
    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.suggestions).toEqual([
        { genome_id: "83332.12", genome_name: "M. tb H37Rv" },
      ]);
    });
    expect(result.current.error).toBeNull();
    expect(queries).toEqual(["Mycobacterium", "Mycobacterium"]);
  });

  it("retries the all-genomes lookup that failed, not the typed text", async () => {
    let down = true;
    const queries: (string | null)[] = [];
    server.use(
      http.get("*/api/services/genome/search", ({ request }) => {
        queries.push(new URL(request.url).searchParams.get("q"));
        return down
          ? HttpResponse.json(
              { error: outage, code: "upstream" },
              { status: 503 },
            )
          : HttpResponse.json({ results: [] });
      }),
    );
    const { result } = renderHook(() => useGenomeTypeahead({ minQueryLength: 3 }));

    // Too short to search as typed; the dropdown toggle lists every genome.
    act(() => {
      result.current.setQuery("My");
    });
    act(() => {
      result.current.triggerSearch("");
    });
    await waitFor(() => {
      expect(result.current.error).toBe(`Genome search unavailable: ${outage}`);
    });

    down = false;
    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(queries).toEqual(["", ""]);
  });

  it("names a network failure as the genome search's", () => {
    expect(genomeSearchErrorMessage(new TypeError("Failed to fetch"))).toBe(
      "Genome search unavailable: Failed to fetch",
    );
    expect(genomeSearchErrorMessage({})).toBe("Genome search unavailable.");
  });
});
