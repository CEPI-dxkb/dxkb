import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import {
  fetchBacterialTreeXml,
  fetchTreeXml,
  fetchViralFamilyBlock,
  resolvePhylogenyUrl,
} from "../phylogeny";

const origin = "https://www.bv-brc.org";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("phylogeny services", () => {
  it("allows tree bodies longer to download than metadata", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const familyUrl = `${origin}/api/content/phyloxml_trees/families/2955291/2955291.json`;
    const treeUrl = `${origin}/tree.xml`;
    server.use(
      http.get(familyUrl, () => HttpResponse.json({ groups: [] })),
      http.get(treeUrl, () => new HttpResponse("<phyloxml />")),
    );

    await fetchViralFamilyBlock(2955291);
    await fetchTreeXml(treeUrl);

    expect(timeout).toHaveBeenNthCalledWith(1, 2000);
    expect(timeout).toHaveBeenNthCalledWith(2, 30_000);
  });

  const treeFileUrl = `${origin}/api/content/bvbrc_phylogeny_tab/phyloxml/ecoli.xml`;
  const treeLookupUrl = "/api/phylogeny/bacterial-trees/:taxonId";

  it("distinguishes a missing bacterial tree from a failed request", async () => {
    const requests: Request[] = [];
    server.use(
      http.get(treeLookupUrl, ({ request }) => {
        requests.push(request);
        return HttpResponse.json({ filename: null });
      }),
    );

    await expect(fetchBacterialTreeXml(2)).resolves.toBeNull();
    expect(requests).toHaveLength(1);
    expect(new URL(requests[0].url).pathname).toBe(
      "/api/phylogeny/bacterial-trees/2",
    );
    expect(requests[0].headers.get("Accept")).toBe("application/json");
  });

  it("fetches the bacterial tree the server names", async () => {
    server.use(
      http.get(treeLookupUrl, ({ params }) =>
        params.taxonId === "562"
          ? HttpResponse.json({ filename: "ecoli.xml" })
          : new HttpResponse("unexpected", { status: 404 }),
      ),
      http.get(
        treeFileUrl,
        () =>
          new HttpResponse("<phyloxml />", {
            headers: { "Content-Type": "application/xml" },
          }),
      ),
    );

    await expect(fetchBacterialTreeXml(562)).resolves.toBe("<phyloxml />");
  });

  it("keeps the server's error message", async () => {
    server.use(
      http.get(treeLookupUrl, () =>
        HttpResponse.json(
          {
            error: "tree dictionary: 503 Service Unavailable",
            code: "upstream_error",
          },
          { status: 502 },
        ),
      ),
    );

    await expect(fetchBacterialTreeXml(562)).rejects.toThrow(
      "tree dictionary: 503 Service Unavailable",
    );
  });

  it("refuses a tree filename that leaves the content origin", async () => {
    server.use(
      http.get(treeLookupUrl, () =>
        HttpResponse.json({ filename: "https://example.org/tree.xml" }),
      ),
    );

    await expect(fetchBacterialTreeXml(562)).rejects.toThrow(
      "tree dictionary returned an unsafe URL",
    );
  });

  it("validates and normalizes a viral family block", async () => {
    const url = `${origin}/api/content/phyloxml_trees/families/2955291/2955291.json`;
    server.use(http.get(url, () => HttpResponse.json({
      order: ["flu"],
      groups: [{ key: "flu", title: "Influenza", archaeopteryx: [{ name: "HA", path: "/tree.xml" }] }],
    })));
    expect(await fetchViralFamilyBlock(2955291)).toEqual({
      order: ["flu"],
      groups: [{ key: "flu", title: "Influenza", archaeopteryx: [{ name: "HA", path: "/tree.xml" }], nextstrain: undefined }],
    });
  });

  it("parses absent, empty, populated, and malformed viewer arrays", async () => {
    const url = `${origin}/api/content/phyloxml_trees/families/2955291/2955291.json`;
    server.use(http.get(url, () => HttpResponse.json({
      groups: [
        { key: "missing", title: "Missing", archaeopteryx: [{ name: "XML", path: "/tree.xml" }] },
        { key: "empty", title: "Empty", archaeopteryx: [], nextstrain: [] },
        {
          key: "mixed",
          title: "Mixed",
          archaeopteryx: [{ name: "XML", path: "/mixed.xml" }, { bad: true }],
          nextstrain: [
            { name: "Auspice", path: "Influenza-A-Virus/H3N2/HA" },
            { name: "Missing path" },
          ],
        },
        { key: "nextstrain", title: "Nextstrain only", nextstrain: [{ name: "Tree", path: "Orthoebolavirus/100" }] },
        { key: "invalid-array", title: "Invalid array", nextstrain: {} },
      ],
    })));

    expect(await fetchViralFamilyBlock(2955291)).toEqual({
      groups: [
        {
          key: "missing",
          title: "Missing",
          archaeopteryx: [{ name: "XML", path: "/tree.xml" }],
          nextstrain: undefined,
        },
        {
          key: "mixed",
          title: "Mixed",
          archaeopteryx: [{ name: "XML", path: "/mixed.xml" }],
          nextstrain: [{ name: "Auspice", path: "Influenza-A-Virus/H3N2/HA" }],
        },
        {
          key: "nextstrain",
          title: "Nextstrain only",
          archaeopteryx: undefined,
          nextstrain: [{ name: "Tree", path: "Orthoebolavirus/100" }],
        },
      ],
    });
  });

  it("resolves only same-origin HTTPS tree URLs", () => {
    expect(resolvePhylogenyUrl("/tree.xml")).toBe(`${origin}/tree.xml`);
    expect(resolvePhylogenyUrl("https://example.com/tree.xml")).toBeNull();
    expect(resolvePhylogenyUrl("http://www.bv-brc.org/tree.xml")).toBeNull();
    expect(resolvePhylogenyUrl("javascript:alert(1)")).toBeNull();
  });
});
