import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";

import ProteomeComparisonPage from "../page";
import { server } from "@/test-helpers/msw-server";

const { groupPath, genomeId } = vi.hoisted(() => ({
  groupPath: "/user@bvbrc/home/big-group",
  genomeId: "83332.12",
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/hooks/services/use-service-runtime", () => ({
  useServiceRuntime: () => ({ isSubmitting: false, jobParamsDialogProps: {} }),
}));

vi.mock("@/components/services/job-params-dialog", () => ({
  JobParamsDialog: () => null,
}));

vi.mock("@/components/services/service-header", () => ({
  ServiceHeader: () => null,
}));

vi.mock("@/components/services/output-folder", () => ({
  default: () => null,
}));

// A button per genome selector, named by its placeholder, that picks one genome.
vi.mock("@/components/services/single-genome-selector", () => ({
  SingleGenomeSelector: ({
    placeholder,
    onChange,
  }: {
    placeholder?: string;
    onChange: (genomeId: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onChange(genomeId);
      }}
    >
      Pick {placeholder}
    </button>
  ),
}));

// A button per picker; picking the genome group is the only one a test drives.
vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: ({
    preset,
    onSelectedObjectChange,
  }: {
    preset: string;
    onSelectedObjectChange: (object: { path: string } | null) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onSelectedObjectChange({ path: groupPath });
      }}
    >
      Pick {preset}
    </button>
  ),
}));

function groupResponse(count: number) {
  const genomeIds = Array.from({ length: count }, (_, i) => `${String(i)}.1`);
  return HttpResponse.json({
    result: [
      [[{ path: groupPath }, JSON.stringify({ id_list: { genome_id: genomeIds } })]],
    ],
  });
}

/** Answers the group's `Workspace.get` with a group of `count` genomes. */
function serveGroup(count: number, gate?: Promise<void>) {
  server.use(
    http.post("*/api/services/workspace", async () => {
      await gate;
      return groupResponse(count);
    }),
  );
}

/**
 * Answers successive group reads in order, each with its own group size once
 * its gate opens, and records which reads have been answered.
 */
function serveGroupReads(reads: { count: number; gate: Promise<void> }[]) {
  const answered: number[] = [];
  let next = 0;
  server.use(
    http.post("*/api/services/workspace", async () => {
      const index = next++;
      await reads[index].gate;
      answered.push(index);
      return groupResponse(reads[index].count);
    }),
  );
  return answered;
}

function openableGate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

async function pickGroupAndAdd(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Pick genomeGroup" }));
  await user.click(screen.getByRole("button", { name: "Add genome group" }));
}

describe("ProteomeComparisonPage genome group add", () => {
  it("returns the add button to its plus after a group over the limit is rejected", async () => {
    serveGroup(10);
    const user = userEvent.setup();
    render(<ProteomeComparisonPage />);

    await pickGroupAndAdd(user);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledTimes(1);
    });
    const [title, options] = vi.mocked(toast.error).mock.calls[0];
    expect(title).toBe("Cannot add genome group");
    expect(options?.description).toBe(
      "Adding this genome group would exceed the maximum of 9 genomes. Current: 0, Group size: 10",
    );
    // The early return used to skip the reset of the loading flag, leaving the
    // button on its spinner and disabled until a reload.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Add genome group" }),
      ).toBeEnabled();
    });
    expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
  });

  it("returns the add button to its plus after an empty group is rejected", async () => {
    serveGroup(0);
    const user = userEvent.setup();
    render(<ProteomeComparisonPage />);

    await pickGroupAndAdd(user);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Empty genome group",
        expect.anything(),
      );
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Add genome group" }),
      ).toBeEnabled();
    });
  });

  it("clears the spinner of an add still in flight on reset", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    serveGroup(1, gate);
    const user = userEvent.setup();
    render(<ProteomeComparisonPage />);

    await pickGroupAndAdd(user);
    expect(await screen.findByRole("status", { name: "Loading" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();

    release();
  });

  it("drops a group read that a reset overtook", async () => {
    const beforeReset = openableGate();
    const afterReset = openableGate();
    const answered = serveGroupReads([
      { count: 2, gate: beforeReset.promise },
      { count: 1, gate: afterReset.promise },
    ]);
    const user = userEvent.setup();
    render(<ProteomeComparisonPage />);

    await pickGroupAndAdd(user);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await pickGroupAndAdd(user);
    expect(await screen.findByRole("status", { name: "Loading" })).toBeVisible();

    // The read started before the reset finishes while the new one is pending:
    // it must not add its group to the new comparison, nor stop the spinner of
    // the add started after the reset.
    act(() => {
      beforeReset.open();
    });
    await waitFor(() => {
      expect(answered).toEqual([0]);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.queryByText("2 genome(s)")).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: "Loading" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Add genome group" }),
    ).toBeDisabled();

    act(() => {
      afterReset.open();
    });

    expect(await screen.findByText("1 genome(s)")).toBeVisible();
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(
      "Added genome group with 1 genome(s)",
      expect.anything(),
    );
    expect(screen.queryByText("2 genome(s)")).toBeNull();
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
    });
  });

  it("refuses a genome whose lookup ends after a group filled the list", async () => {
    const lookup = openableGate();
    let looked = false;
    server.use(
      http.post("*/api/services/genome/by-ids", async () => {
        await lookup.promise;
        looked = true;
        return HttpResponse.json({
          results: [{ genome_id: genomeId, genome_name: "Late genome" }],
        });
      }),
    );
    serveGroup(9);
    const user = userEvent.setup();
    render(<ProteomeComparisonPage />);

    await user.click(screen.getByRole("button", { name: "Pick Select genome" }));
    await user.click(screen.getByRole("button", { name: "Add genome" }));
    expect(await screen.findByRole("status", { name: "Loading" })).toBeVisible();

    // The group takes all nine slots while the genome's name is still loading.
    await pickGroupAndAdd(user);
    expect(await screen.findByText("9 genome(s)")).toBeVisible();

    act(() => {
      lookup.open();
    });
    await waitFor(() => {
      expect(looked).toBe(true);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Maximum genomes reached",
        expect.objectContaining({
          description: "Maximum of 9 comparison genomes allowed.",
        }),
      );
    });
    expect(screen.queryByText("Late genome")).toBeNull();
    expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
  });
});
