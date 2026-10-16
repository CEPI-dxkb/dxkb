import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  resolveCollectionDownloadSpec,
  type DownloadRequest,
} from "@/lib/data-api/downloads";
import {
  CollectionDownloadAction,
  type CollectionDownloadProps,
} from "../collection-download/collection-download-action";

const featureQuery = {
  kind: "query" as const,
  rql: "eq(annotation,PATRIC)",
  keyword: "influenza",
};

function props(
  overrides: Partial<CollectionDownloadProps> = {},
): CollectionDownloadProps {
  return {
    label: "Features",
    spec: resolveCollectionDownloadSpec("genome_feature"),
    selection: { count: 0, ids: [], isAllPagesSelected: false },
    allResults: { scope: featureQuery, total: 2_123_456 },
    sort: { field: "patric_id", direction: "asc" },
    isPlaceholderData: false,
    visibleColumnIds: ["patric_id", "product"],
    fileNameBase: "genome_feature",
    queryLabel: "keyword: influenza",
    pending: null,
    onDownload: vi.fn(),
    ...overrides,
  };
}

const tile = () => screen.getByRole("button", { name: /^DOWNLOAD/ });

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(tile());
  await screen.findByRole("radiogroup", { name: "Rows to download" });
}

function lastRequest(onDownload: CollectionDownloadProps["onDownload"]) {
  return vi.mocked(onDownload).mock.lastCall?.[0] as DownloadRequest;
}

