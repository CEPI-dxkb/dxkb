import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { SearchResults } from "../all-term-search-results";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

const dataApi = "https://p3.theseed.org/services/data_api";

describe("SearchResults", () => {
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
});
