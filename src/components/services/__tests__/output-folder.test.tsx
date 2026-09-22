import { act, fireEvent, render, screen } from "@testing-library/react";

import OutputFolder from "@/components/services/output-folder";
import { checkWorkspaceObjectExists } from "@/lib/services/workspace/validation";

vi.mock("@/lib/services/workspace/validation", () => ({
  checkWorkspaceObjectExists: vi.fn(),
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ user: { username: "alice" } }),
}));

vi.mock("@/hooks/services/workspace/use-workspace-object-search", () => ({
  useWorkspaceObjectSearch: () => ({
    objects: [
      {
        id: "folder-id",
        name: "Experiment Groups",
        path: "/alice@bvbrc/home/Experiment Groups",
        type: "folder",
        isDirectory: true,
      },
      {
        id: "job-result-id",
        name: ".ERR7916262_Microbiome_BV-BRC_0.5_test",
        path: "/alice@bvbrc/home/Taxonomic Classification/.ERR7916262_Microbiome_BV-BRC_0.5_test",
        type: "job_result",
        isDirectory: true,
      },
      {
        id: "path-only-job-result-id",
        name: "ERR7916263_Microbiome_BV-BRC_0.5_test",
        path: "/alice@bvbrc/home/Taxonomic Classification/.ERR7916263_Microbiome_BV-BRC_0.5_test",
        type: "job_result",
        isDirectory: true,
      },
      {
        id: "hidden-parent-folder-id",
        name: "Visible Child",
        path: "/alice@bvbrc/home/.hidden/Visible Child",
        type: "folder",
        isDirectory: true,
      },
    ],
    filteredObjects: [],
    loading: false,
    error: null,
    searchQuery: "",
    setSearchQuery: vi.fn(),
    search: vi.fn(),
  }),
}));

const checkWorkspaceObjectExistsMock = vi.mocked(checkWorkspaceObjectExists);

beforeEach(() => {
  vi.useFakeTimers();
  checkWorkspaceObjectExistsMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function finishDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(350);
  });
}

describe("OutputFolder folder selection", () => {
  it("does not offer dot folders as output destinations", async () => {
    render(<OutputFolder title={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Show suggestions" }));
    await act(async () => {
      await vi.advanceTimersToNextTimerAsync();
    });

    expect(
      screen.getByRole("option", { name: /Experiment Groups/i }),
    ).toBeVisible();
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(
      screen.queryByRole("option", { name: /ERR791626[23]/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Visible Child/i }),
    ).not.toBeInTheDocument();
  });
});

describe("OutputFolder name validation", () => {
  it("keeps a previously validated name invalid while revalidating it", async () => {
    checkWorkspaceObjectExistsMock.mockResolvedValue(false);
    const onValidationChange = vi.fn();
    const { rerender } = render(
      <OutputFolder
        title={false}
        variant="name"
        value="result"
        outputFolderPath="/user/home"
        onValidationChange={onValidationChange}
      />,
    );

    await finishDebounce();
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "false",
    );

    rerender(
      <OutputFolder
        title={false}
        variant="name"
        value="other"
        outputFolderPath="/user/home"
        onValidationChange={onValidationChange}
      />,
    );
    rerender(
      <OutputFolder
        title={false}
        variant="name"
        value="result"
        outputFolderPath="/user/home"
        onValidationChange={onValidationChange}
      />,
    );

    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(onValidationChange).toHaveBeenLastCalledWith(false);
  });

  it("clears a stale name conflict while validating a new key", async () => {
    checkWorkspaceObjectExistsMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const { rerender } = render(
      <OutputFolder
        title={false}
        variant="name"
        value="result"
        outputFolderPath="/user/home"
      />,
    );

    await finishDebounce();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "An object with this name already exists in the selected folder.",
    );

    rerender(
      <OutputFolder
        title={false}
        variant="name"
        value="result-2"
        outputFolderPath="/user/home"
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await finishDebounce();
    expect(checkWorkspaceObjectExistsMock).toHaveBeenLastCalledWith(
      "/user/home/result-2",
      expect.any(Object),
    );
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("cancels a stale lookup when the output name changes", async () => {
    let resolveFirstCheck: ((exists: boolean) => void) | undefined;
    checkWorkspaceObjectExistsMock
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            resolveFirstCheck = resolve;
          }),
      )
      .mockResolvedValueOnce(false);
    const onValidationChange = vi.fn();
    const { rerender } = render(
      <OutputFolder
        title={false}
        variant="name"
        value="first"
        outputFolderPath="/user/home"
        onValidationChange={onValidationChange}
      />,
    );

    await finishDebounce();
    const firstSignal = checkWorkspaceObjectExistsMock.mock.calls[0][1]?.signal;

    rerender(
      <OutputFolder
        title={false}
        variant="name"
        value="second"
        outputFolderPath="/user/home"
        onValidationChange={onValidationChange}
      />,
    );

    expect(firstSignal?.aborted).toBe(true);
    act(() => {
      resolveFirstCheck?.(true);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await finishDebounce();
    expect(checkWorkspaceObjectExistsMock).toHaveBeenLastCalledWith(
      "/user/home/second",
      expect.any(Object),
    );
    expect(onValidationChange).toHaveBeenLastCalledWith(true);
  });

  it("keeps lookup failures invalid and allows a later retry", async () => {
    checkWorkspaceObjectExistsMock
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(false);
    const onValidationChange = vi.fn();
    const { rerender } = render(
      <OutputFolder
        title={false}
        variant="name"
        value="result"
        outputFolderPath="/user/home"
        onValidationChange={onValidationChange}
      />,
    );

    await finishDebounce();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to validate this name. Please try again.",
    );
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(onValidationChange).toHaveBeenLastCalledWith(false);

    rerender(
      <OutputFolder
        title={false}
        variant="name"
        value="result-2"
        outputFolderPath="/user/home"
        onValidationChange={onValidationChange}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await finishDebounce();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(onValidationChange).toHaveBeenLastCalledWith(true);
  });
});
