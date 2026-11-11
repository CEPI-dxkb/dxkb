import { useLayoutEffect } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import type { OrganismTaxonomy } from "@/lib/services/organisms/types";

import { TaxonomyTree } from "../taxonomy-tree";
import type { TaxonRecord } from "../taxon-tree-types";
import * as taxonChildren from "../use-taxon-children";

// useVirtualizer needs ResizeObserver/getBoundingClientRect, which jsdom lacks (0 rows
// rendered); the mock returns every item synchronously.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number;
    estimateSize: () => number;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * estimateSize(),
        size: estimateSize(),
        end: (index + 1) * estimateSize(),
        key: index,
        lane: 0,
      })),
    getTotalSize: () => count * estimateSize(),
    measure: vi.fn(),
  }),
}));

// The tree reads children and child counts from the same-origin /api/taxonomy-tree route.
const childrenPath = "/api/taxonomy-tree/children";
const childCountsPath = "/api/taxonomy-tree/child-counts";

const rootTaxon: OrganismTaxonomy = {
  taxonId: 234,
  taxonName: "Brucella",
  lineageNames: [],
  lineageIds: [],
  taxonRank: "genus",
  genomes: 1909,
};

const virusesRoot: OrganismTaxonomy = {
  taxonId: 10239,
  taxonName: "Viruses",
  lineageNames: ["Viruses"],
  lineageIds: [10239],
  taxonRank: "superkingdom",
  genomes: 890123,
};

function child(
  id: number,
  name: string,
  rank: string,
  genomes: number,
  parentId = rootTaxon.taxonId,
): TaxonRecord {
  return {
    taxon_id: id,
    taxon_name: name,
    taxon_rank: rank,
    parent_id: parentId,
    genomes,
  };
}

const twoRootChildren: Record<number, TaxonRecord[]> = {
  234: [child(235, "Brucella abortus", "species", 581)],
  10239: [
    child(11308, "Orthomyxoviridae", "family", 245000, virusesRoot.taxonId),
  ],
};

// parentId -> rows. A parent with zero children is reported as 0 rather than omitted,
// so `getRowCanExpand` sees no positive count either way.
function mockChildren(byParent: Record<number, TaxonRecord[]>) {
  server.use(
    http.get(childCountsPath, ({ request }) => {
      const ids = new URL(request.url).searchParams
        .getAll("parentId")
        .map(Number);
      return HttpResponse.json({
        counts: Object.fromEntries(
          ids.map((id) => [String(id), (byParent[id] ?? []).length]),
        ),
      });
    }),
    http.get(childrenPath, ({ request }) => {
      const parentId = Number(
        new URL(request.url).searchParams.get("parentId") ?? -1,
      );
      return HttpResponse.json({ rows: byParent[parentId] ?? [] });
    }),
  );
}

afterEach(() => {
  fireEvent.keyUp(document, { key: "Shift" });
  fireEvent.keyUp(document, { key: "Control" });
  fireEvent.keyUp(document, { key: "Meta" });
});

