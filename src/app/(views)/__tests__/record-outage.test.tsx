// The record pages' real lookups pull in `server-only` through the server
// data repository; see src/lib/data-api/__tests__/server-repository.test.ts.
vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";
import { render, screen, within } from "@testing-library/react";
import type { Metadata } from "next";
import type { ReactElement } from "react";

import { server } from "@/test-helpers/msw-server";
import { connectTimeout, maintenancePage } from "@/test-helpers/upstream-failures";

import EpitopePage, { generateMetadata as epitopeMetadata } from "../epitope/[epitopeId]/page";
import ExperimentPage, {
  generateMetadata as experimentMetadata,
} from "../experiment/[experimentId]/page";
import FeaturePage, { generateMetadata as featureMetadata } from "../feature/[featureId]/page";
import GenomePage, { generateMetadata as genomeMetadata } from "../genome/[genomeId]/page";
import StrainPage, { generateMetadata as strainMetadata } from "../strain/[strainId]/page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
  permanentRedirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const dataApiUrl = "https://data.record-outage.test";

beforeEach(() => {
  process.env.DATA_API_URL = dataApiUrl;
});

afterEach(() => {
  delete process.env.DATA_API_URL;
});

interface RecordPage {
  name: string;
  id: string;
  collectionHref: string;
  browse: string;
  page: (id: string) => Promise<ReactElement>;
  metadata: (id: string) => Promise<Metadata>;
}

const pages: RecordPage[] = [
  {
    name: "Genome",
    id: "511145.12",
    collectionHref: "/genome",
    browse: "Browse genomes",
    page: (genomeId) =>
      GenomePage({ params: Promise.resolve({ genomeId }), searchParams: Promise.resolve({}) }),
    metadata: (genomeId) =>
      genomeMetadata({ params: Promise.resolve({ genomeId }), searchParams: Promise.resolve({}) }),
  },
  {
    name: "Feature",
    id: "fig|83332.12.peg.1",
    collectionHref: "/feature",
    browse: "Browse features",
    page: (featureId) =>
      FeaturePage({ params: Promise.resolve({ featureId }), searchParams: Promise.resolve({}) }),
    metadata: (featureId) =>
      featureMetadata({ params: Promise.resolve({ featureId }), searchParams: Promise.resolve({}) }),
  },
  {
    name: "Strain",
    id: "1773",
    collectionHref: "/strain",
    browse: "Browse strains",
    page: (strainId) => StrainPage({ params: Promise.resolve({ strainId }) }),
    metadata: (strainId) => strainMetadata({ params: Promise.resolve({ strainId }) }),
  },
  {
    name: "Epitope",
    id: "15780",
    collectionHref: "/epitope",
    browse: "Browse epitopes",
    page: (epitopeId) =>
      EpitopePage({ params: Promise.resolve({ epitopeId }), searchParams: Promise.resolve({}) }),
    metadata: (epitopeId) => epitopeMetadata({ params: Promise.resolve({ epitopeId }) }),
  },
  {
    name: "Experiment",
    id: "00042",
    collectionHref: "/experiment",
    browse: "Browse experiments",
    page: (experimentId) =>
      ExperimentPage({
        params: Promise.resolve({ experimentId }),
        searchParams: Promise.resolve({}),
      }),
    metadata: (experimentId) => experimentMetadata({ params: Promise.resolve({ experimentId }) }),
  },
];

describe.each(pages)("$name record page during a data-service outage", (record) => {
  it("renders the shell with the cause and a Retry instead of throwing", async () => {
    server.use(http.get(`${dataApiUrl}/*`, () => maintenancePage()));

    render(await record.page(record.id));

    const title = `${record.name} ${record.id}`;
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Overview/ }).length).toBeGreaterThan(0);
    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByRole("heading", { name: `${title} could not be loaded` }),
    ).toBeInTheDocument();
    expect(alert).toHaveTextContent(
      /The BV-BRC data service is unavailable \(HTTP 503 Service Unavailable: Site Maintenance/,
    );
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(within(alert).getByRole("link", { name: record.browse })).toHaveAttribute(
      "href",
      record.collectionHref,
    );
  });

  it("names the unreachable host for a connect timeout", async () => {
    server.use(
      http.get(`${dataApiUrl}/*`, () => {
        throw connectTimeout();
      }),
    );

    render(await record.page(record.id));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/did not respond \(connection timed out after 10 s\)/);
    expect(alert).not.toHaveTextContent("fetch failed");
  });

  it("falls back to a static document title", async () => {
    server.use(http.get(`${dataApiUrl}/*`, () => maintenancePage()));

    await expect(record.metadata(record.id)).resolves.toEqual({
      title: `${record.id} | ${record.name}`,
    });
  });

  it("keeps notFound() for a 404 and for an inaccessible record", async () => {
    for (const status of [401, 403, 404]) {
      server.use(
        http.get(`${dataApiUrl}/*`, () =>
          HttpResponse.json({ message: "no" }, { status }),
        ),
      );
      await expect(record.page(record.id)).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });
});
