import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { SearchResults } from "../all-term-search-results";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

const dataApi = "https://p3.theseed.org/services/data_api";

describe("SearchResults", () => {
  it("links Taxonomy results to canonical members", async () => {
    server.use(
      http.post(`${dataApi}/query/`, () =>
        HttpResponse.json({
          taxonomy: {
            result: {
              response: {
                docs: [{ taxon_id: "11520", taxon_name: "Influenza A virus", genomes: 42 }],
                numFound: 1,
                maxScore: 1,
                numFoundExact: true,
              },
            },
          },
        }),
      ),
    );
    render(<SearchResults query="influenza" />, {
      wrapper: createQueryClientWrapper(),
    });
    expect(
      await screen.findByRole("link", { name: /Influenza A virus/ }),
    ).toHaveAttribute("href", "/taxonomy/11520");
  });

  it("links Experiment results without coercing digit strings", async () => {
    server.use(
      http.post(`${dataApi}/query/`, () =>
        HttpResponse.json({
          experiment: {
            result: {
              response: {
                docs: [{ exp_id: "00042", exp_title: "RNA response" }],
                numFound: 1,
                maxScore: 1,
                numFoundExact: true,
              },
            },
          },
        }),
      ),
    );
    render(<SearchResults query="RNA" />, { wrapper: createQueryClientWrapper() });
    expect(await screen.findByRole("link", { name: /00042/ })).toHaveAttribute(
      "href",
      "/experiment/00042",
    );
  });

  it("uses pdb_id to distinguish protein structures for the same genome", async () => {
    server.use(
      http.post(`${dataApi}/query/`, () =>
        HttpResponse.json({
          protein_structure: {
            result: {
              response: {
                docs: [
                  {
                    genome_id: "83332.12",
                    patric_id: "fig|83332.12.peg.1",
                    pdb_id: "1ABC",
                    title: "First structure",
                  },
                  {
                    genome_id: "83332.12",
                    patric_id: "fig|83332.12.peg.1",
                    pdb_id: "2DEF",
                    title: "Second structure",
                  },
                ],
                numFound: 2,
                maxScore: 1,
                numFoundExact: true,
              },
            },
          },
        }),
      ),
    );

    render(<SearchResults query="structure" />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(await screen.findByText(/First structure/)).toBeInTheDocument();
    expect(screen.getByText(/Second structure/)).toBeInTheDocument();
    await waitFor(() => {
      const consoleErrors = vi.mocked(console.error).mock.calls.flat().join(" ");
      expect(consoleErrors).not.toContain("same key");
    });
  });

  // An unprojected Genome Sequence doc carries its whole `sequence`: three
  // preview rows for "Bacillus" were 12.4 MB of the 12.4 MB response.
  it.each([
    // Legacy's search box quotes an id-like word: keyword("Rv0001") is 4
    // features, keyword(Rv0001) 341,272.
    ["Rv0001", "keyword(%22Rv0001%22)", "/feature?keyword=%22Rv0001%22"],
    [
      "kinase not hypothetical",
      "and(keyword(kinase),not(keyword(hypothetical)))",
      "/feature?keyword=kinase+NOT+hypothetical",
    ],
    // A quote left open closes at the end of the text, as a list's keyword box
    // closes it: the phrase, 16,285,620 PATRIC features, not the 22,504,678
    // that match the words apart.
    [
      '"DNA polymerase',
      "keyword(%22DNA%20polymerase%22)",
      "/feature?keyword=%22DNA+polymerase%22",
    ],
  ])(
    "counts %j as the list it links to searches",
    async (query, expectedRql, expectedHref) => {
      let payload: Partial<Record<string, { query: string }>> = {};
      server.use(
        http.post(`${dataApi}/query/`, async ({ request }) => {
          payload = (await request.json()) as typeof payload;
          return HttpResponse.json({
            genome_feature: {
              result: {
                response: {
                  docs: [],
                  numFound: 4,
                  maxScore: 1,
                  numFoundExact: true,
                },
              },
            },
          });
        }),
      );

      render(<SearchResults query={query} />, {
        wrapper: createQueryClientWrapper(),
      });

      expect(
        await screen.findByRole("link", { name: "Features" }),
      ).toHaveAttribute("href", expectedHref);
      expect(payload.genome_feature?.query.split("&")[0]).toBe(expectedRql);
    },
  );

  it.each(['""', "OR", ":/"])("sends no search for %j, which has no terms", async (query) => {
    // `""` would become and(), which the Data API rejects with HTTP 500.
    const requested = vi.fn();
    server.use(
      http.post(`${dataApi}/query/`, () => {
        requested();
        return HttpResponse.json({});
      }),
    );

    render(<SearchResults query={query} />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(await screen.findByText("No results found")).toBeInTheDocument();
    expect(requested).not.toHaveBeenCalled();
  });

  it("requests only the displayed Genome Sequence fields", async () => {
    let payload: Partial<Record<string, { query: string }>> = {};
    server.use(
      http.post(`${dataApi}/query/`, async ({ request }) => {
        payload = (await request.json()) as typeof payload;
        return HttpResponse.json({});
      }),
    );

    render(<SearchResults query="Bacillus" />, {
      wrapper: createQueryClientWrapper(),
    });

    await waitFor(() => {
      expect(payload.genome_sequence?.query).toMatch(
        /&select\(sequence_id,genome_id,genome_name,accession,description\)$/,
      );
    });
  });

  it("uses sequence_id to distinguish sequences of the same genome", async () => {
    server.use(
      http.post(`${dataApi}/query/`, () =>
        HttpResponse.json({
          genome_sequence: {
            result: {
              response: {
                docs: [
                  {
                    genome_id: "1408.861",
                    sequence_id: "1408.861.con.0001",
                    genome_name: "Bacillus pumilus",
                    accession: "CP000001",
                  },
                  {
                    genome_id: "1408.861",
                    sequence_id: "1408.861.con.0002",
                    genome_name: "Bacillus pumilus",
                    accession: "CP000002",
                  },
                ],
                numFound: 2,
                maxScore: 1,
                numFoundExact: true,
              },
            },
          },
        }),
      ),
    );

    render(<SearchResults query="Bacillus" />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(await screen.findByText(/CP000001/)).toBeInTheDocument();
    expect(screen.getByText(/CP000002/)).toBeInTheDocument();
    await waitFor(() => {
      const consoleErrors = vi.mocked(console.error).mock.calls.flat().join(" ");
      expect(consoleErrors).not.toContain("same key");
    });
  });

  // A Feature doc has no `id`, and the preview's top features can share a
  // genome: "kinase" returns two of genome 2993654.5's among its three.
  it.each([
    [
      "genome_feature",
      [
        {
          feature_id: "PATRIC.2993654.5.NZ_CP110845.CDS.3630673.3632691.rev",
          patric_id: "fig|2993654.5.peg.3197",
          genome_id: "2993654.5",
          product: "First kinase",
        },
        {
          feature_id: "PATRIC.2993654.5.NZ_CP110845.CDS.4861332.4862867.rev",
          patric_id: "fig|2993654.5.peg.4297",
          genome_id: "2993654.5",
          product: "Second kinase",
        },
      ],
    ],
    [
      "experiment",
      [
        { exp_id: "103660", genome_id: ["511145.12"], exp_name: "First kinase" },
        { exp_id: "98862", genome_id: ["511145.12"], exp_name: "Second kinase" },
      ],
    ],
  ])("keys %s results by their own ID, not their genome", async (dataType, docs) => {
    server.use(
      http.post(`${dataApi}/query/`, () =>
        HttpResponse.json({
          [dataType]: {
            result: {
              response: {
                docs,
                numFound: 2,
                maxScore: 1,
                numFoundExact: true,
              },
            },
          },
        }),
      ),
    );

    render(<SearchResults query="kinase" />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(await screen.findByText(/First kinase/)).toBeInTheDocument();
    expect(screen.getByText(/Second kinase/)).toBeInTheDocument();
    const consoleErrors = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(consoleErrors).not.toContain("same key");
  });
});
