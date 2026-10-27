import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { setTestSession } from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import { maintenancePage } from "@/test-helpers/upstream-failures";

import { TaxonGenomeCount } from "../taxon-genome-count";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

describe("TaxonGenomeCount", () => {
  it("shows the non-Deprecated genome count", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json({ response: { numFound: 1617890, docs: [] } }),
      ),
    );

    render(await TaxonGenomeCount({ taxonId: 11320 }));

    expect(screen.getByText("(1,617,890 Genomes)")).toBeInTheDocument();
  });

  it("counts the signed-in user's private genomes, as the Genomes tab does", async () => {
    setTestSession({ token: "user-token", userId: "chrescobar" });
    const authorizations: (string | null)[] = [];
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        authorizations.push(request.headers.get("authorization"));
        return HttpResponse.json({ response: { numFound: 1906, docs: [] } });
      }),
    );

    render(await TaxonGenomeCount({ taxonId: 234 }));

    expect(authorizations).toEqual(["user-token"]);
    expect(screen.getByText("(1,906 Genomes)")).toBeInTheDocument();
  });

  it("counts anonymously when signed out", async () => {
    const authorizations: (string | null)[] = [];
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        authorizations.push(request.headers.get("authorization"));
        return HttpResponse.json({ response: { numFound: 1896, docs: [] } });
      }),
    );

    render(await TaxonGenomeCount({ taxonId: 234 }));

    expect(authorizations).toEqual([null]);
    expect(screen.getByText("(1,896 Genomes)")).toBeInTheDocument();
  });

  it("shows nothing for a taxon without genomes", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json({ response: { numFound: 0, docs: [] } }),
      ),
    );

    expect(await TaxonGenomeCount({ taxonId: 11320 })).toBeNull();
  });

  it("leaves a failed count out and logs its cause", async () => {
    server.use(http.get(`${baseUrl}/genome/`, () => maintenancePage()));

    expect(await TaxonGenomeCount({ taxonId: 11320 })).toBeNull();
    expect(console.error).toHaveBeenCalledWith(
      "taxonomy/11320: genome count failed",
      expect.objectContaining({ message: expect.stringMatching(/503/) as unknown }),
    );
  });
});