describe("CollectionDownloadAction", () => {
  it("is in the rail with nothing selected, and downloads all results by default", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(<CollectionDownloadAction {...props({ onDownload })} />);

    expect(tile()).toHaveTextContent(/^DOWNLOAD$/);
    await open(user);
    expect(
      screen.getByRole("dialog", { name: "Download Features" }),
    ).toBeVisible();
    expect(screen.getByRole("radio", { name: /^All/ })).toBeChecked();
    const selected = screen.getByRole("radio", { name: /^Selected/ });
    expect(selected).toHaveAttribute("aria-disabled", "true");
    expect(selected.closest("label")).toHaveAttribute(
      "title",
      "Select rows in the table first",
    );
    // Compact counts.
    expect(screen.getByRole("radio", { name: /^All/ }).closest("label")).toHaveTextContent(
      "All2.1M",
    );
    expect(screen.getByText("keyword: influenza")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Text" }));
    expect(onDownload).toHaveBeenCalledWith(
      {
        format: "tsv",
        scope: featureQuery,
        sort: { field: "patric_id", direction: "asc" },
        fields: undefined,
        fileNameBase: "genome_feature",
        total: 2_123_456,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) as unknown }),
    );
  });

  it("defaults to the selection, badges it, and downloads it by id", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(
      <CollectionDownloadAction
        {...props({
          onDownload,
          selection: { count: 2, ids: ["F.2", "F.1"], isAllPagesSelected: false },
        })}
      />,
    );

    expect(tile()).toHaveTextContent("DOWNLOAD2");
    await open(user);
    expect(screen.getByRole("radio", { name: /^Selected/ })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Protein FASTA" }));
    expect(lastRequest(onDownload)).toEqual({
      format: "protein-fasta",
      // In selection order.
      scope: { kind: "selected", ids: ["F.2", "F.1"] },
      sort: { field: "patric_id", direction: "asc" },
      fields: undefined,
      fileNameBase: "genome_feature-selected",
      total: 2,
    });

    await user.click(screen.getByRole("radio", { name: /^All/ }));
    await user.click(screen.getByRole("button", { name: "CSV" }));
    expect(lastRequest(onDownload)).toMatchObject({
      scope: featureQuery,
      fileNameBase: "genome_feature",
    });
  });

  it("caps the badge at 999+", () => {
    render(
      <CollectionDownloadAction
        {...props({
          selection: { count: 4_434_422, ids: [], isAllPagesSelected: true },
        })}
      />,
    );

    expect(tile()).toHaveTextContent("DOWNLOAD999+");
  });

  it("downloads an all-pages selection as the query", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(
      <CollectionDownloadAction
        {...props({
          onDownload,
          allResults: { scope: featureQuery, total: 400 },
          selection: { count: 400, ids: [], isAllPagesSelected: true },
        })}
      />,
    );

    await open(user);
    await user.click(screen.getByRole("button", { name: "CSV" }));
    expect(lastRequest(onDownload)).toMatchObject({
      scope: featureQuery,
      fileNameBase: "genome_feature-selected",
      total: 400,
    });
  });

  it("falls back to All when a remembered selection empties", async () => {
    const user = userEvent.setup();
    const withSelection = props({
      selection: { count: 1, ids: ["F.1"], isAllPagesSelected: false },
    });
    const { rerender } = render(<CollectionDownloadAction {...withSelection} />);
    await open(user);
    await user.click(screen.getByRole("radio", { name: /^Selected/ }));

    rerender(<CollectionDownloadAction {...props()} />);

    expect(screen.getByRole("radio", { name: /^All/ })).toBeChecked();
  });

  it("keeps every format listed and says in place why one cannot run", async () => {
    const user = userEvent.setup();
    render(<CollectionDownloadAction {...props()} />);
    await open(user);

    // 2.1M matching rows: over Excel's sheet and the all-results FASTA cap.
    const excel = screen.getByRole("button", { name: /^Excel/ });
    expect(excel).toBeDisabled();
    expect(excel).toHaveTextContent("Over Excel's 1,048,576-row limit");
    expect(excel).toHaveAttribute("title", "Over Excel's 1,048,576-row limit");
    for (const name of [/^DNA FASTA/, /^Protein FASTA/]) {
      expect(screen.getByRole("button", { name })).toHaveTextContent(
        "Sequences: 10,000 rows at most",
      );
    }
    expect(screen.getByRole("button", { name: "Text" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "CSV" })).toBeEnabled();
  });

  it.each([
    [0, "No matching rows"],
    [2_500_001, "Over 2,500,000 rows: narrow the filters"],
  ])("disables every format for %d matching rows", async (total, reason) => {
    const user = userEvent.setup();
    render(
      <CollectionDownloadAction
        {...props({ allResults: { scope: featureQuery, total } })}
      />,
    );
    await open(user);

    for (const name of ["Text", "CSV", "Excel", "DNA FASTA", "Protein FASTA"]) {
      const row = screen.getByRole("button", { name: new RegExp(`^${name}`) });
      expect(row).toBeDisabled();
      expect(row).toHaveTextContent(reason);
    }
  });

  it("waits for the count before downloading all results", async () => {
    const user = userEvent.setup();
    render(
      <CollectionDownloadAction {...props({ isPlaceholderData: true })} />,
    );
    await open(user);

    expect(screen.getByRole("radio", { name: /^All/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Text/ })).toHaveTextContent(
      "Counting matching rows…",
    );
  });

  it("offers Protein FASTA alone for a Proteins view", async () => {
    const user = userEvent.setup();
    render(
      <CollectionDownloadAction
        {...props({
          label: "Proteins",
          spec: resolveCollectionDownloadSpec("genome_feature", {
            sequenceFormats: ["protein-fasta"],
          }),
        })}
      />,
    );
    await open(user);

    expect(screen.getByRole("button", { name: /^Protein FASTA/ })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^DNA FASTA/ }),
    ).not.toBeInTheDocument();
  });

  it("offers a genome's contigs as its DNA FASTA, and no protein", async () => {
    const user = userEvent.setup();
    render(
      <CollectionDownloadAction
        {...props({
          label: "Genomes",
          spec: resolveCollectionDownloadSpec("genome"),
          allResults: { scope: { kind: "query" }, total: 12 },
        })}
      />,
    );
    await open(user);

    expect(screen.getByRole("button", { name: "DNA FASTA" })).toHaveAttribute(
      "title",
      "Nucleotide sequences. Contigs of each genome.",
    );
    expect(screen.getAllByRole("separator")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: /^Protein FASTA/ }),
    ).not.toBeInTheDocument();
  });

  it("lists no sequence formats, and no divider, for a table-only resource", async () => {
    const user = userEvent.setup();
    render(
      <CollectionDownloadAction
        {...props({ spec: resolveCollectionDownloadSpec("epitope") })}
      />,
    );
    await open(user);

    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^(Text|CSV|Excel)/ })).toHaveLength(3);
  });

  it("sends the visible columns for table formats, never for sequences", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(
      <CollectionDownloadAction
        {...props({
          onDownload,
          selection: { count: 1, ids: ["F.1"], isAllPagesSelected: false },
        })}
      />,
    );
    await open(user);

    await user.click(screen.getByRole("switch", { name: "Visible columns" }));
    await user.click(screen.getByRole("button", { name: "CSV" }));
    expect(lastRequest(onDownload).fields).toEqual(["patric_id", "product"]);

    await user.click(screen.getByRole("button", { name: "DNA FASTA" }));
    expect(lastRequest(onDownload).fields).toBeUndefined();
  });

  it("disables Visible columns, with its reason, when a column cannot be selected", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(
      <CollectionDownloadAction
        {...props({
          onDownload,
          visibleColumnIds: ["strain", "1_pb2", "2_pb1", "4_ha"],
        })}
      />,
    );
    await open(user);

    const columns = screen.getByRole("switch", { name: "Visible columns" });
    // Base UI draws the switch as a span, which reports aria-disabled.
    expect(columns).toHaveAttribute("aria-disabled", "true");
    expect(columns).not.toBeChecked();
    expect(columns).toHaveAccessibleDescription(
      "The data service cannot select 1_pb2, 2_pb1 and 1 more, so table files hold every field.",
    );
    await user.click(screen.getByRole("button", { name: "CSV" }));
    expect(lastRequest(onDownload).fields).toBeUndefined();
  });

  it("stops sending visible columns once one of them cannot be selected", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    const { rerender } = render(
      <CollectionDownloadAction {...props({ onDownload })} />,
    );
    await open(user);
    await user.click(screen.getByRole("switch", { name: "Visible columns" }));

    rerender(
      <CollectionDownloadAction
        {...props({ onDownload, visibleColumnIds: ["patric_id", "1_pb2"] })}
      />,
    );
    expect(
      screen.getByRole("switch", { name: "Visible columns" }),
    ).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "CSV" }));
    expect(lastRequest(onDownload).fields).toBeUndefined();
  });

  it("turns Visible columns off, with its reason, once every column is hidden", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    const { rerender } = render(
      <CollectionDownloadAction {...props({ onDownload })} />,
    );
    await open(user);
    await user.click(screen.getByRole("switch", { name: "Visible columns" }));

    rerender(
      <CollectionDownloadAction {...props({ onDownload, visibleColumnIds: [] })} />,
    );
    const columns = screen.getByRole("switch", { name: "Visible columns" });
    expect(columns).toHaveAttribute("aria-disabled", "true");
    expect(columns).not.toBeChecked();
    expect(columns).toHaveAccessibleDescription(
      "No columns are visible, so table files hold every field.",
    );
    await user.click(screen.getByRole("button", { name: "CSV" }));
    expect(lastRequest(onDownload).fields).toBeUndefined();
  });

  it("disables every row while a download runs, and marks it done after", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn<CollectionDownloadProps["onDownload"]>();
    const selection = { count: 1, ids: ["F.1"], isAllPagesSelected: false };
    const { rerender } = render(
      <CollectionDownloadAction {...props({ onDownload, selection })} />,
    );
    await open(user);
    await user.click(screen.getByRole("button", { name: "CSV" }));

    rerender(
      <CollectionDownloadAction
        {...props({ onDownload, selection, pending: "csv" })}
      />,
    );
    for (const name of ["Text", "CSV", "Excel", "DNA FASTA", "Protein FASTA"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^${name}`) }),
      ).toBeDisabled();
    }

    const { onSuccess } = onDownload.mock.calls[0][1];
    rerender(
      <CollectionDownloadAction {...props({ onDownload, selection })} />,
    );
    onSuccess();
    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "CSV" })
          .querySelector("svg.text-success"),
      ).not.toBeNull();
    });
  });

  it("keeps the latest check mark for its full time, and clears its timer on unmount", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn<CollectionDownloadProps["onDownload"]>();
    const selection = { count: 1, ids: ["F.1"], isAllPagesSelected: false };
    const { unmount } = render(
      <CollectionDownloadAction {...props({ onDownload, selection })} />,
    );
    await open(user);
    await user.click(screen.getByRole("button", { name: "CSV" }));
    await user.click(screen.getByRole("button", { name: "CSV" }));
    const [first, second] = onDownload.mock.calls.map(
      ([, options]) => options.onSuccess,
    );
    const checkMark = () =>
      screen
        .getByRole("button", { name: "CSV" })
        .querySelector("svg.text-success");

    vi.useFakeTimers();
    try {
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      act(() => {
        first();
      });
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      act(() => {
        second();
      });
      // Past the first download's 1.8 s, which no longer clears the mark.
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(checkMark()).not.toBeNull();
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(checkMark()).toBeNull();

      act(() => {
        second();
      });
      const doneTimer = setTimeoutSpy.mock.results[
        setTimeoutSpy.mock.calls.findLastIndex(([, ms]) => ms === 1_800)
      ]?.value as unknown;
      expect(doneTimer).toBeDefined();
      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalledWith(doneTimer);
    } finally {
      vi.useRealTimers();
    }
  });

  it("works from the keyboard and hands focus back on Escape", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(
      <CollectionDownloadAction
        {...props({
          onDownload,
          allResults: { scope: featureQuery, total: 20 },
          selection: { count: 1, ids: ["F.1"], isAllPagesSelected: false },
        })}
      />,
    );

    tile().focus();
    await user.keyboard("{Enter}");
    const group = await screen.findByRole("radiogroup", {
      name: "Rows to download",
    });
    // The scope, the format rows and the switch are all reachable.
    await waitFor(() => {
      expect(group.contains(document.activeElement)).toBe(true);
    });
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /^All/ })).toBeChecked();
    await user.tab();
    expect(screen.getByRole("button", { name: "Text" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(lastRequest(onDownload)).toMatchObject({
      format: "tsv",
      scope: featureQuery,
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(
        screen.queryByRole("radiogroup", { name: "Rows to download" }),
      ).not.toBeInTheDocument();
    });
    expect(tile()).toHaveFocus();
  });
});
