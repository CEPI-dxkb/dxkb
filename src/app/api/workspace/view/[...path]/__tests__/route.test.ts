import { http, HttpResponse } from "msw";
import { GET } from "@/app/api/workspace/view/[...path]/route";
import {
  makeRouteContext,
  mockNextRequest,
  setTestSession,
} from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import { connectTimeout } from "@/test-helpers/upstream-failures";

const workspaceApiUrl = "https://p3.theseed.test/services/Workspace";
const timedOut =
  "The BV-BRC workspace service did not respond (connection timed out after 10 s).";
const documentHeaders = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "sec-fetch-dest": "document",
};

function viewRequest(segments: string[], headers: Record<string, string> = {}) {
  return mockNextRequest({
    url: `http://localhost:3019/api/workspace/view/${segments.join("/")}`,
    headers,
  });
}

beforeEach(() => {
  process.env.WORKSPACE_API_URL = workspaceApiUrl;
  setTestSession();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  delete process.env.WORKSPACE_API_URL;
  vi.restoreAllMocks();
});

describe("GET /api/workspace/view opened as a document", () => {
  const path = ["u@bvbrc", "home", "reads", "sample.fasta"];

  it("answers an outage with a readable page, not raw JSON", async () => {
    server.use(
      http.post(workspaceApiUrl, () => {
        throw connectTimeout();
      }),
    );

    const response = await GET(
      viewRequest(path, documentHeaders),
      makeRouteContext({ path }),
    );

    expect(response.status).toBe(504);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const html = await response.text();
    expect(html).toContain("<title>Couldn&#39;t open sample.fasta</title>");
    expect(html).toContain(timedOut);
    expect(html).toContain('<a href="/workspace/u@bvbrc/home/reads">Back to the folder</a>');
    expect(html).not.toContain('{"error"');
  });

  it("renders a missing download URL as a page too, escaping the file name", async () => {
    const odd = ["u@bvbrc", "home", "<b>&.txt"];
    server.use(
      http.post(workspaceApiUrl, () => HttpResponse.json({ id: 1, result: [[]] })),
    );

    const response = await GET(
      viewRequest(odd, { accept: "text/html" }),
      makeRouteContext({ path: odd }),
    );

    expect(response.status).toBe(404);
    const html = await response.text();
    expect(html).toContain("Couldn&#39;t open &lt;b&gt;&amp;.txt");
    expect(html).not.toContain("<b>&");
    expect(html).toContain("Download URL not found for the requested path");
  });

  it("blames a Workspace reply that times out mid-body on the workspace, not file storage", async () => {
    // MSW does not tie the request signal to a mocked body, so the stream
    // errors the way undici's does when `AbortSignal.timeout` fires mid-body.
    server.use(
      http.post(
        workspaceApiUrl,
        () =>
          new HttpResponse(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('{"result":'));
                controller.error(
                  new DOMException("The operation was aborted due to timeout", "TimeoutError"),
                );
              },
            }),
          ),
      ),
    );

    const response = await GET(
      viewRequest(path, { accept: "*/*" }),
      makeRouteContext({ path }),
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: "The BV-BRC workspace service did not respond (timed out after 30 s).",
      code: "upstream",
    });
  });

  it("keeps the JSON answer for fetch callers", async () => {
    server.use(
      http.post(workspaceApiUrl, () => {
        throw connectTimeout();
      }),
    );

    const response = await GET(
      viewRequest(path, { accept: "*/*" }),
      makeRouteContext({ path }),
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({ error: timedOut, code: "upstream" });
  });
});
