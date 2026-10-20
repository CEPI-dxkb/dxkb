import { render, screen, within } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";

import { server } from "@/test-helpers/msw-server";

import MetaCATSPage from "../page";

// jsdom lays nothing out, so the grid's virtualizer would render no rows.
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

vi.mock("@/hooks/services/use-service-runtime", () => ({
  useServiceRuntime: () => ({ isSubmitting: false, jobParamsDialogProps: {} }),
}));

vi.mock("@/components/services/job-params-dialog", () => ({
  JobParamsDialog: () => null,
}));

vi.mock("@/components/services/service-header", () => ({
  ServiceHeader: () => null,
}));

vi.mock("@/components/forms/required-form-components", () => ({
  RequiredFormCardTitle: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/services/service-output-fields", () => ({
  ServiceOutputFields: () => null,
}));

vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: ({
    preset,
    onSelectedObjectChange,
  }: {
    preset: string;
    onSelectedObjectChange: (
      object: { id: string; name: string; path: string } | null,
    ) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onSelectedObjectChange({
          id: preset,
          name: "flu",
          path: `/u@bvbrc/home/${preset}/flu`,
        });
      }}
    >
      Pick {preset}
    </button>
  ),
}));

// The grid sizes its columns to its container, which jsdom cannot observe.
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  };
});

function groupNameField() {
  return screen.getByRole("combobox", { name: "Group name" });
}

async function openGroupNames(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Show group names" }));
}

/**
 * Serves one feature group whose two genomes have these host names. Returns
 * the genome lookups' request bodies.
 */
function serveFeatureGroup(hostNames: [string | undefined, string | undefined]) {
  const genomeRequests: unknown[] = [];
  server.use(
    http.post("*/api/services/feature/from-group", () =>
      HttpResponse.json({
        results: [
          { genome_id: "11320.1", patric_id: "fig|11320.1.peg.1" },
          { genome_id: "11320.2", patric_id: "fig|11320.2.peg.1" },
        ],
      }),
    ),
    http.post("*/api/services/genome/by-ids", async ({ request }) => {
      genomeRequests.push(await request.json());
      return HttpResponse.json({
        results: hostNames.map((hostName, index) => ({
          genome_id: `11320.${String(index + 1)}`,
          genbank_accessions: `CY00000${String(index + 1)}`,
          strain: `Strain ${String(index + 1)}`,
          ...(hostName === undefined ? {} : { host_name: hostName }),
        })),
      });
    }),
  );
  return genomeRequests;
}

async function addFeatureGroup(user: ReturnType<typeof userEvent.setup>) {
  // The Auto Grouping section's selector and + button come first.
  await user.click(
    screen.getAllByRole("button", { name: "Pick featureGroup" })[0],
  );
  await user.click(
    screen.getAllByRole("button", { name: "Add feature group" })[0],
  );
  expect(await screen.findByText("fig|11320.2.peg.1")).toBeVisible();
}

function groupCell(patricId: string) {
  const row = screen.getByText(patricId).closest("tr");
  // Select, Genbank Accession, Strain, Metadata, Group: the fifth cell.
  return row?.children[4];
}

