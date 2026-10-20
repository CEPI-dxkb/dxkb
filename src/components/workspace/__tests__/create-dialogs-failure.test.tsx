import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { CreateFolderDialog } from "@/components/workspace/create-folder-dialog";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import {
  useWorkspaceDialog,
  WorkspaceDialogProvider,
} from "@/contexts/workspace-dialog-context";
import { useWorkspaceDialogHandlers } from "@/hooks/services/workspace/use-workspace-dialog-handlers";
import { server } from "@/test-helpers/msw-server";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const timedOut =
  "The BV-BRC workspace service did not respond (connection timed out after 10 s).";

interface RpcBody {
  method: string;
  params: [{ objects: [string, string][] }];
}

/** `Workspace.create` answers after a short wait; the rest of the proxy is unused. */
function createAnswers(answer: () => Response) {
  const created: string[] = [];
  server.use(
    http.post("/api/services/workspace", async ({ request }) => {
      const body = (await request.json()) as RpcBody;
      if (body.method !== "Workspace.create") throw new Error(`Unexpected ${body.method}`);
      created.push(body.params[0].objects[0][0]);
      await delay(30);
      return answer();
    }),
  );
  return created;
}

const outage = () =>
  HttpResponse.json({ error: timedOut, code: "upstream" }, { status: 504 });

function Harness({ kind }: { kind: "folder" | "workspace" }) {
  const { state, dispatch } = useWorkspaceDialog();
  const { handleCreateFolder, handleCreateWorkspace, isDialogLoading } =
    useWorkspaceDialogHandlers({
      currentDirectoryPath: "/alice@bvbrc/home",
      currentUserWorkspaceRoot: "/alice@bvbrc",
      username: "alice@bvbrc",
      myWorkspaceRoot: "alice@bvbrc",
      clearSelection: vi.fn(),
    });
  const close = (open: boolean) => {
    if (!open) dispatch({ type: "CLOSE" });
  };
  return (
    <>
      <button
        type="button"
        onClick={() => {
          dispatch({
            type: kind === "folder" ? "OPEN_CREATE_FOLDER" : "OPEN_CREATE_WORKSPACE",
          });
        }}
      >
        Open
      </button>
      <CreateFolderDialog
        open={state.activeDialog?.type === "createFolder"}
        onOpenChange={close}
        onCreateFolder={handleCreateFolder}
        isCreating={isDialogLoading}
      />
      <CreateWorkspaceDialog
        open={state.activeDialog?.type === "createWorkspace"}
        onOpenChange={close}
        onCreateWorkspace={handleCreateWorkspace}
        isCreating={isDialogLoading}
      />
    </>
  );
}

function renderHarness(kind: "folder" | "workspace") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <WorkspaceDialogProvider>{children}</WorkspaceDialogProvider>
      </QueryClientProvider>
    );
  }
  render(<Harness kind={kind} />, { wrapper: Wrapper });
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Create Folder when the workspace service fails", () => {
  it("stays open while pending, then shows the reason inline and keeps the name", async () => {
    const created = createAnswers(outage);
    renderHarness("folder");

    const input = await screen.findByLabelText("Folder name");
    fireEvent.change(input, { target: { value: "crawl-test-folder" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Folder" }));

    expect(await screen.findByRole("button", { name: /Creating/ })).toBeDisabled();

    const inline = await screen.findByRole("alert");
    expect(inline).toHaveTextContent(
      `Couldn't create folder "crawl-test-folder": ${timedOut}`,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Folder name")).toHaveValue("crawl-test-folder");
    expect(created).toEqual(["/alice@bvbrc/home/crawl-test-folder"]);
    expect(toast.error).toHaveBeenCalledWith("Couldn't create folder", {
      description: `crawl-test-folder: ${timedOut}`,
    });
  });

  it("closes once the folder exists", async () => {
    createAnswers(() => HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [[]] }));
    renderHarness("folder");

    fireEvent.change(await screen.findByLabelText("Folder name"), {
      target: { value: "results" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Folder" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("Create Workspace when the workspace service fails", () => {
  it("stays open with the reason inline and one titled toast", async () => {
    createAnswers(outage);
    renderHarness("workspace");

    fireEvent.change(await screen.findByLabelText("Workspace name"), {
      target: { value: "crawl-ws" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Workspace" }));

    const inline = await screen.findByRole("alert");
    expect(inline).toHaveTextContent(`Couldn't create workspace "crawl-ws": ${timedOut}`);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Couldn't create workspace", {
      description: `crawl-ws: ${timedOut}`,
    });
  });
});
