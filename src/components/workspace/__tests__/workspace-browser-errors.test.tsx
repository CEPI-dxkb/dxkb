import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { WorkspaceBrowser } from "@/components/workspace/workspace-browser";
import { WorkspaceDialogProvider } from "@/contexts/workspace-dialog-context";
import { WorkspacePanelProvider } from "@/contexts/workspace-panel-context";
import { recentWorkspaceFoldersStorageKey } from "@/lib/recent-workspace-folders";
import { server } from "@/test-helpers/msw-server";
import { createUiPreferencesWrapper } from "@/test-helpers/react";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({
    user: {
      id: "alice",
      username: "alice",
      realm: "bvbrc",
      email: "alice@example.test",
    },
    status: "authed",
    isAuthenticated: true,
  }),
}));

class ResizeObserverStub {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const timedOut =
  "The BV-BRC workspace service did not respond (connection timed out after 10 s).";

interface RpcBody {
  method: string;
  params: [{ objects?: string[]; paths?: string[] }];
}

type Answer = (body: RpcBody) => Response | Promise<Response>;

const outage: Answer = () =>
  HttpResponse.json({ error: timedOut, code: "upstream" }, { status: 504 });

const objectNotFound: Answer = () =>
  HttpResponse.json(
    {
      error: "BV-BRC API error: 500 Internal Server Error",
      apiResponse: { code: -32603, message: "_ERROR_Object not found!_" },
    },
    { status: 500 },
  );

function rpcResult(result: unknown): Response {
  return HttpResponse.json({ id: 1, jsonrpc: "2.0", result });
}

function tuple(name: string, type: string, parent: string): unknown[] {
  return [name, type, parent, "2026-01-01T00:00:00Z", `id-${name}`, "alice@bvbrc", 0, {}, {}, "o", "n", ""];
}

/** `Workspace.get` of one path, as the path lookup expects it. */
function resolvesAs(name: string, type: string, parent: string): Answer {
  return () => rpcResult([[[tuple(name, type, parent)]]]);
}

function listing(path: string, names: string[]): Answer {
  return () =>
    rpcResult([{ [path]: names.map((name) => tuple(name, "folder", `${path}/`)) }]);
}

interface ProxyAnswers {
  ls: Answer;
  get?: Answer;
}

/**
 * The workspace proxy: `Workspace.ls` and the path lookup's `Workspace.get`
 * answer as given; the favorites file is missing. Records every method, and
 * every ensure-workspace call.
 */
function workspaceProxy(answers: ProxyAnswers) {
  const record = { methods: [] as string[], ensureCalls: 0 };
  server.use(
    http.post("/api/services/workspace", async ({ request }) => {
      const body = (await request.json()) as RpcBody;
      record.methods.push(body.method);
      const objects = body.params[0].objects ?? [];
      if (body.method === "Workspace.get" && objects[0]?.endsWith("favorites.json")) {
        return rpcResult([]);
      }
      if (body.method === "Workspace.ls") return answers.ls(body);
      if (body.method === "Workspace.get" && answers.get) return answers.get(body);
      if (body.method === "Workspace.list_permissions") return rpcResult([{}]);
      throw new Error(`Unexpected ${body.method}`);
    }),
    http.post("/api/auth/ensure-workspace", () => {
      record.ensureCalls += 1;
      return HttpResponse.json({ success: true, created: [], failures: {} });
    }),
  );
  return record;
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const UiPreferencesWrapper = createUiPreferencesWrapper();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <UiPreferencesWrapper>
        <QueryClientProvider client={queryClient}>
          <WorkspacePanelProvider>
            <WorkspaceDialogProvider>{children}</WorkspaceDialogProvider>
          </WorkspacePanelProvider>
        </QueryClientProvider>
      </UiPreferencesWrapper>
    );
  };
}

function renderBrowser(path: string) {
  return render(
    <WorkspaceBrowser
      mode="home"
      username="alice@bvbrc"
      path={path}
      workspaceGuideUrl="https://example.test/workspace-guide"
    />,
    { wrapper: makeWrapper() },
  );
}

function storedRecentPaths(): string[] {
  const raw = localStorage.getItem(recentWorkspaceFoldersStorageKey);
  return raw ? (JSON.parse(raw) as { path: string }[]).map((folder) => folder.path) : [];
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WorkspaceBrowser during a workspace outage", () => {
  it("shows the outage for a nested folder instead of 'Folder not found'", async () => {
    const proxy = workspaceProxy({ ls: outage, get: outage });

    renderBrowser("Experiments/run1");

    const alert = await screen.findByRole("alert", {}, { timeout: 5_000 });
    expect(alert).toHaveTextContent("Couldn't load this folder");
    expect(alert).toHaveTextContent(timedOut);
    expect(screen.queryByText("Folder not found")).not.toBeInTheDocument();
    expect(screen.queryByText("This folder is empty")).not.toBeInTheDocument();
    expect(screen.queryByText(/\(0 items\)/)).not.toBeInTheDocument();
    // The listing still ran: a failed lookup does not disable it.
    expect(proxy.methods).toContain("Workspace.ls");
  });

  it("shows the error row with Retry at home, without an item count or setup writes", async () => {
    const proxy = workspaceProxy({ ls: outage });

    renderBrowser("");

    const alert = await screen.findByRole("alert", {}, { timeout: 5_000 });
    expect(alert).toHaveTextContent("Couldn't load your home folder");
    expect(alert).toHaveTextContent(timedOut);
    expect(screen.queryByText("This folder is empty")).not.toBeInTheDocument();
    expect(screen.queryByText(/\(0 items\)/)).not.toBeInTheDocument();

    const lsCalls = () => proxy.methods.filter((method) => method === "Workspace.ls").length;
    expect(lsCalls()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(lsCalls()).toBe(2);
    });

    await settle();
    expect(proxy.ensureCalls).toBe(0);
    expect(storedRecentPaths()).toEqual([]);
    // Refresh of a failed listing sends no permissions lookup.
    expect(proxy.methods).not.toContain("Workspace.list_permissions");
  });
});

