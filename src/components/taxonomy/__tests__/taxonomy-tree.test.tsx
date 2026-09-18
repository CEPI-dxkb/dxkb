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

// useVirtualizer measures the scroll container via ResizeObserver / getBoundingClientRect,
// neither of which works in jsdom (0 layout height → 0 rows rendered). Mock it to return
// all items synchronously so tests assert on row content without the virtualizer's async
// measurement lifecycle. Same mock as reference-genomes-client.test.tsx.
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

// The tree reads children and child counts from the same-origin
// /api/taxonomy-tree route, so these handlers intercept relative paths — no
// NEXT_PUBLIC_DATA_API origin is involved on the client any more.
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

// Children for the two-root ([rootTaxon, virusesRoot]) scenarios: one bacterial
// species under Brucella, one viral family under Viruses.
const twoRootChildren: Record<number, TaxonRecord[]> = {
  234: [child(235, "Brucella abortus", "species", 581)],
  10239: [
    child(11308, "Orthomyxoviridae", "family", 245000, virusesRoot.taxonId),
  ],
};

// parentId -> rows, answering both route operations the tree calls:
// /children?parentId=ID returns {rows}, and /child-counts?parentId=… returns
// {counts} with each requested parent's child count (from byParent), so expand
// arrows appear for nodes that have children. A parent with zero children is
// reported as 0 here rather than omitted, which is what the route's upstream
// mincount,1 would do — either way `getRowCanExpand` sees no positive count.
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
  // Release modifier keys so held state never leaks into the next test.
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} />, {
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

    render(<TaxonomyTree rootTaxa={[rootTaxon, virusesRoot]} />, {
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

    render(<TaxonomyTree rootTaxa={[rootTaxon, virusesRoot]} />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(
      await screen.findByRole("link", { name: "Brucella abortus" }),
    ).toBeInTheDocument();
    // The route's specific upstream detail reaches the placeholder row rather
    // than being replaced by a generic "failed to load sub-taxa".
    expect(
      await screen.findByText(
        /error: taxonomy children 10239: viral branch unavailable/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Brucella" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Viruses" })).toBeInTheDocument();
    expect(screen.getAllByRole("table")).toHaveLength(1);
  });

  it("resets stale roots, selection, and filtering when the root set changes", async () => {
    mockChildren(twoRootChildren);
    const onSelect = vi.fn();
    const { rerender } = render(
      <TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />,
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

    rerender(<TaxonomyTree rootTaxa={[virusesRoot]} onSelect={onSelect} />);

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
      return <TaxonomyTree rootTaxa={[root]} />;
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
      <TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />,
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

    // Same id/name/rank/genomes — only the lineage was corrected by a refresh.
    const relineaged = {
      ...rootTaxon,
      lineageNames: ["cellular organisms", "Bacteria"],
    };
    rerender(<TaxonomyTree rootTaxa={[relineaged]} onSelect={onSelect} />);

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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} />, {
      wrapper: createQueryClientWrapper(),
    });

    const speciesLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    const speciesRow = speciesLink.closest("tr");
    expect(speciesRow).not.toBeNull();
    // The expand arrow appears once the batched child-count facet resolves (async).
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} />, {
      wrapper: createQueryClientWrapper(),
    });

    const speciesLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    const speciesRow = speciesLink.closest("tr") as HTMLElement;
    const expand = await within(speciesRow).findByRole("button", {
      name: "Expand",
    });

    // Let the count query switch from its populated key to the empty disabled key.
    // The toggle must remain because the settled count is part of rendered state.
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

  it("renders strain (leaf) rows without an expand toggle", async () => {
    mockChildren({
      234: [child(235, "Brucella abortus", "species", 581)],
      235: [child(999, "Brucella abortus 544", "strain", 2)],
    });

    render(<TaxonomyTree rootTaxa={[rootTaxon]} />, {
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const speciesLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    fireEvent.click(speciesLink.closest("tr") as HTMLElement);

    // onSelect fires with the full selected-row array (driven by the selection
    // effect), not a single record. Assert the row landed in the latest call.
    await waitFor(() => {
      expect(onSelect).toHaveBeenLastCalledWith([
        expect.objectContaining({ taxon_id: 235 }),
      ]);
    });
  });

  it("toggles selection from anywhere in the checkbox cell and uses data-table row height", async () => {
    mockChildren({ 234: [child(235, "Brucella abortus", "species", 581)] });
    const onSelect = vi.fn();

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const checkbox = await screen.findByRole("checkbox", {
      name: "Select Brucella abortus",
    });
    const row = checkbox.closest("tr") as HTMLElement;
    const selectionCell = checkbox.closest("td") as HTMLElement;

    expect(row).toHaveStyle({ height: "24px" });
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

    render(<TaxonomyTree rootTaxa={[rootTaxon, virusesRoot]} />, {
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    // Expand to load strains
    const speciesLink = await screen.findByRole("link", {
      name: "Brucella abortus",
    });
    const speciesRow = speciesLink.closest("tr") as HTMLElement;
    fireEvent.click(
      await within(speciesRow).findByRole("button", { name: "Expand" }),
    );

    // Select parent + both strains via checkboxes (additive).
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

    // Collapse — strains leave the row model (childrenMap drops entry for 235)
    fireEvent.click(
      within(speciesRow).getByRole("button", { name: "Collapse" }),
    );

    // Uncheck parent via checkbox — triggers the selection effect that previously returned 0
    // because getSelectedRowModel() only saw visible rows.
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    // Expand Brucella abortus and select its strain via checkbox (additive).
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

    // Collapse — strain leaves the row model
    fireEvent.click(
      within(speciesRow).getByRole("button", { name: "Collapse" }),
    );

    // Select a different visible row via checkbox — additive, preserves hidden strain.
    await screen.findByRole("link", { name: "Brucella melitensis" });
    fireEvent.click(
      within(
        screen
          .getByRole("link", { name: "Brucella melitensis" })
          .closest("tr") as HTMLElement,
      ).getByRole("checkbox", { name: "Select Brucella melitensis" }),
    );

    // Should count 2: hidden strain + newly checked species
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    // Rows in visible order: root (234), 235, 236, 237.
    const firstRow = (
      await screen.findByRole("link", { name: "Brucella abortus" })
    ).closest("tr") as HTMLElement;
    const lastRow = (
      await screen.findByRole("link", { name: "Brucella suis" })
    ).closest("tr") as HTMLElement;

    // Plain click sets the anchor.
    fireEvent.click(firstRow);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(1);
    });

    // Shift held → click the last species. Everything between anchor and target
    // (235, 236, 237) becomes selected.
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const middleRow = (
      await screen.findByRole("link", { name: "Brucella melitensis" })
    ).closest("tr") as HTMLElement;
    const firstRow = (
      await screen.findByRole("link", { name: "Brucella abortus" })
    ).closest("tr") as HTMLElement;

    // Anchor on the middle row, then shift-click upward to the first.
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const row = (
      await screen.findByRole("link", { name: "Brucella melitensis" })
    ).closest("tr") as HTMLElement;

    // No anchor yet → shift-click behaves like a plain toggle.
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
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

    // Plain click: exclusive select of first row.
    fireEvent.click(firstRow);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(1);
    });

    // Ctrl+click second row: adds to selection.
    fireEvent.keyDown(document, { key: "Control" });
    fireEvent.click(secondRow);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(2);
    });

    // Ctrl+click third row: adds to selection.
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

    // Ctrl+click first row again: removes it.
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    // Select two rows via checkboxes (additive).
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

    // Plain whitespace click on a third row — should exclusively select only that row.
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    const firstCb = await screen.findByRole("checkbox", {
      name: "Select Brucella abortus",
    });
    const lastCb = screen.getByRole("checkbox", {
      name: "Select Brucella suis",
    });

    // Plain checkbox click sets the anchor.
    fireEvent.click(firstCb);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(1);
    });

    // Shift held → checkbox click on last species selects 235, 236, 237.
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} onSelect={onSelect} />, {
      wrapper: createQueryClientWrapper(),
    });

    // Set anchor via checkbox click.
    const firstCb = await screen.findByRole("checkbox", {
      name: "Select Brucella abortus",
    });
    fireEvent.click(firstCb);
    await waitFor(() => {
      expect(onSelect.mock.calls.at(-1)?.[0]).toHaveLength(1);
    });

    // Shift + row-body click on last species should range from the checkbox anchor.
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

    render(<TaxonomyTree rootTaxa={[rootTaxon]} />, {
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
