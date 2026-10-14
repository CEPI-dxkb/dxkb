import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";

vi.mock("@/components/footers/footer", () => ({
  default: () => <footer>Site footer</footer>,
}));

import { SearchResults } from "../all-term-search-results";
import { server } from "@/test-helpers/msw-server";
import {
  createQueryClientWrapper,
  createUiPreferencesWrapper,
} from "@/test-helpers/react";

const dataApi = "https://p3.theseed.org/services/data_api";

type Doc = Record<string, unknown>;
type Payload = Partial<Record<string, { dataType: string; query: string }>>;

function solr(docs: Doc[], numFound = docs.length) {
  return { result: { response: { docs, numFound } } };
}

const influenzaA = {
  taxon_id: "11320",
  taxon_name: "Influenza A virus",
  taxon_rank: "species",
  genomes: 1_900_000,
  lineage_names: [
    "Viruses",
    "Riboviria",
    "Orthornavirae",
    "Negarnaviricota",
    "Insthoviricetes",
    "Articulavirales",
    "Orthomyxoviridae",
    "Alphainfluenzavirus",
    "Influenza A virus",
  ],
};

/** Taxa, Genomes and Experiments match; nothing else does. */
const influenzaMatches = {
  taxonomy: solr(
    [
      influenzaA,
      { taxon_id: "11520", taxon_name: "Influenza B virus", genomes: 42 },
    ],
    2,
  ),
  genome: solr(
    [
      {
        genome_id: "11320.1",
        genome_name: "Influenza A virus A/Ohio/1/2020",
        host_name: "Human",
        isolation_country: "USA",
        collection_year: 2020,
      },
    ],
    12,
  ),
  experiment: solr([{ exp_id: "00042", exp_title: "RNA response" }]),
  epitope: solr([], 0),
};

function respondWith(
  body: Record<string, unknown>,
  onRequest?: (payload: Payload) => void,
) {
  server.use(
    http.post(`${dataApi}/query/`, async ({ request }) => {
      onRequest?.((await request.json()) as Payload);
      return HttpResponse.json(body);
    }),
  );
}

function renderResults(
  query: string,
  props: Partial<Parameters<typeof SearchResults>[0]> = {},
) {
  const Queries = createQueryClientWrapper();
  const Preferences = createUiPreferencesWrapper();
  return render(<SearchResults query={query} {...props} />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Queries>
        <Preferences>
          <main>{children}</main>
        </Preferences>
      </Queries>
    ),
  });
}

function rail() {
  return within(screen.getByRole("navigation", { name: "Data types" }));
}

async function findRail() {
  return within(
    await screen.findByRole("navigation", { name: "Data types" }),
  );
}

/** The page header (inside `<main>`, so not a landmark). */
function header() {
  const element = screen.getByRole("heading", { level: 1 }).closest("header");
  if (!element) throw new Error("No page header");
  return within(element);
}

