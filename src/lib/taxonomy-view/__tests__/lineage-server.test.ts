// `server-only` throws outside Next's bundler; the data repository reaches it.
vi.mock("server-only", () => ({}));

import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";

import { loadLineageCrumbs } from "../lineage-server";

beforeEach(() => {
  process.env.DATA_API_URL = "https://data.test";
});

afterEach(() => {
  delete process.env.DATA_API_URL;
});

describe("loadLineageCrumbs", () => {
  it("reads the whole taxonomy record, so lineage_ranks is never projected away", async () => {
    const urls: string[] = [];
    server.use(
      http.get("https://data.test/taxonomy/", ({ request }) => {
        urls.push(decodeURIComponent(request.url));
        return HttpResponse.json([
          {
            taxon_id: 83333,
            taxon_name: "Escherichia coli K-12",
            lineage_ids: [1224, 562, 83333],
            lineage_names: ["Pseudomonadota", "Escherichia coli", "K-12"],
            lineage_ranks: ["phylum", "species", "strain"],
          },
        ]);
      }),
    );

    const crumbs = await loadLineageCrumbs("83333", "genome/1.1");

    expect(urls).toHaveLength(1);
    // A `select(...)` clause would drop any field it leaves out.
    expect(urls[0]).not.toContain("select(");
    expect(crumbs.map(({ name }) => name)).toEqual([
      "Pseudomonadota",
      "Escherichia coli",
    ]);
  });
});