describe("WorkspaceBrowser when the folder is really missing", () => {
  it("shows 'Folder not found' when the Workspace says the object does not exist", async () => {
    workspaceProxy({ ls: listing("/alice@bvbrc/home/gone", []), get: objectNotFound });

    renderBrowser("gone");

    expect(
      await screen.findByText("Folder not found", {}, { timeout: 5_000 }),
    ).toBeInTheDocument();
    // Behind the dialog the table names the reason rather than "empty".
    expect(screen.getByText("Object not found!")).toBeInTheDocument();
    expect(screen.queryByText("This folder is empty")).not.toBeInTheDocument();
    expect(storedRecentPaths()).toEqual([]);
  });
});

describe("WorkspaceBrowser recently visited folders", () => {
  it("remembers a folder once it opened", async () => {
    workspaceProxy({
      ls: listing("/alice@bvbrc/home/Experiments", ["run1"]),
      get: resolvesAs("Experiments", "folder", "/alice@bvbrc/home/"),
    });

    renderBrowser("Experiments");

    await screen.findByRole("row", { name: /run1/ }, { timeout: 5_000 });
    await waitFor(() => {
      expect(storedRecentPaths()).toEqual(["/alice@bvbrc/home/Experiments"]);
    });
  });

  it("does not remember a file path", async () => {
    workspaceProxy({
      ls: () => rpcResult([{}]),
      get: resolvesAs("sample.fasta", "contigs", "/alice@bvbrc/home/reads/"),
    });

    renderBrowser("reads/sample.fasta");

    await screen.findByText("This folder is empty", {}, { timeout: 5_000 });
    await settle();
    expect(storedRecentPaths()).toEqual([]);
  });
});

describe("WorkspaceBrowser Retry keeps the error on screen", () => {
  const homePath = "/alice@bvbrc/home";
  const skeletons = () => document.querySelectorAll('[data-slot="skeleton"]');

  /** The first `Workspace.ls` fails; each later one waits for `release`. */
  function failThenHold() {
    let lsCalls = 0;
    const held: { release: (answer: Answer) => void } = { release: () => undefined };
    const proxy = workspaceProxy({
      ls: (body) => {
        lsCalls += 1;
        if (lsCalls === 1) return outage(body);
        return new Promise<Response>((resolve) => {
          held.release = (answer) => {
            resolve(answer(body));
          };
        });
      },
    });
    return { proxy, held, lsCalls: () => lsCalls };
  }

  async function retryAndExpectKeptError(lsCalls: () => number, clickRefresh = false) {
    await screen.findByRole("alert", {}, { timeout: 5_000 });
    fireEvent.click(
      screen.getByRole("button", { name: clickRefresh ? /^refresh$/i : "Retry" }),
    );
    await waitFor(() => {
      expect(lsCalls()).toBe(2);
    });
    const kept = await screen.findByRole("alert");
    expect(kept).toHaveTextContent("Couldn't load your home folder");
    expect(kept).toHaveTextContent(timedOut);
    expect(screen.getByRole("button", { name: /Retrying/ })).toBeDisabled();
    expect(skeletons()).toHaveLength(0);
    expect(screen.queryByText("This folder is empty")).not.toBeInTheDocument();
  }

  it("shows 'Retrying…' over the old error, then the rows", async () => {
    const { held, lsCalls } = failThenHold();
    renderBrowser("");

    await retryAndExpectKeptError(lsCalls);

    held.release(listing(homePath, ["Experiments"]));
    expect(
      await screen.findByRole("row", { name: /Experiments/ }, { timeout: 5_000 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("replaces the kept error with the retry's own failure", async () => {
    const { held, lsCalls } = failThenHold();
    renderBrowser("");

    await retryAndExpectKeptError(lsCalls);

    const refused =
      "Could not reach the BV-BRC workspace service: connection refused.";
    held.release(() =>
      HttpResponse.json({ error: refused, code: "upstream" }, { status: 502 }),
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(refused);
    });
    expect(screen.getByRole("alert")).not.toHaveTextContent(timedOut);
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  });

  it("keeps the error the same way on the toolbar Refresh", async () => {
    const { held, lsCalls } = failThenHold();
    renderBrowser("");

    await retryAndExpectKeptError(lsCalls, true);

    held.release(listing(homePath, ["Experiments"]));
    expect(
      await screen.findByRole("row", { name: /Experiments/ }, { timeout: 5_000 }),
    ).toBeInTheDocument();
  });
});

