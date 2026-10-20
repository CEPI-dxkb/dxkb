import { http, HttpResponse } from "msw";
import { loadFavorites, toggleFavorite } from "@/lib/services/workspace/favorites";
import { server } from "@/test-helpers/msw-server";

const proxyUrl = "/api/services/workspace";
const userId = "alice@bvbrc";
const favoritesPath = "/alice@bvbrc/home/.preferences/favorites.json";
const timedOut =
  "The BV-BRC workspace service did not respond (connection timed out after 10 s).";

interface RpcBody {
  method: string;
  params: unknown[];
}

/** Answers each JSON-RPC method the proxy receives; records every call. */
function workspaceProxy(
  answers: Partial<Record<string, () => Response>>,
): { methods: string[] } {
  const record = { methods: [] as string[] };
  server.use(
    http.post(proxyUrl, async ({ request }) => {
      const body = (await request.json()) as RpcBody;
      record.methods.push(body.method);
      const answer = answers[body.method];
      if (!answer) throw new Error(`Unexpected ${body.method}`);
      return answer();
    }),
  );
  return record;
}

const outage = () =>
  HttpResponse.json({ error: timedOut, code: "upstream" }, { status: 504 });

const savedFavorites = () =>
  HttpResponse.json({
    id: 1,
    jsonrpc: "2.0",
    result: [
      [
        [
          [["favorites.json", "json", "/alice@bvbrc/home/.preferences/"]],
          JSON.stringify({ folders: ["/alice@bvbrc/home/a", "/alice@bvbrc/home/b"] }),
        ],
      ],
    ],
  });

describe("loadFavorites against the workspace proxy", () => {
  it("throws the outage instead of answering 'no favorites'", async () => {
    workspaceProxy({ "Workspace.get": outage });

    await expect(loadFavorites(userId)).rejects.toThrow(timedOut);
  });

  it("returns [] when the favorites file does not exist yet (the proxy's empty result)", async () => {
    // The proxy turns the Workspace's 404 for a preferences file into `result: []`.
    workspaceProxy({
      "Workspace.get": () => HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [] }),
    });

    await expect(loadFavorites(userId)).resolves.toEqual([]);
  });

  it("returns [] when the Workspace answers 'Object not found'", async () => {
    workspaceProxy({
      "Workspace.get": () =>
        HttpResponse.json(
          {
            error: "BV-BRC API error: 500 Internal Server Error",
            apiResponse: { code: -32603, message: `_ERROR_Object ${favoritesPath} not found!_` },
          },
          { status: 500 },
        ),
    });

    await expect(loadFavorites(userId)).resolves.toEqual([]);
  });

  it("returns the saved folders", async () => {
    workspaceProxy({ "Workspace.get": savedFavorites });

    await expect(loadFavorites(userId)).resolves.toEqual([
      "/alice@bvbrc/home/a",
      "/alice@bvbrc/home/b",
    ]);
  });
});

describe("toggleFavorite never overwrites favorites from a failed read", () => {
  it("aborts before any write when the read fails", async () => {
    const proxy = workspaceProxy({
      "Workspace.get": outage,
      "Workspace.create": () => HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [[]] }),
    });

    await expect(toggleFavorite(userId, "/alice@bvbrc/home/c")).rejects.toThrow(
      `Couldn't update favorites, nothing was changed: ${timedOut}`,
    );
    expect(proxy.methods).toEqual(["Workspace.get"]);
  });

  it("names the Workspace's reason, not the proxy's label, when the read fails", async () => {
    const proxy = workspaceProxy({
      "Workspace.get": () =>
        HttpResponse.json(
          {
            error: "BV-BRC API error: 500 Internal Server Error",
            apiResponse: { code: -32603, message: "_ERROR_Internal error reading object_ERROR_" },
          },
          { status: 500 },
        ),
    });

    await expect(toggleFavorite(userId, "/alice@bvbrc/home/c")).rejects.toThrow(
      "Couldn't update favorites, nothing was changed: Internal error reading object",
    );
    expect(proxy.methods).toEqual(["Workspace.get"]);
  });

  it("writes the saved folders plus the new one after a good read", async () => {
    let written: unknown;
    let gets = 0;
    server.use(
      http.post(proxyUrl, async ({ request }) => {
        const body = (await request.json()) as RpcBody;
        if (body.method === "Workspace.get") {
          gets += 1;
          // First the favorites file, then the .preferences folder check.
          return gets === 1
            ? savedFavorites()
            : HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [[["dir"]]] });
        }
        written = body.params[0];
        return HttpResponse.json({ id: 1, jsonrpc: "2.0", result: [[]] });
      }),
    );

    await expect(toggleFavorite(userId, "/alice@bvbrc/home/c")).resolves.toBe(true);
    const objects = (written as { objects: [string, string, object, string][] }).objects;
    expect(objects[0][0]).toBe(favoritesPath);
    expect(JSON.parse(objects[0][3])).toEqual({
      folders: ["/alice@bvbrc/home/a", "/alice@bvbrc/home/b", "/alice@bvbrc/home/c"],
    });
  });

  it("does not create the preferences folder when its existence check fails", async () => {
    let gets = 0;
    const methods: string[] = [];
    server.use(
      http.post(proxyUrl, async ({ request }) => {
        const body = (await request.json()) as RpcBody;
        methods.push(body.method);
        gets += body.method === "Workspace.get" ? 1 : 0;
        return gets === 1 && body.method === "Workspace.get"
          ? savedFavorites()
          : outage();
      }),
    );

    await expect(toggleFavorite(userId, "/alice@bvbrc/home/c")).rejects.toThrow(timedOut);
    expect(methods).toEqual(["Workspace.get", "Workspace.get"]);
  });
});
