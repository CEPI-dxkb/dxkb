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

function props(
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
      await SerologyPage(props("000123", { test_type: "ELISA/IgG test" })),
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
    await expect(generateMetadata(props())).resolves.toMatchObject({
      title: "000123 | Serology",
    });
  });

  it("renders encoded choices for an ambiguous sample", async () => {
    mocks.getSerology.mockResolvedValue({
      status: "ambiguous",
      testTypes: ["ELISA/IgG test", "Western blot"],
    });
    // Next.js decodes the `[sampleId]` route param once, so a sample
    // identifier containing a literal slash arrives here as "sample/1".
    render(await SerologyPage(props("sample/1")));

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
        props("000123", {
          test_type: ["ELISA", "Western blot"],
          tab: "overview",
          source: "legacy",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/serology/000123?source=legacy");
    expect(mocks.getSerology).toHaveBeenCalledWith("000123", undefined);
  });

  it("preserves a sample ID containing literal percent text instead of decoding it again", async () => {
    // If this were decoded a second time, "%2F" would become a real "/" and
    // "sample%2Fone" would resolve to a different (nonexistent) identifier.
    render(
      await SerologyPage(props("sample%2Fone", { test_type: "ELISA/IgG test" })),
    );

    expect(mocks.getSerology).toHaveBeenCalledWith(
      "sample%2Fone",
      "ELISA/IgG test",
    );
    await expect(
      generateMetadata(props("sample%2Fone")),
    ).resolves.toMatchObject({ title: "sample%2Fone | Serology" });
  });

  it("uses notFound for malformed, absent, and inaccessible records", async () => {
    await expect(SerologyPage(props(""))).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getSerology.mockResolvedValueOnce({ status: "not-found" });
    await expect(SerologyPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getSerology.mockRejectedValueOnce(new DataApiError("Forbidden", 403));
    await expect(SerologyPage(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("preserves upstream errors", async () => {
    mocks.getSerology.mockRejectedValueOnce(
      new DataApiError("Serology backend unavailable", 503),
    );
    await expect(SerologyPage(props())).rejects.toThrow(
      "Serology backend unavailable",
    );
  });
});
