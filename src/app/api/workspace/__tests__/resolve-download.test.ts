import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { setTestSession, clearTestCookies } from "@/test-helpers/api-route-helpers";
import {
  buildWorkspacePath,
  resolveWorkspaceDownload,
} from "../resolve-download";

const workspaceApiUrl = "http://mock-workspace-api";
const shockUrl = "http://mock-shock/download/abc123";

beforeEach(() => {
  process.env.WORKSPACE_API_URL = workspaceApiUrl;
  clearTestCookies();
  setTestSession({ token: "user-token" });
});

afterEach(() => {
  delete process.env.WORKSPACE_API_URL;
});

describe("buildWorkspacePath", () => {
  // `segments` are what a catch-all route's already-decoded params.path
  // array looks like — building the path must not decode them again.

  it("joins segments without re-decoding them", () => {
    expect(buildWorkspacePath(["user", "home", "data.fasta"])).toBe(
      "/user/home/data.fasta",
    );
  });

  it("preserves a literal %2F inside a segment as one segment, not a new separator", () => {
    // A second decode here would turn "%2F" into a real "/", splitting
    // "weird%2Ffile.pdb" into "weird" and "file.pdb" — a different,
    // nonexistent workspace path.
    expect(
      buildWorkspacePath(["alice@bvbrc", "home", "weird%2Ffile.pdb"]),
    ).toBe("/alice@bvbrc/home/weird%2Ffile.pdb");
  });

  it("preserves literal percent text that is not valid percent-encoding", () => {
    expect(buildWorkspacePath(["alice@bvbrc", "100%done.pdb"])).toBe(
      "/alice@bvbrc/100%done.pdb",
    );
  });
});

describe("resolveWorkspaceDownload", () => {
  it("sends a segment containing literal %2F to the backend as one intact path, and uses it as the filename", async () => {
    let capturedBody: { params?: [{ objects?: string[] }] } | undefined;

    server.use(
      http.post(workspaceApiUrl, async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json({
          jsonrpc: "2.0",
          id: 1,
          result: [[shockUrl]],
        });
      }),
      http.get(shockUrl, () =>
        HttpResponse.text("file content", {
          headers: { "Content-Length": "12" },
        }),
      ),
    );

    const result = await resolveWorkspaceDownload([
      "alice@bvbrc",
      "home",
      "weird%2Ffile.pdb",
    ]);

    expect(capturedBody?.params?.[0]?.objects).toEqual([
      "/alice@bvbrc/home/weird%2Ffile.pdb",
    ]);
    expect("shockResponse" in result && result.filename).toBe(
      "weird%2Ffile.pdb",
    );
  });

  it("sends literal percent text through unchanged", async () => {
    let capturedBody: { params?: [{ objects?: string[] }] } | undefined;

    server.use(
      http.post(workspaceApiUrl, async ({ request }) => {
        capturedBody = (await request.json()) as typeof capturedBody;
        return HttpResponse.json({
          jsonrpc: "2.0",
          id: 1,
          result: [[shockUrl]],
        });
      }),
      http.get(shockUrl, () => HttpResponse.text("data")),
    );

    await resolveWorkspaceDownload(["alice@bvbrc", "100%done.pdb"]);

    expect(capturedBody?.params?.[0]?.objects).toEqual([
      "/alice@bvbrc/100%done.pdb",
    ]);
  });

  it("returns 401 when there is no session", async () => {
    clearTestCookies();

    const result = await resolveWorkspaceDownload(["alice@bvbrc", "file.pdb"]);

    expect("status" in result && result.status).toBe(401);
  });
});
