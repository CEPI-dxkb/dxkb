import { render, screen } from "@testing-library/react";
import { DataApiError } from "@/lib/data-api/repository";

const mocks = vi.hoisted(() => ({
  getExperiment: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  usePathname: () => "/experiment/00042",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/experiment-view/server", () => ({
  getExperiment: mocks.getExperiment,
}));
vi.mock("@/components/views", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/views")>();
  return {
    ...original,
    ResourceChildCollection: ({
      resource,
      rql,
    }: {
      resource: string;
      rql: string;
    }) => (
      <div
        data-testid="resource-child"
        data-resource={resource}
        data-rql={rql}
      />
    ),
  };
});

import ExperimentPage, { generateMetadata } from "../page";

const experiment = {
  exp_id: "00042",
  study_title: "Host response study",
  study_pi: "Ada Scientist",
  study_institution: "Research Institute",
  exp_title: "RNA response",
  exp_description: "Differential expression study",
  public_repository: "GEO",
  public_identifier: "GSE123",
  pmid: "123456",
  exp_type: "Transcript Quantification",
  measurement_technique: "RNA-Seq",
  organism: ["Escherichia coli"],
  genome_id: ["83332.12"],
  biosets: 2,
};

describe("Experiment member route", () => {
  beforeEach(() => {
    mocks.getExperiment.mockReset();
    mocks.notFound.mockClear();
    mocks.redirect.mockClear();
    mocks.getExperiment.mockResolvedValue(experiment);
  });

  it("preserves the string ID and renders overview links", async () => {
    render(
      await ExperimentPage({
        params: Promise.resolve({ experimentId: "00042" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(mocks.getExperiment).toHaveBeenCalledWith("00042");
    expect(screen.getAllByText("Host response study")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /GSE123/ })).toHaveAttribute(
      "href",
      expect.stringContaining("GSE123"),
    );
    expect(screen.getByRole("link", { name: /123456/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByRole("link", { name: "83332.12" })).toHaveAttribute(
      "href",
      "/genome/83332.12",
    );
    await expect(
      generateMetadata({ params: Promise.resolve({ experimentId: "00042" }) }),
    ).resolves.toMatchObject({ title: "RNA response | Experiment" });
  });

  it("renders every nonempty genome and omits empty arrays", async () => {
    mocks.getExperiment.mockResolvedValue({
      ...experiment,
      genome_id: ["83332.12", "", "511145.12"],
      organism: [],
      strain: [],
      experimenters: [],
      treatment_type: [],
    });

    render(
      await ExperimentPage({
        params: Promise.resolve({ experimentId: "00042" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByRole("link", { name: "83332.12" })).toHaveAttribute(
      "href",
      "/genome/83332.12",
    );
    expect(screen.getByRole("link", { name: "511145.12" })).toHaveAttribute(
      "href",
      "/genome/511145.12",
    );
    expect(screen.queryByText("Organism")).not.toBeInTheDocument();
    expect(screen.queryByText("Strain")).not.toBeInTheDocument();
    expect(screen.queryByText("Experimenters")).not.toBeInTheDocument();
    expect(screen.queryByText("Treatment type")).not.toBeInTheDocument();
  });

  it("renders Biosets with the exact experiment predicate", async () => {
    render(
      await ExperimentPage({
        params: Promise.resolve({ experimentId: "00042" }),
        searchParams: Promise.resolve({ tab: "biosets" }),
      }),
    );
    expect(screen.getByTestId("resource-child")).toHaveAttribute(
      "data-resource",
      "bioset",
    );
    expect(screen.getByTestId("resource-child")).toHaveAttribute(
      "data-rql",
      "eq(exp_id,00042)",
    );
  });

  it("canonicalizes invalid tabs and preserves unrelated state", async () => {
    await expect(
      ExperimentPage({
        params: Promise.resolve({ experimentId: "00042" }),
        searchParams: Promise.resolve({ tab: "missing", source: "search" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/experiment/00042?source=search");
  });

  it("uses notFound for invalid, absent, and inaccessible records", async () => {
    await expect(
      ExperimentPage({
        params: Promise.resolve({ experimentId: "0" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getExperiment.mockResolvedValue(null);
    await expect(
      ExperimentPage({
        params: Promise.resolve({ experimentId: "42" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getExperiment.mockRejectedValue(
      new DataApiError("Forbidden", 403, "forbidden"),
    );
    await expect(
      ExperimentPage({
        params: Promise.resolve({ experimentId: "42" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("preserves upstream failures", async () => {
    mocks.getExperiment.mockRejectedValue(
      new Error("Experiment backend unavailable"),
    );
    await expect(
      ExperimentPage({
        params: Promise.resolve({ experimentId: "42" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("Experiment backend unavailable");
  });
});
