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
   * Throw on the ls call with this message instead of returning lsResult.
   */
  lsThrow?: string;
  /**
   * Map of method+sequence-index → error to throw. Sequence index is per-method.
   * e.g. { "Workspace.create:0": "boom" } throws on the first create call.
   */
  createErrors?: Record<number, string>;
}

function createFakeRpc(options: FakeRpcOptions = {}): {
  port: WorkspaceRpcPort;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  let createIndex = 0;
  const port: WorkspaceRpcPort = {
    async call<T>(method: string, params: unknown[]): Promise<T> {
      calls.push({ method, params });
      if (method === "Workspace.ls") {
        if (options.lsThrow) throw new Error(options.lsThrow);
        return (options.lsResult ?? [{}]) as T;
      }
      if (method === "Workspace.create") {
        const error = options.createErrors?.[createIndex];
        createIndex += 1;
        if (error) throw new Error(error);
        return [[]] as T;
      }
      throw new Error(`Unexpected method ${method}`);
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
      lsThrow: "_ERROR_User lacls permission",
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
});
