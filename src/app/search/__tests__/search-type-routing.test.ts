import { searchDescriptors, type SearchType } from "@/constants/search-info";
import { resolveLegacySearch } from "../search-type-routing";
import { searchTypeMenuItems } from "../typesearch";

const canonicalDescriptors = searchDescriptors.filter(
  (descriptor) => descriptor.route.status === "canonical",
);

/** The redirect href for a legacy request, or a failure naming what happened instead. */
function redirectHref(
  params: Record<string, string | string[] | undefined>,
  query: string,
): string {
  const target = resolveLegacySearch(params, query);
  if (target.kind !== "redirect") {
    throw new Error(`Expected a redirect, resolved to "${target.kind}"`);
  }
  return target.href;
}

describe("legacy search routing contract", () => {
  it.each(searchTypeMenuItems.map((item) => item.key))(
    "resolves the %s menu item to a destination instead of a fallback",
    (key) => {
      const target = resolveLegacySearch(
        { type: key, q: "influenza" },
        "influenza",
      );
      expect(["redirect", "typeSearch"]).toContain(target.kind);
    },
  );

  it.each(canonicalDescriptors)(
    "redirects the canonical $id descriptor to its own segment",
    (descriptor: SearchType) => {
      if (descriptor.route.status !== "canonical") throw new Error("not canonical");
      const url = new URL(
        redirectHref({ type: descriptor.id, q: "influenza" }, "influenza"),
        "https://example.test",
      );
      expect(url.pathname).toBe(`/${descriptor.route.segment}`);
      expect(url.searchParams.get("keyword")).toBe("influenza");
      for (const [name, value] of Object.entries(descriptor.route.params ?? {})) {
        expect(url.searchParams.get(name)).toBe(value);
      }
    },
  );

  it.each(["overview", "phylogeny", "sp_gene", "pathway", "subsystem"])(
    "keeps the destination-less %s entry out of the type menu",
    (key) => {
      expect(searchTypeMenuItems.map((item) => item.key)).not.toContain(key);
    },
  );

  it("preserves repeated filters, tab, page, and sort across the redirect", () => {
    expect(
      redirectHref(
        {
          type: "genome",
          q: "influenza",
          genome_status: ["Complete", "WGS"],
          page: "3",
          sort: "genome_name:asc",
          tab: "genome",
        },
        "influenza",
      ),
    ).toBe(
      "/genome?keyword=influenza&genome_status=Complete&genome_status=WGS&page=3&sort=genome_name%3Aasc&tab=genome",
    );
  });

  it("merges descriptor defaults without clobbering an explicit value", () => {
    expect(redirectHref({ type: "protein", q: "kinase" }, "kinase")).toBe(
      "/feature?keyword=kinase&filter=protein",
    );
    expect(
      redirectHref({ type: "protein", q: "kinase", filter: "custom" }, "kinase"),
    ).toBe("/feature?keyword=kinase&filter=custom");
  });

  it("carries an incoming keyword only when the legacy q is absent", () => {
    expect(redirectHref({ type: "genome", keyword: "influenza" }, "")).toBe(
      "/genome?keyword=influenza",
    );
    expect(
      redirectHref({ type: "genome", q: "flu", keyword: "influenza" }, "flu"),
    ).toBe("/genome?keyword=flu");
  });

  it("drops the legacy route's own type parameter", () => {
    expect(redirectHref({ type: "genome" }, "")).toBe("/genome");
  });

  it.each(["bioset", "experiment"])(
    "normalizes the Biosets tab for the %s type",
    (type) => {
      expect(redirectHref({ type, q: "RNA", tab: "bioset" }, "RNA")).toBe(
        "/experiment?keyword=RNA&tab=biosets",
      );
    },
  );

  it("leaves a bioset tab marker alone for other types", () => {
    expect(redirectHref({ type: "genome", tab: "bioset" }, "")).toBe(
      "/genome?tab=bioset",
    );
  });

  it("narrows the Taxa redirect to parameters the Taxa route parses", () => {
    expect(
      redirectHref(
        {
          type: "taxonomy",
          q: "influenza",
          taxon_id: ["10239", "11308"],
          taxon_rank: "species",
          refine: "H5N1",
          ignored: "value",
        },
        "influenza",
      ),
    ).toBe(
      "/taxonomy?keyword=influenza&taxon_id=10239&taxon_id=11308&taxon_rank=species&refine=H5N1",
    );
  });

  it("resolves Overview explicitly instead of falling through", () => {
    expect(resolveLegacySearch({ q: "influenza" }, "influenza")).toEqual({
      kind: "allTypes",
    });
    expect(resolveLegacySearch({}, "")).toEqual({ kind: "prompt" });
    expect(resolveLegacySearch({ type: "everything" }, "influenza")).toEqual({
      kind: "allTypes",
    });
  });

  it.each(["genome_sequence", "genome_amr"])(
    "keeps %s on the legacy type search",
    (type) => {
      expect(resolveLegacySearch({ type, q: "influenza" }, "influenza")).toEqual(
        { kind: "typeSearch", searchtype: type },
      );
    },
  );

  it.each(["sp_gene", "pathway", "subsystem", "antibiotics", "not_a_type"])(
    "reports %s as unsupported rather than rendering an unrelated type",
    (type) => {
      expect(resolveLegacySearch({ type, q: "influenza" }, "influenza")).toEqual({
        kind: "unsupported",
        searchtype: type,
      });
    },
  );
});
