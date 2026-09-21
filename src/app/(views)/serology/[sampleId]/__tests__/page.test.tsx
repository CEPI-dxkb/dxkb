import { render, screen } from "@testing-library/react";
import { DataApiError } from "@/lib/data-api/repository";

const mocks = vi.hoisted(() => ({ getSerology: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
  usePathname: () => "/serology/000123",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/serology-view/server", () => ({
  getSerology: mocks.getSerology,
}));

import SerologyPage, { generateMetadata } from "../page";

const record = {
  id: "backend-1",
  sample_identifier: "000123",
  test_type: "ELISA/IgG test",
  test_result: "Detected",
  test_interpretation: "Evidence of prior exposure; confirm clinically",
  collection_date: "2024-03",
  host_species: "Homo sapiens",
};

/**
 * Next gives the two entry points DIFFERENT encodings of the same segment, so
 * these helpers take the real identifier and produce what each one actually
 * receives. Feeding one string to both would prove nothing — see
 * `readRouteParam` in `src/lib/views/route-params.ts`.
 *
 * The page component's params come from `getDynamicParam()`, which
 * percent-ENCODES the matched value before user code sees it.
 */
function pageProps(
  sampleId = "000123",
  query: Record<string, string | string[] | undefined> = {},
) {
  return {
    params: Promise.resolve({ sampleId: encodeURIComponent(sampleId) }),
    searchParams: Promise.resolve(query),
  };
}

/** `generateMetadata` reads the route matcher's already-decoded params. */
function metadataProps(
  sampleId = "000123",
  query: Record<string, string | string[] | undefined> = {},
) {
  return {
    params: Promise.resolve({ sampleId }),
    searchParams: Promise.resolve(query),
  };
}

describe("Serology member page", () => {
  beforeEach(() => {
    mocks.getSerology.mockReset();
    mocks.getSerology.mockResolvedValue({ status: "unique", record });
  });

  it("preserves a digit-only sample ID and renders grouped source values", async () => {
    render(
      await SerologyPage(pageProps("000123", { test_type: "ELISA/IgG test" })),
    );

    expect(mocks.getSerology).toHaveBeenCalledWith("000123", "ELISA/IgG test");
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("2024-03")).toBeInTheDocument();
    expect(
      screen.getAllByText("Evidence of prior exposure; confirm clinically"),
    ).toHaveLength(2);
    expect(screen.getByText("Host")).toBeInTheDocument();
    await expect(generateMetadata(metadataProps())).resolves.toMatchObject({
      title: "000123 | Serology",
    });
  });

  it("renders encoded choices for an ambiguous sample", async () => {
    mocks.getSerology.mockResolvedValue({
      status: "ambiguous",
      testTypes: ["ELISA/IgG test", "Western blot"],
    });
    // The identifier is "sample/1"; the page component receives the
    // percent-encoded form Next re-encodes for user code.
    render(await SerologyPage(pageProps("sample/1")));

    expect(
      screen.getByRole("heading", { name: "Choose a serology test" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "ELISA/IgG test" }),
    ).toHaveAttribute(
      "href",
      "/serology/sample%2F1?test_type=ELISA%2FIgG%20test",
    );
  });

  it("canonicalizes repeated discriminator and obsolete tab parameters", async () => {
    await expect(
      SerologyPage(
        pageProps("000123", {
          test_type: ["ELISA", "Western blot"],
          tab: "overview",
          source: "legacy",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/serology/000123?source=legacy");
    expect(mocks.getSerology).toHaveBeenCalledWith("000123", undefined);
  });

  it("preserves a sample ID containing literal percent text instead of over-decoding it", async () => {
    // The identifier really is "sample%2Fone". The page component receives it
    // double-encoded and must decode exactly once; `generateMetadata`
    // receives it as-is and must not decode at all.
    render(
      await SerologyPage(
        pageProps("sample%2Fone", { test_type: "ELISA/IgG test" }),
      ),
    );

    expect(mocks.getSerology).toHaveBeenCalledWith(
      "sample%2Fone",
      "ELISA/IgG test",
    );
    await expect(
      generateMetadata(metadataProps("sample%2Fone")),
    ).resolves.toMatchObject({ title: "sample%2Fone | Serology" });
  });

  it("uses notFound only for the absent-record sentinel and an upstream 404", async () => {
    await expect(SerologyPage(pageProps(""))).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getSerology.mockResolvedValueOnce({ status: "not-found" });
    await expect(SerologyPage(pageProps())).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getSerology.mockRejectedValueOnce(
      new DataApiError("Record not found upstream", 404),
    );
    await expect(SerologyPage(pageProps())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("preserves upstream authentication, authorization, and service errors instead of disguising them as not-found", async () => {
    mocks.getSerology.mockRejectedValueOnce(
      new DataApiError("Session token expired", 401),
    );
    await expect(SerologyPage(pageProps())).rejects.toThrow(
      "Session token expired",
    );
    mocks.getSerology.mockRejectedValueOnce(new DataApiError("Forbidden", 403));
    await expect(SerologyPage(pageProps())).rejects.toThrow("Forbidden");
    mocks.getSerology.mockRejectedValueOnce(
      new DataApiError("Serology backend unavailable", 503),
    );
    await expect(SerologyPage(pageProps())).rejects.toThrow(
      "Serology backend unavailable",
    );
  });
});