describe("TaxonomyTree", () => {
  it("auto-expands the root one level and lists children by name", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
      ],
    });

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(screen.getByRole("link", { name: "Brucella" })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Brucella abortus" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: "Brucella melitensis" }),
    ).toBeInTheDocument();
  });

  it("renders multiple roots and their children in one table", async () => {
    mockChildren(twoRootChildren);

    render(<TaxonomyTree rootTaxa={[rootTaxon, virusesRoot]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(screen.getByRole("link", { name: "Brucella" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Viruses" })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Brucella abortus" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Orthomyxoviridae" }),
      ).toBeInTheDocument();
    });
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("links a root with a phylogeny to its Phylogeny tab and disables the rest", async () => {
    mockChildren(twoRootChildren);

    render(
      <TaxonomyTree
        rootTaxa={[rootTaxon, virusesRoot]}
        phylogenyTaxonIds={[rootTaxon.taxonId]}
      />,
      { wrapper: createQueryClientWrapper() },
    );

    expect(
      screen.getByRole("link", {
        name: "View phylogenetic tree for Brucella",
      }),
    ).toHaveAttribute("href", "/taxonomy/234?tab=phylogeny");
    expect(
      screen.getByRole("button", { name: "No phylogenetic tree available" }),
    ).toBeDisabled();
    await screen.findByRole("link", { name: "Brucella abortus" });
    expect(
      screen.getAllByRole("link", { name: /View phylogenetic tree/ }),
    ).toHaveLength(1);
  });

  it("keeps a successful root usable when another root fails", async () => {
    server.use(
      http.get(childCountsPath, () => HttpResponse.json({ counts: {} })),
      http.get(childrenPath, ({ request }) => {
        const parentId = new URL(request.url).searchParams.get("parentId");
        if (parentId === "10239") {
          return HttpResponse.json(
            { error: "viral branch unavailable", code: "upstream_error" },
            { status: 502 },
          );
        }
        return HttpResponse.json({
          rows: [child(235, "Brucella abortus", "species", 581)],
        });
      }),
    );

    render(<TaxonomyTree rootTaxa={[rootTaxon, virusesRoot]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(
      await screen.findByRole("link", { name: "Brucella abortus" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /error: taxonomy children 10239: viral branch unavailable/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Brucella" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Viruses" })).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("announces a failed branch with Retry, and retrying loads it", async () => {
    let childrenCalls = 0;
    server.use(
      http.get(childCountsPath, () => HttpResponse.json({ counts: {} })),
      http.get(childrenPath, () => {
        childrenCalls += 1;
        if (childrenCalls === 1) {
          return HttpResponse.json(
            {
              error: "Could not reach the BV-BRC data service: connection refused.",
              code: "service_unavailable",
            },
            { status: 502 },
          );
        }
        return HttpResponse.json({
          rows: [child(235, "Brucella abortus", "species", 581)],
        });
      }),
    );

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load sub-taxa");
    expect(alert).toHaveTextContent(
      "Brucella: taxonomy children 234: Could not reach the BV-BRC data service: connection refused.",
    );

    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("link", { name: "Brucella abortus" }),
    ).toBeInTheDocument();
    expect(childrenCalls).toBe(2);
    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  it("keeps the expand toggle on a failed node after collapse, so expanding again retries", async () => {
    let childrenCalls = 0;
    server.use(
      http.get(childCountsPath, () =>
        HttpResponse.json(
          { error: "The BV-BRC data service did not respond.", code: "upstream_timeout" },
          { status: 504 },
        ),
      ),
      http.get(childrenPath, () => {
        childrenCalls += 1;
        if (childrenCalls === 1) {
          return HttpResponse.json(
            { error: "The BV-BRC data service did not respond.", code: "upstream_timeout" },
            { status: 504 },
          );
        }
        return HttpResponse.json({
          rows: [child(235, "Brucella abortus", "species", 581)],
        });
      }),
    );

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(
      await screen.findByText(/taxonomy children 234: The BV-BRC data service did not respond\./, {
        selector: "td span",
      }),
    ).toBeInTheDocument();
    const rootRow = screen
      .getByRole("link", { name: "Brucella" })
      .closest("tr") as HTMLElement;

    fireEvent.click(within(rootRow).getByRole("button", { name: "Collapse" }));

    expect(
      await screen.findByText(/Sub-taxa counts: .*did not respond/),
    ).toBeInTheDocument();
    const expand = within(rootRow).getByRole("button", { name: "Expand" });

    fireEvent.click(expand);

    expect(
      await screen.findByRole("link", { name: "Brucella abortus" }),
    ).toBeInTheDocument();
    expect(childrenCalls).toBe(2);
  });

  it("keeps the expand toggle on a child whose count could not be loaded", async () => {
    let countCalls = 0;
    server.use(
      http.get(childCountsPath, ({ request }) => {
        countCalls += 1;
        if (countCalls === 1) {
          return HttpResponse.json(
            { error: "The BV-BRC data service did not respond.", code: "upstream_timeout" },
            { status: 504 },
          );
        }
        const ids = new URL(request.url).searchParams.getAll("parentId");
        return HttpResponse.json({
          counts: Object.fromEntries(ids.map((id) => [id, 0])),
        });
      }),
      http.get(childrenPath, () =>
        HttpResponse.json({
          rows: [child(235, "Brucella abortus", "species", 581)],
        }),
      ),
    );

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    const speciesRow = (
      await screen.findByRole("link", { name: "Brucella abortus" })
    ).closest("tr") as HTMLElement;
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Sub-taxa counts: taxonomy child counts: The BV-BRC data service did not respond.",
    );
    expect(
      within(speciesRow).getByRole("button", { name: "Expand" }),
    ).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(
        within(speciesRow).queryByRole("button", { name: "Expand" }),
      ).toBeNull();
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("resets stale roots, selection, and filtering when the root set changes", async () => {
    mockChildren(twoRootChildren);
    const onSelect = vi.fn();
    const { rerender } = render(
      <TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />,
      {
        wrapper: createQueryClientWrapper(),
      },
    );

    const childLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    fireEvent.click(childLink.closest("tr") as HTMLElement);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Brucella" },
    });

    rerender(<TaxonomyTree rootTaxa={[virusesRoot]} phylogenyTaxonIds={[]} onSelect={onSelect} />);

    expect(
      await screen.findByRole("link", { name: "Orthomyxoviridae" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Brucella" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("");
    await waitFor(() => {
      expect(onSelect).toHaveBeenLastCalledWith([]);
    });
  });

  it("commits new roots and query IDs before passive effects run", async () => {
    mockChildren(twoRootChildren);
    const queryKeySpy = vi.spyOn(taxonChildren, "taxonChildrenKey");
    const committedLinks: string[][] = [];

    function TreeWithCommitProbe({ root }: { root: OrganismTaxonomy }) {
      useLayoutEffect(() => {
        committedLinks.push(
          screen.getAllByRole("link").map((link) => link.textContent),
        );
      }, [root]);
      return <TaxonomyTree rootTaxa={[root]} phylogenyTaxonIds={[]} />;
    }

    const { rerender } = render(<TreeWithCommitProbe root={rootTaxon} />, {
      wrapper: createQueryClientWrapper(),
    });
    await screen.findByRole("link", { name: "Brucella abortus" });
    queryKeySpy.mockClear();

    rerender(<TreeWithCommitProbe root={virusesRoot} />);

    expect(committedLinks.at(-1)).toEqual(["Viruses"]);
    expect(queryKeySpy).toHaveBeenNthCalledWith(1, virusesRoot.taxonId);
  });

  it("refreshes a selected root's lineage when only lineageNames change", async () => {
    mockChildren({ 234: [child(235, "Brucella abortus", "species", 581)] });
    const onSelect = vi.fn();
    const { rerender } = render(
      <TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />,
      {
        wrapper: createQueryClientWrapper(),
      },
    );

    const rootLink = await screen.findByRole("link", { name: "Brucella" });
    fireEvent.click(rootLink.closest("tr") as HTMLElement);
    await waitFor(() => {
      expect(onSelect).toHaveBeenLastCalledWith([
        expect.objectContaining({ taxon_id: 234, lineage_names: [] }),
      ]);
    });

    const relineaged = {
      ...rootTaxon,
      lineageNames: ["cellular organisms", "Bacteria"],
    };
    rerender(<TaxonomyTree rootTaxa={[relineaged]} phylogenyTaxonIds={[]} onSelect={onSelect} />);

    const refreshedRoot = await screen.findByRole("link", { name: "Brucella" });
    fireEvent.click(refreshedRoot.closest("tr") as HTMLElement);
    await waitFor(() => {
      expect(onSelect).toHaveBeenLastCalledWith([
        expect.objectContaining({
          taxon_id: 234,
          lineage_names: ["cellular organisms", "Bacteria"],
        }),
      ]);
    });
  });

  it("lazily loads a species' strains when its toggle is clicked", async () => {
    mockChildren({
      234: [child(235, "Brucella abortus", "species", 581)],
      235: [child(999, "Brucella abortus 544", "strain", 2)],
    });

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    const speciesLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    const speciesRow = speciesLink.closest("tr");
    expect(speciesRow).not.toBeNull();
    const expandBtn = await within(speciesRow as HTMLElement).findByRole(
      "button",
      { name: "Expand" },
    );
    fireEvent.click(expandBtn);

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Brucella abortus 544" }),
      ).toBeInTheDocument();
    });
  });

  it("keeps the expand toggle after child counts settle and after collapse", async () => {
    mockChildren({
      234: [child(235, "Brucella abortus", "species", 581)],
      235: [child(999, "Brucella abortus 544", "strain", 2)],
    });

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    const speciesLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    const speciesRow = speciesLink.closest("tr") as HTMLElement;
    const expand = await within(speciesRow).findByRole("button", {
      name: "Expand",
    });

    // Let the count query switch from its populated key to the empty disabled key; the toggle
    // must remain because the settled count is part of rendered state.
    await waitFor(() => {
      expect(within(speciesRow).getByRole("button", { name: "Expand" })).toBe(
        expand,
      );
    });
    fireEvent.click(expand);
    expect(
      await screen.findByRole("link", { name: "Brucella abortus 544" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(speciesRow).getByRole("button", { name: "Collapse" }),
    );
    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: "Brucella abortus 544" }),
      ).toBeNull();
    });

    const reExpand = within(speciesRow).getByRole("button", { name: "Expand" });
    fireEvent.click(reExpand);
    expect(
      await screen.findByRole("link", { name: "Brucella abortus 544" }),
    ).toBeInTheDocument();
  });

  it("tags each rank badge with its rank for the globals.css rank colors", async () => {
    mockChildren({
      234: [child(235, "Brucella abortus", "species", 581)],
    });

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    const speciesLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    const badge = within(speciesLink.closest("tr") as HTMLElement).getByText(
      "species",
    );
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge).toHaveAttribute("data-rank", "species");
  });

  it("renders strain (leaf) rows without an expand toggle", async () => {
    mockChildren({
      234: [child(235, "Brucella abortus", "species", 581)],
      235: [child(999, "Brucella abortus 544", "strain", 2)],
    });

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    const speciesLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    fireEvent.click(
      await within(speciesLink.closest("tr") as HTMLElement).findByRole(
        "button",
        { name: "Expand" },
      ),
    );

    const strainLink = await screen.findByRole("link", {
      name: "Brucella abortus 544",
    });
    const strainRow = strainLink.closest("tr");
    expect(
      within(strainRow as HTMLElement).queryByRole("button", {
        name: /Expand|Collapse/,
      }),
    ).toBeNull();
  });

  it("clicking a row body calls onSelect with the selected taxon records", async () => {
    mockChildren({ 234: [child(235, "Brucella abortus", "species", 581)] });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const speciesLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    fireEvent.click(speciesLink.closest("tr") as HTMLElement);

    await waitFor(() => {
      expect(onSelect).toHaveBeenLastCalledWith([
        expect.objectContaining({ taxon_id: 235 }),
      ]);
    });
  });

  it("toggles selection from anywhere in the checkbox cell and uses data-table row height", async () => {
    mockChildren({ 234: [child(235, "Brucella abortus", "species", 581)] });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const checkbox = await screen.findByRole("checkbox", {
      name: "Select Brucella abortus",
    });
    const row = checkbox.closest("tr") as HTMLElement;
    const selectionCell = checkbox.closest("td") as HTMLElement;

    expect(row).toHaveClass("h-(--row-height)");
    expect(row.style.getPropertyValue("--row-height")).toBe("24px");
    fireEvent.click(selectionCell);

    expect(checkbox).toBeChecked();
    await waitFor(() => {
      expect(onSelect).toHaveBeenLastCalledWith([
        expect.objectContaining({ taxon_id: 235 }),
      ]);
    });
  });

  it("keeps select-all checked and indeterminate states mutually exclusive", () => {
    mockChildren(twoRootChildren);

    render(<TaxonomyTree rootTaxa={[rootTaxon, virusesRoot]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    const selectAll = screen.getByRole("checkbox", { name: "Select all" });
    const first = screen.getByRole("checkbox", {
      name: "Select Brucella",
    });

    fireEvent.click(first);
    expect(selectAll).not.toBeChecked();
    expect(selectAll).toBePartiallyChecked();

    fireEvent.click(selectAll);
    expect(selectAll).toBeChecked();
    expect(selectAll).not.toBePartiallyChecked();

    fireEvent.click(first);
    expect(selectAll).not.toBeChecked();
    expect(selectAll).toBePartiallyChecked();

    fireEvent.click(first);
    expect(selectAll).toBeChecked();
    expect(selectAll).not.toBePartiallyChecked();
  });

  it("unchecking a collapsed parent preserves selected-but-hidden children in onSelect", async () => {
    mockChildren({
      234: [child(235, "Brucella abortus", "species", 581)],
      235: [
        child(1001, "Brucella abortus 544", "strain", 2),
        child(1002, "Brucella abortus 2308", "strain", 1),
      ],
    });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const speciesLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    const speciesRow = speciesLink.closest("tr") as HTMLElement;
    fireEvent.click(
      await within(speciesRow).findByRole("button", { name: "Expand" }),
    );

    fireEvent.click(
      within(speciesRow).getByRole("checkbox", {
        name: "Select Brucella abortus",
      }),
    );
    fireEvent.click(
      within(
        (
          await screen.findByRole("link", { name: "Brucella abortus 544" })
        ).closest("tr") as HTMLElement,
      ).getByRole("checkbox", { name: "Select Brucella abortus 544" }),
    );
    fireEvent.click(
      within(
        (
          await screen.findByRole("link", { name: "Brucella abortus 2308" })
        ).closest("tr") as HTMLElement,
      ).getByRole("checkbox", { name: "Select Brucella abortus 2308" }),
    );

    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(3);
    });

    fireEvent.click(
      within(speciesRow).getByRole("button", { name: "Collapse" }),
    );

    fireEvent.click(
      within(speciesRow).getByRole("checkbox", {
        name: "Select Brucella abortus",
      }),
    );

    await waitFor(() => {
      const lastCall = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(lastCall).toHaveLength(2);
      expect(lastCall).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ taxon_id: 1001 }),
          expect.objectContaining({ taxon_id: 1002 }),
        ]),
      );
    });
  });

  it("selecting a visible row after accordion collapses includes hidden selected children in onSelect", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
      ],
      235: [child(1001, "Brucella abortus 544", "strain", 2)],
    });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const speciesLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    const speciesRow = speciesLink.closest("tr") as HTMLElement;
    fireEvent.click(
      await within(speciesRow).findByRole("button", { name: "Expand" }),
    );
    fireEvent.click(
      within(
        (
          await screen.findByRole("link", { name: "Brucella abortus 544" })
        ).closest("tr") as HTMLElement,
      ).getByRole("checkbox", { name: "Select Brucella abortus 544" }),
    );

    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(1);
    });

    fireEvent.click(
      within(speciesRow).getByRole("button", { name: "Collapse" }),
    );

    await screen.findByRole("link", { name: "Brucella melitensis" });
    fireEvent.click(
      within(
        screen
          .getByRole("link", { name: "Brucella melitensis" })
          .closest("tr") as HTMLElement,
      ).getByRole("checkbox", { name: "Select Brucella melitensis" }),
    );

    await waitFor(() => {
      const lastCall = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(lastCall).toHaveLength(2);
      expect(lastCall).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ taxon_id: 1001 }),
          expect.objectContaining({ taxon_id: 236 }),
        ]),
      );
    });
  });

  it("shift-clicking a row selects the full range between anchor and target", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
        child(237, "Brucella suis", "species", 300),
      ],
    });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const firstRow = (
      await screen.findByRole("link", { name: "Brucella abortus" })
    ).closest("tr") as HTMLElement;
    const lastRow = (
      await screen.findByRole("link", { name: "Brucella suis" })
    ).closest("tr") as HTMLElement;

    fireEvent.click(firstRow);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(1);
    });

    fireEvent.keyDown(document, { key: "Shift" });
    fireEvent.click(lastRow);

    await waitFor(() => {
      const last = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(last).toHaveLength(3);
      expect(last).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ taxon_id: 235 }),
          expect.objectContaining({ taxon_id: 236 }),
          expect.objectContaining({ taxon_id: 237 }),
        ]),
      );
    });
  });

  it("shift-clicking selects the range regardless of click direction (target above anchor)", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
        child(237, "Brucella suis", "species", 300),
      ],
    });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const middleRow = (
      await screen.findByRole("link", { name: "Brucella melitensis" })
    ).closest("tr") as HTMLElement;
    const firstRow = (
      await screen.findByRole("link", { name: "Brucella abortus" })
    ).closest("tr") as HTMLElement;

    fireEvent.click(middleRow);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(1);
    });

    fireEvent.keyDown(document, { key: "Shift" });
    fireEvent.click(firstRow);

    await waitFor(() => {
      const last = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(last).toHaveLength(2);
      expect(last).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ taxon_id: 235 }),
          expect.objectContaining({ taxon_id: 236 }),
        ]),
      );
    });
  });

  it("shift-clicking without a prior selection falls back to selecting just the clicked row", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
      ],
    });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const row = (
      await screen.findByRole("link", { name: "Brucella melitensis" })
    ).closest("tr") as HTMLElement;

    fireEvent.keyDown(document, { key: "Shift" });
    fireEvent.click(row);

    await waitFor(() => {
      const last = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(last).toHaveLength(1);
      expect(last).toEqual([expect.objectContaining({ taxon_id: 236 })]);
    });
  });

  it("ctrl/cmd+clicking row whitespace additively toggles the row without clearing other selections", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
        child(237, "Brucella suis", "species", 300),
      ],
    });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const firstRow = (
      await screen.findByRole("link", { name: "Brucella abortus" })
    ).closest("tr") as HTMLElement;
    const secondRow = screen
      .getByRole("link", { name: "Brucella melitensis" })
      .closest("tr") as HTMLElement;
    const thirdRow = screen
      .getByRole("link", { name: "Brucella suis" })
      .closest("tr") as HTMLElement;

    fireEvent.click(firstRow);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(1);
    });

    fireEvent.keyDown(document, { key: "Control" });
    fireEvent.click(secondRow);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(2);
    });

    fireEvent.click(thirdRow);
    await waitFor(() => {
      const last = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(last).toHaveLength(3);
      expect(last).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ taxon_id: 235 }),
          expect.objectContaining({ taxon_id: 236 }),
          expect.objectContaining({ taxon_id: 237 }),
        ]),
      );
    });

    fireEvent.click(firstRow);
    await waitFor(() => {
      const last = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(last).toHaveLength(2);
      expect(last).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ taxon_id: 236 }),
          expect.objectContaining({ taxon_id: 237 }),
        ]),
      );
    });
  });

  it("clicking row whitespace exclusively selects that row, clearing any prior checkbox selections", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
        child(237, "Brucella suis", "species", 300),
      ],
    });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const cb235 = await screen.findByRole("checkbox", {
      name: "Select Brucella abortus",
    });
    const cb236 = screen.getByRole("checkbox", {
      name: "Select Brucella melitensis",
    });
    fireEvent.click(cb235);
    fireEvent.click(cb236);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(2);
    });

    const thirdRow = screen
      .getByRole("link", { name: "Brucella suis" })
      .closest("tr") as HTMLElement;
    fireEvent.click(thirdRow);

    await waitFor(() => {
      const last = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(last).toHaveLength(1);
      expect(last).toEqual([expect.objectContaining({ taxon_id: 237 })]);
    });
  });

  it("shift-clicking a checkbox selects the full range between anchor and target", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
        child(237, "Brucella suis", "species", 300),
      ],
    });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const firstCb = await screen.findByRole("checkbox", {
      name: "Select Brucella abortus",
    });
    const lastCb = screen.getByRole("checkbox", {
      name: "Select Brucella suis",
    });

    fireEvent.click(firstCb);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(1);
    });

    fireEvent.keyDown(document, { key: "Shift" });
    fireEvent.click(lastCb);

    await waitFor(() => {
      const last = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(last).toHaveLength(3);
      expect(last).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ taxon_id: 235 }),
          expect.objectContaining({ taxon_id: 236 }),
          expect.objectContaining({ taxon_id: 237 }),
        ]),
      );
    });
  });

  it("shift-clicking a checkbox selects the range regardless of direction (target above anchor)", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
        child(237, "Brucella suis", "species", 300),
      ],
    });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const middleCb = await screen.findByRole("checkbox", {
      name: "Select Brucella melitensis",
    });
    const firstCb = screen.getByRole("checkbox", {
      name: "Select Brucella abortus",
    });

    fireEvent.click(middleCb);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(1);
    });

    fireEvent.keyDown(document, { key: "Shift" });
    fireEvent.click(firstCb);

    await waitFor(() => {
      const last = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(last).toHaveLength(2);
      expect(last).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ taxon_id: 235 }),
          expect.objectContaining({ taxon_id: 236 }),
        ]),
      );
    });
  });

  it("shift-clicking a checkbox without a prior anchor falls back to toggling just that row", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
      ],
    });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const cb = await screen.findByRole("checkbox", {
      name: "Select Brucella melitensis",
    });

    fireEvent.keyDown(document, { key: "Shift" });
    fireEvent.click(cb);

    await waitFor(() => {
      const last = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(last).toHaveLength(1);
      expect(last).toEqual([expect.objectContaining({ taxon_id: 236 })]);
    });
  });

  it("checkbox click sets anchor for a subsequent row-body shift-click", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
        child(237, "Brucella suis", "species", 300),
      ],
    });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const firstCb = await screen.findByRole("checkbox", {
      name: "Select Brucella abortus",
    });
    fireEvent.click(firstCb);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(1);
    });

    const lastRow = screen
      .getByRole("link", { name: "Brucella suis" })
      .closest("tr") as HTMLElement;
    fireEvent.keyDown(document, { key: "Shift" });
    fireEvent.click(lastRow);

    await waitFor(() => {
      const last = onSelect.mock.calls.at(-1)?.[0] as TaxonRecord[];
      expect(last).toHaveLength(3);
      expect(last).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ taxon_id: 235 }),
          expect.objectContaining({ taxon_id: 236 }),
          expect.objectContaining({ taxon_id: 237 }),
        ]),
      );
    });
  });

  it("filters loaded rows by name", async () => {
    mockChildren({
      234: [
        child(235, "Brucella abortus", "species", 581),
        child(236, "Brucella melitensis", "species", 400),
      ],
    });

    render(<TaxonomyTree rootTaxa={[rootTaxon]} phylogenyTaxonIds={[]} />, {
      wrapper: createQueryClientWrapper(),
    });

    await screen.findByRole("link", { name: "Brucella abortus" });

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search by taxonomy name" }),
      {
        target: { value: "melitensis" },
      },
    );

    expect(screen.queryByRole("link", { name: "Brucella abortus" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Brucella melitensis" }),
    ).toBeInTheDocument();
  });
});
