import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";

import ProteomeComparisonPage from "../page";
import { server } from "@/test-helpers/msw-server";

const { groupPath } = vi.hoisted(() => ({
  groupPath: "/user@bvbrc/home/big-group",
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

vi.mock("@/components/services/single-genome-selector", () => ({
  SingleGenomeSelector: () => null,
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

/** Answers the group's `Workspace.get` with a group of `count` genomes. */
function serveGroup(count: number, gate?: Promise<void>) {
  const genomeIds = Array.from({ length: count }, (_, i) => `${String(i)}.1`);
  server.use(
    http.post("*/api/services/workspace", async () => {
      await gate;
      return HttpResponse.json({
        result: [
          [[{ path: groupPath }, JSON.stringify({ id_list: { genome_id: genomeIds } })]],
        ],
      });
    }),
  );
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
});