describe("SearchResults", () => {
  const scrollTo = vi.fn();
  // Restored exactly as found: jsdom may not define element scrolling at all.
  const ownScrollTo = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollTo",
  );

  beforeEach(() => {
    scrollTo.mockClear();
    Element.prototype.scrollTo = scrollTo;
    // jsdom has no matchMedia; a rail jump reads the motion preference.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: false }),
    });
  });

  afterEach(() => {
    if (ownScrollTo)
      Object.defineProperty(Element.prototype, "scrollTo", ownScrollTo);
    else Reflect.deleteProperty(Element.prototype, "scrollTo");
    Reflect.deleteProperty(window, "matchMedia");
  });

  it("searches only the DXKB data types, ten rows each, Taxa by genome count", async () => {
    let payload: Payload = {};
    respondWith(influenzaMatches, (body) => {
      payload = body;
    });

    renderResults("influenza");

    await screen.findByRole("heading", { name: "Experiments" });
    expect(Object.keys(payload)).toEqual([
      "taxonomy",
      "genome",
      "strain",
      "genome_feature",
      "protein_feature",
      "epitope",
      "protein_structure",
      "surveillance",
      "serology",
      "experiment",
    ]);
    expect(payload.taxonomy?.query).toMatch(
      /&gt\(genomes,1\)&limit\(10\)&sort\(-genomes\)$/,
    );
    expect(payload.genome?.query).toMatch(/&limit\(10\)&sort\(-score\)$/);
    expect(payload.genome_feature?.query).toMatch(
      /&ne\(annotation,brc1\)&ne\(feature_type,source\)&limit\(10\)&sort\(\+annotation,-score\)$/,
    );
  });

  it("shows a card for each type with matches, and greys out the rest in the rail", async () => {
    respondWith(influenzaMatches);

    renderResults("influenza");

    expect(
      await screen.findByText("15 records across 3 data types"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["Data types", "Taxa", "Genomes", "Experiments"]);
    expect(rail().getByRole("button", { name: /Genomes/ })).toHaveTextContent(
      "12",
    );
    expect(rail().getByLabelText("Epitopes: No matches")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Genomes" }),
    ).toHaveAttribute("href", "/genome?keyword=influenza");
  });

  it("leads with the best-matching taxon and links into its views", async () => {
    respondWith(influenzaMatches);
    const user = userEvent.setup();

    renderResults("influenza");

    await screen.findByRole("heading", { name: "Taxa" });
    expect(header().getByText(/1,900,000 genomes/)).toHaveTextContent(
      "1,900,000 genomes · Species · Taxon ID 11320",
    );
    expect(header().getByText("Orthomyxoviridae")).toBeInTheDocument();
    expect(
      header().getByRole("link", { name: /Open taxon view/ }),
    ).toHaveAttribute("href", "/taxonomy/11320");

    await user.click(header().getByRole("button", { name: /Explore taxon/ }));
    expect(
      await screen.findByRole("menuitem", { name: "Genomes" }),
    ).toHaveAttribute("href", "/taxonomy/11320?tab=genomes");
    // A tab only some taxa have would land on the Overview.
    expect(
      screen.queryByRole("menuitem", { name: "Strains" }),
    ).not.toBeInTheDocument();
  });

  it("links results to their member pages without coercing IDs", async () => {
    respondWith(influenzaMatches);

    renderResults("influenza");

    expect(
      await screen.findByRole("link", { name: "Influenza B virus" }),
    ).toHaveAttribute("href", "/taxonomy/11520");
    expect(
      screen.getByRole("link", { name: "Influenza A virus A/Ohio/1/2020" }),
    ).toHaveAttribute("href", "/genome/11320.1");
    expect(screen.getByRole("link", { name: "RNA response" })).toHaveAttribute(
      "href",
      "/experiment/00042",
    );
  });

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
      let payload: Payload = {};
      respondWith({ genome_feature: solr([], 4) }, (body) => {
        payload = body;
      });

      renderResults(query);

      expect(
        await screen.findByRole("link", { name: "Features" }),
      ).toHaveAttribute("href", expectedHref);
      expect(payload.genome_feature?.query.split("&")[0]).toBe(expectedRql);
    },
  );

  it.each(['""', "OR", ":/"])(
    "sends no search for %j, which has no terms",
    async (query) => {
      // `""` would become and(), which the Data API rejects with HTTP 500.
      const requested = vi.fn();
      respondWith({}, requested);

      renderResults(query);

      expect(await screen.findByText("No results found")).toBeInTheDocument();
      expect(requested).not.toHaveBeenCalled();
    },
  );

  it("says so when nothing matches", async () => {
    respondWith({ taxonomy: solr([], 0), genome: solr([], 0) });

    renderResults("zzznoresults");

    expect(await screen.findByText("No results found")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Collapse all" }),
    ).not.toBeInTheDocument();
  });

  it("shows the request's own error when the search fails", async () => {
    server.use(
      http.post(`${dataApi}/query/`, () =>
        HttpResponse.json({}, { status: 502 }),
      ),
    );

    renderResults("influenza");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Search request failed with status 502",
    );
    expect(
      screen.queryByRole("navigation", { name: "Data types" }),
    ).not.toBeInTheDocument();
  });

  // The top results can share a genome ("kinase" returns two of genome
  // 2993654.5's features), and one protein can have many structures.
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
    [
      "protein_structure",
      [
        { genome_id: "83332.12", pdb_id: "1ABC", title: "First kinase" },
        { genome_id: "83332.12", pdb_id: "2DEF", title: "Second kinase" },
      ],
    ],
  ])("keys %s results by their own ID", async (dataType, docs) => {
    respondWith({ [dataType]: solr(docs) });

    renderResults("kinase");

    expect(await screen.findByText("First kinase")).toBeInTheDocument();
    expect(screen.getByText("Second kinase")).toBeInTheDocument();
    const consoleErrors = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(consoleErrors).not.toContain("same key");
  });

  it("shows a type's five more rows without another request", async () => {
    let requests = 0;
    respondWith(
      {
        genome: solr(
          Array.from({ length: 10 }, (_, index) => ({
            genome_id: `11320.${String(index + 1)}`,
            genome_name: `Genome ${String(index + 1)}`,
          })),
          12,
        ),
      },
      () => {
        requests += 1;
      },
    );
    const user = userEvent.setup();

    renderResults("influenza");

    // Collapsed, not left out: the rows still size the table's columns.
    const sixth = (await screen.findByText("Genome 6")).closest("tr");
    expect(sixth).toHaveAttribute("inert");
    expect(sixth).toHaveClass("collapse");
    expect(screen.getByText("Genome 5").closest("tr")).not.toHaveAttribute(
      "inert",
    );

    await user.click(
      screen.getByRole("button", { name: "Show 5 more genomes" }),
    );
    expect(sixth).not.toHaveAttribute("inert");
    expect(screen.getByText("Genome 10").closest("tr")).not.toHaveClass(
      "collapse",
    );

    await user.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(sixth).toHaveAttribute("inert");
    expect(requests).toBe(1);
  });

  it("moves between the shown results with the arrow keys", async () => {
    respondWith({
      genome: solr(
        Array.from({ length: 6 }, (_, index) => ({
          genome_id: `11320.${String(index + 1)}`,
          genome_name: `Genome ${String(index + 1)}`,
        })),
      ),
      experiment: solr([{ exp_id: "00042", exp_title: "RNA response" }]),
    });
    const user = userEvent.setup();

    renderResults("influenza");

    (await screen.findByText("Genome 5")).focus();
    await user.keyboard("{ArrowDown}");
    // Past the collapsed sixth genome, to the next type's first result.
    expect(screen.getByText("RNA response")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByText("Genome 5")).toHaveFocus();

    // From a type's heading link or fold button, to the nearest result.
    const heading = screen.getByRole("heading", { name: "Experiments" });
    within(heading).getByRole("link").focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByText("Genome 5")).toHaveFocus();
    screen.getByRole("button", { name: "Collapse Experiments" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("RNA response")).toHaveFocus();

    // From "Show more", not back to the top of its type.
    const showMore = screen.getByRole("button", { name: "Show 1 more genomes" });
    showMore.focus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByText("Genome 5")).toHaveFocus();
    showMore.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("RNA response")).toHaveFocus();

    // With no result that way, the key is left to scroll the page.
    expect(
      fireEvent.keyDown(screen.getByText("RNA response"), { key: "ArrowDown" }),
    ).toBe(true);
  });

  it("folds a type to its header, and all of them at once", async () => {
    respondWith(influenzaMatches);
    const user = userEvent.setup();

    renderResults("influenza");

    await user.click(
      await screen.findByRole("button", { name: "Collapse Genomes" }),
    );
    expect(
      screen.queryByRole("link", { name: "Influenza A virus A/Ohio/1/2020" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Expand Genomes" }),
    ).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryAllByRole("table")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Expand all" }));
    expect(screen.getAllByRole("table")).toHaveLength(3);
  });

  it("jumps to a type from the rail, opening it if folded", async () => {
    respondWith(influenzaMatches);
    const user = userEvent.setup();

    renderResults("influenza");

    await user.click(
      await screen.findByRole("button", { name: "Collapse Experiments" }),
    );
    await user.click(rail().getByRole("button", { name: /Experiments/ }));

    expect(
      await screen.findByRole("link", { name: "RNA response" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: "smooth" }),
      );
    });
    expect(rail().getByRole("button", { name: /Experiments/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(document.getElementById("search-experiment")).toHaveAttribute(
      "data-flash",
    );
  });

  it("scrolls one area, the header pinned at its top and the footer spanning its end", async () => {
    respondWith(influenzaMatches);
    const user = userEvent.setup();

    renderResults("influenza");
    const rail = await findRail();

    const area = screen.getByRole("main").firstElementChild;
    expect(area?.lastElementChild).toBe(screen.getByText("Site footer"));
    const pinned = screen.getByRole("heading", { level: 1 }).closest(".sticky");
    expect(pinned).not.toBeNull();
    // A jump stops the section below the pinned header.
    Object.defineProperty(pinned, "offsetHeight", { value: 150 });
    const genomes = document.getElementById("search-genome");
    if (genomes) genomes.getBoundingClientRect = () => ({ top: 600 }) as DOMRect;

    await user.click(rail.getByRole("button", { name: /Genomes/ }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 450, behavior: "smooth" });
    expect(scrollTo.mock.contexts).toContain(area);
  });

  it("raises the pinned header once results scroll under it", async () => {
    respondWith(influenzaMatches);

    renderResults("influenza");
    await findRail();

    const area = screen.getByRole("main").firstElementChild;
    const header = screen.getByRole("heading", { level: 1 }).closest("header");
    if (!area) throw new Error("No scroll area");
    expect(header).not.toHaveClass("shadow-md");
    area.scrollTop = 200;
    fireEvent.scroll(area);
    expect(header).toHaveClass("shadow-md");
    area.scrollTop = 0;
    fireEvent.scroll(area);
    expect(header).not.toHaveClass("shadow-md");
  });

  it("lets the header scroll away when it is not pinned", async () => {
    respondWith(influenzaMatches);
    const user = userEvent.setup();

    renderResults("influenza", { pinnedHeader: false });
    const rail = await findRail();

    expect(
      screen.getByRole("heading", { level: 1 }).closest(".sticky"),
    ).toBeNull();
    const genomes = document.getElementById("search-genome");
    if (genomes) genomes.getBoundingClientRect = () => ({ top: 600 }) as DOMRect;

    await user.click(rail.getByRole("button", { name: /Genomes/ }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 584, behavior: "smooth" });
  });
});