describe("META-Cats Group Names field", () => {
  it("explains, while the grid is empty, where its names come from", async () => {
    const user = userEvent.setup();
    render(<MetaCATSPage />, { wrapper: createQueryClientWrapper() });

    await openGroupNames(user);

    expect(await screen.findByText("No group names yet")).toBeVisible();
    expect(
      screen.getByText(
        /grouped by its genome's Host Name\. Select a feature group above and click \+ to add its features\./,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/choose a name here or type a new one/),
    ).toBeVisible();
  });

  it("suggests the grid's group names once features are added", async () => {
    serveFeatureGroup(["Human", "Swine"]);
    const user = userEvent.setup();
    render(<MetaCATSPage />, { wrapper: createQueryClientWrapper() });
    await addFeatureGroup(user);

    await openGroupNames(user);

    expect(await screen.findByRole("option", { name: "Human" })).toBeVisible();
    expect(screen.getByRole("option", { name: "Swine" })).toBeVisible();
    expect(screen.queryByText("No group names yet")).not.toBeInTheDocument();
  });

  it("moves selected rows into a typed new group, as legacy does", async () => {
    serveFeatureGroup(["Human", "Swine"]);
    const user = userEvent.setup();
    render(<MetaCATSPage />, { wrapper: createQueryClientWrapper() });
    await addFeatureGroup(user);

    await user.click(
      screen.getByRole("checkbox", { name: "Select row fig|11320.1.peg.1" }),
    );
    await user.type(groupNameField(), "  Mammal ");
    expect(
      await screen.findByText(/No group is named “Mammal” yet\./),
    ).toBeVisible();
    // Close the suggestions, which hide the page from the accessibility tree.
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Change group" }));

    // Trimmed: the padded name would be a group of its own.
    expect(groupCell("fig|11320.1.peg.1")?.textContent).toBe("Mammal");
    expect(groupCell("fig|11320.2.peg.1")).toHaveTextContent("Swine");

    await user.clear(groupNameField());
    await openGroupNames(user);
    expect(await screen.findByRole("option", { name: "Mammal" })).toBeVisible();
  });

  it("fills the field from a picked suggestion", async () => {
    serveFeatureGroup(["Human", "Swine"]);
    const user = userEvent.setup();
    render(<MetaCATSPage />, { wrapper: createQueryClientWrapper() });
    await addFeatureGroup(user);

    await openGroupNames(user);
    await user.click(await screen.findByRole("option", { name: "Swine" }));

    expect(groupNameField()).toHaveValue("Swine");
  });

  it("says why there is nothing to suggest when no feature has the metadata", async () => {
    serveFeatureGroup([undefined, undefined]);
    const user = userEvent.setup();
    render(<MetaCATSPage />, { wrapper: createQueryClientWrapper() });
    await addFeatureGroup(user);

    await openGroupNames(user);

    expect(
      await screen.findByText(
        /None of the features in the grid has a metadata value/,
      ),
    ).toBeVisible();
    // The blank group is not offered as a name.
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("does not submit the job when Enter is pressed in the field", async () => {
    const user = userEvent.setup();
    render(<MetaCATSPage />, { wrapper: createQueryClientWrapper() });
    const onSubmit = vi.fn((event: SubmitEvent) => {
      event.preventDefault();
    });
    const form = groupNameField().closest("form");
    form?.addEventListener("submit", onSubmit);

    await user.type(groupNameField(), "Mammal{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(groupNameField()).toHaveValue("Mammal");
  });
});

describe("META-Cats Groups Grid", () => {
  it("lists BV-BRC's columns, filled from the feature's genome", async () => {
    const genomeRequests = serveFeatureGroup(["Human", "Swine"]);
    const user = userEvent.setup();
    render(<MetaCATSPage />, { wrapper: createQueryClientWrapper() });
    await addFeatureGroup(user);

    // The lookup asks for the grouping metadata and the accession.
    expect(genomeRequests).toEqual([
      expect.objectContaining({
        fields: ["genbank_accessions", "host_name"],
      }),
    ]);
    const grid = screen.getByRole("table");
    expect(
      within(grid)
        .getAllByRole("columnheader")
        .map((header) => header.textContent)
        .slice(1),
    ).toEqual([
      "Genbank Accession",
      "Strain",
      "Metadata",
      "Group",
      "BRC ID",
      "Genome ID",
    ]);
    const row = screen.getByText("fig|11320.1.peg.1").closest("tr");
    expect(
      [...(row?.children ?? [])].slice(1).map((cell) => cell.textContent),
    ).toEqual([
      "CY000001",
      "Strain 1",
      "Human",
      "Human",
      "fig|11320.1.peg.1",
      "11320.1",
    ]);
    expect(screen.getByText("Showing 1-2 of 2 results")).toBeVisible();
  });

  it("deletes the rows selected in the grid", async () => {
    serveFeatureGroup(["Human", "Swine"]);
    const user = userEvent.setup();
    render(<MetaCATSPage />, { wrapper: createQueryClientWrapper() });
    await addFeatureGroup(user);

    const deleteRows = screen.getByRole("button", { name: "Delete Rows" });
    expect(deleteRows).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", { name: "Select row fig|11320.2.peg.1" }),
    );
    await user.click(deleteRows);

    expect(screen.queryByText("fig|11320.2.peg.1")).not.toBeInTheDocument();
    expect(screen.getByText("fig|11320.1.peg.1")).toBeVisible();
    expect(deleteRows).toBeDisabled();
  });
});
