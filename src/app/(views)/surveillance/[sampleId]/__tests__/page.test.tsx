import { render, screen } from "@testing-library/react";
import { DataApiError } from "@/lib/data-api/repository";

const mocks = vi.hoisted(() => ({ getSurveillance: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
  usePathname: () => "/surveillance/sample-1",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/surveillance-view/server", () => ({
  getSurveillance: mocks.getSurveillance,
}));

import SurveillancePage, { generateMetadata } from "../page";

const record = {
  id: "backend-1",
  sample_identifier: "sample/1",
  pathogen_test_type: ["RAT/antigen"],
  collection_date: "2024-03",
  collection_latitude: "41.5",
  collection_longitude: -87.25,
  pathogen_test_result: ["positive", "confirmed"],
};

function props(
  // Next.js decodes the `[sampleId]` route param once before the page ever
  // sees it, so a sample identifier containing a literal slash arrives here
  // as "sample/1" — not as the "sample%2F1" it was encoded to in the URL.
  sampleId = "sample/1",
  query: Record<string, string | string[] | undefined> = {},
) {
  return {
    params: Promise.resolve({ sampleId }),
    searchParams: Promise.resolve(query),
  };
}

describe("Surveillance member page", () => {
  beforeEach(() => {
    mocks.getSurveillance.mockReset();
    mocks.getSurveillance.mockResolvedValue({ status: "unique", record });
  });

  it("accepts the pre-decoded sample ID, passes a scalar test type, and renders grouped data", async () => {
    render(
      await SurveillancePage(
        props("sample/1", { pathogen_test_type: "RAT/antigen" }),
      ),
    );

    expect(mocks.getSurveillance).toHaveBeenCalledWith(
      "sample/1",
      "RAT/antigen",
    );
    expect(screen.getByRole("button", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("2024-03")).toBeInTheDocument();
    expect(screen.getByText("41.5° N, 87.25° W")).toBeInTheDocument();
    expect(screen.getAllByText("positive, confirmed")).toHaveLength(2);
    expect(screen.getByText("Vaccination")).toBeInTheDocument();
    expect(screen.getAllByText("No data available.").length).toBeGreaterThan(0);
    await expect(generateMetadata(props())).resolves.toMatchObject({
      title: "sample/1 | Surveillance",
    });
  });

  it("renders accessible canonical choices for an ambiguous sample", async () => {
    mocks.getSurveillance.mockResolvedValue({
      status: "ambiguous",
      testTypes: ["PCR", "RAT/antigen"],
    });
    render(await SurveillancePage(props()));

    expect(
      screen.getByRole("heading", { name: "Choose a pathogen test" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "PCR" })).toHaveAttribute(
      "href",
      "/surveillance/sample%2F1?pathogen_test_type=PCR",
    );
    expect(screen.getByRole("link", { name: "RAT/antigen" })).toHaveAttribute(
      "href",
      "/surveillance/sample%2F1?pathogen_test_type=RAT%2Fantigen",
    );
  });

  it("uses the generic header when pathogen test types are empty", async () => {
    mocks.getSurveillance.mockResolvedValue({
      status: "unique",
      record: { ...record, pathogen_test_type: [] },
    });

    render(await SurveillancePage(props()));

    expect(screen.getByText("Pathogen surveillance sample")).toBeInTheDocument();
  });

  it("canonicalizes repeated discriminator and tab parameters", async () => {
    await expect(
      SurveillancePage(
        props("sample/1", {
          pathogen_test_type: ["PCR", "RAT"],
          tab: "overview",
          source: "legacy",
        }),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/surveillance/sample%2F1?source=legacy",
    );
    expect(mocks.getSurveillance).toHaveBeenCalledWith("sample/1", undefined);
  });

  it("preserves a sample ID containing literal percent text instead of decoding it again", async () => {
    // If this were decoded a second time, "%2F" would become a real "/" and
    // "sample%2Fone" would resolve to a different (nonexistent) identifier.
    render(await SurveillancePage(props("sample%2Fone")));

    expect(mocks.getSurveillance).toHaveBeenCalledWith(
      "sample%2Fone",
      undefined,
    );
    await expect(
      generateMetadata(props("sample%2Fone")),
    ).resolves.toMatchObject({ title: "sample%2Fone | Surveillance" });
  });

  it("uses notFound only for the absent-record sentinel and an upstream 404", async () => {
    await expect(SurveillancePage(props(""))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    mocks.getSurveillance.mockResolvedValueOnce({ status: "not-found" });
    await expect(SurveillancePage(props())).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getSurveillance.mockRejectedValueOnce(
      new DataApiError("Record not found upstream", 404),
    );
    await expect(SurveillancePage(props())).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("preserves upstream authentication, authorization, and service errors instead of disguising them as not-found", async () => {
    mocks.getSurveillance.mockRejectedValueOnce(
      new DataApiError("Session token expired", 401),
    );
    await expect(SurveillancePage(props())).rejects.toThrow(
      "Session token expired",
    );
    mocks.getSurveillance.mockRejectedValueOnce(
      new DataApiError("Forbidden", 403),
    );
    await expect(SurveillancePage(props())).rejects.toThrow("Forbidden");
    mocks.getSurveillance.mockRejectedValueOnce(
      new DataApiError("Surveillance backend unavailable", 503),
    );
    await expect(SurveillancePage(props())).rejects.toThrow(
      "Surveillance backend unavailable",
    );
  });
});
