import { UpstreamError } from "@/lib/api/upstream-failure";
import {
  ensureUserWorkspace,
  expectedHomeSubfolders,
  type WorkspaceRpcPort,
} from "../setup";

interface RecordedCall {
  method: string;
  params: unknown[];
}

interface FakeRpcOptions {
  /**
   * If provided, the ls call returns this raw result. Otherwise, ls throws
   * a `userLacksPermission` error to simulate a missing /home/.
   */
  lsResult?: unknown;
  /**
   * Throw on the ls call with this message (or error) instead of returning lsResult.
   */
  lsThrow?: string | Error;
  /**
   * Map of method+sequence-index → error to throw. Sequence index is per-method.
   * e.g. { "Workspace.create:0": "boom" } throws on the first create call.
   */
  createErrors?: Record<number, string | Error>;
}

function createFakeRpc(options: FakeRpcOptions = {}): {
  port: WorkspaceRpcPort;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  let createIndex = 0;
  const port: WorkspaceRpcPort = {
    call<T>(method: string, params: unknown[]): Promise<T> {
      try {
        calls.push({ method, params });
        if (method === "Workspace.ls") {
          if (options.lsThrow) {
            throw options.lsThrow instanceof Error
              ? options.lsThrow
              : new Error(options.lsThrow);
          }
          return Promise.resolve((options.lsResult ?? [{}]) as T);
        }
        if (method === "Workspace.create") {
          const error = options.createErrors?.[createIndex];
          createIndex += 1;
          if (error) throw error instanceof Error ? error : new Error(error);
          return Promise.resolve([[]] as T);
        }
        throw new Error(`Unexpected method ${method}`);
      } catch (err) {
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    },
  };
  return { port, calls };
}

function lsResultWithSubfolders(homePath: string, names: string[]): unknown {
  return [
    {
      [homePath]: names.map((name) => [name, "folder", homePath]),
    },
  ];
}

const userId = "alice";
const realm = "bvbrc";
const homePath = `/${userId}@${realm}/home/`;

describe("ensureUserWorkspace", () => {
  it("creates home + all sub-folders when ls reports an empty workspace", async () => {
    const { port, calls } = createFakeRpc({
      lsThrow: "_ERROR_User lacks permission",
    });

    const result = await ensureUserWorkspace({ rpc: port, userId, realm });

    expect(calls[0]).toEqual({
      method: "Workspace.ls",
      params: [
        { paths: [homePath], includeSubDirs: false, Recursive: false },
      ],
    });
    expect(calls[1]).toEqual({
      method: "Workspace.create",
      params: [{ objects: [[homePath, "Directory"]] }],
    });
    expect(calls[2]).toEqual({
      method: "Workspace.create",
      params: [
        {
          objects: expectedHomeSubfolders.map((name) => [
            `/${userId}@${realm}/home/${name}`,
            "Directory",
          ]),
        },
      ],
    });
    expect(result.created).toEqual([
      homePath,
      ...expectedHomeSubfolders.map(
        (name) => `/${userId}@${realm}/home/${name}`,
      ),
    ]);
    expect(result.failures).toEqual({});
  });

  it("does nothing when home + all four sub-folders already exist", async () => {
    const { port, calls } = createFakeRpc({
      lsResult: lsResultWithSubfolders(homePath, [...expectedHomeSubfolders]),
    });

    const result = await ensureUserWorkspace({ rpc: port, userId, realm });

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("Workspace.ls");
    expect(result.created).toEqual([]);
    expect(result.failures).toEqual({});
  });

  it("creates only the missing sub-folders when home exists", async () => {
    const { port, calls } = createFakeRpc({
      lsResult: lsResultWithSubfolders(homePath, [
        "Genome Groups",
        "Experiments",
      ]),
    });

    const result = await ensureUserWorkspace({ rpc: port, userId, realm });

    expect(calls).toHaveLength(2);
    expect(calls[0].method).toBe("Workspace.ls");
    expect(calls[1]).toEqual({
      method: "Workspace.create",
      params: [
        {
          objects: [
            [`/${userId}@${realm}/home/Feature Groups`, "Directory"],
            [`/${userId}@${realm}/home/Experiment Groups`, "Directory"],
          ],
        },
      ],
    });
    expect(result.created).toEqual([
      `/${userId}@${realm}/home/Feature Groups`,
      `/${userId}@${realm}/home/Experiment Groups`,
    ]);
  });

  it("ignores non-folder entries when computing missing sub-folders", async () => {
    const { port, calls } = createFakeRpc({
      lsResult: [
        {
          [homePath]: [
            ...expectedHomeSubfolders.map((name) => [name, "folder", homePath]),
            ["readme.txt", "txt", homePath],
          ],
        },
      ],
    });

    const result = await ensureUserWorkspace({ rpc: port, userId, realm });

    expect(calls).toHaveLength(1);
    expect(result.created).toEqual([]);
  });

  it("records per-batch create failures without aborting the run", async () => {
    const { port } = createFakeRpc({
      lsThrow: "_ERROR_User lacks permission",
      // First create (home) succeeds; second create (sub-folders batch) fails.
      createErrors: { 1: "Sub-folder batch failed" },
    });

    const result = await ensureUserWorkspace({ rpc: port, userId, realm });

    expect(result.created).toEqual([homePath]);
    expect(result.failures).toEqual(
      Object.fromEntries(
        expectedHomeSubfolders.map((name) => [
          `/${userId}@${realm}/home/${name}`,
          "Sub-folder batch failed",
        ]),
      ),
    );
  });

  it("records the home create failure and still attempts the sub-folder batch", async () => {
    const { port, calls } = createFakeRpc({
      lsThrow: "_ERROR_User lacks permission",
      createErrors: { 0: "Home create blew up" },
    });

    const result = await ensureUserWorkspace({ rpc: port, userId, realm });

    // Home create failed but we still issued the sub-folder batch.
    expect(calls.filter((c) => c.method === "Workspace.create")).toHaveLength(2);
    expect(result.failures[homePath]).toBe("Home create blew up");
    expect(result.created).toEqual(
      expectedHomeSubfolders.map((name) => `/${userId}@${realm}/home/${name}`),
    );
  });

  it("uses the provided realm in every path it constructs", async () => {
    const { port, calls } = createFakeRpc({
      lsThrow: "_ERROR_User lacks permission",
    });

    await ensureUserWorkspace({ rpc: port, userId: "bob", realm: "dxkb" });

    const allPaths: string[] = [];
    for (const call of calls) {
      const firstParam = call.params[0] as { paths?: string[]; objects?: unknown[][] };
      if (firstParam.paths) allPaths.push(...firstParam.paths);
      if (firstParam.objects) {
        for (const obj of firstParam.objects) {
          if (Array.isArray(obj) && typeof obj[0] === "string") {
            allPaths.push(obj[0]);
          }
        }
      }
    }
    expect(allPaths.length).toBeGreaterThan(0);
    for (const path of allPaths) {
      expect(path.startsWith("/bob@dxkb/")).toBe(true);
    }
  });

  describe("when ls fails for a reason other than a missing home", () => {
    const outage = new UpstreamError({
      status: 504,
      code: "upstream_timeout",
      message:
        "The BV-BRC workspace service did not respond (connection timed out after 10 s).",
    });

    it.each([
      ["an outage", outage],
      ["a maintenance page", new Error("Workspace API HTTP 503 Service Unavailable")],
      ["an unrelated JSON-RPC error", new Error("_ERROR_Internal failure_ERROR_")],
    ])("rethrows %s and creates nothing", async (_label, lsError) => {
      const { port, calls } = createFakeRpc({ lsThrow: lsError });

      await expect(
        ensureUserWorkspace({ rpc: port, userId, realm }),
      ).rejects.toBe(lsError);
      expect(calls.map((call) => call.method)).toEqual(["Workspace.ls"]);
    });
  });

  it("stops writing when the service stops answering mid-run", async () => {
    const outage = new UpstreamError({
      status: 504,
      code: "upstream_timeout",
      message: "The BV-BRC workspace service did not respond (timed out after 30 s).",
    });
    const { port, calls } = createFakeRpc({
      lsThrow: "_ERROR_User lacks permission",
      createErrors: { 0: outage },
    });

    await expect(
      ensureUserWorkspace({ rpc: port, userId, realm }),
    ).rejects.toBe(outage);
    expect(calls.filter((c) => c.method === "Workspace.create")).toHaveLength(1);
  });
});
