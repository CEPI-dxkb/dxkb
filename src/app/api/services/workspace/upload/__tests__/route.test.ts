// @vitest-environment node
// The test serializes a real multipart body with Node's FormData and File,
// and the Shock handler parses it back; under jsdom those classes are
// jsdom's while the request machinery is Node's, so the two never agree. The
// route only runs on Node.

import { delay, http, HttpResponse } from "msw";

import { mockNextRequest, setTestSession } from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import {
  connectionRefused,
  maintenancePage,
  maintenanceSummary,
} from "@/test-helpers/upstream-failures";
import { POST } from "../route";

// The shape of Workspace.create's link_reference: the Shock API path under a
// bare SHOCK_ORIGINS origin.
const shockUrl =
  "https://shock.test/services/shock_api/node/793b90fb-8b53-4c8a-a525-54ef16bdb112";

beforeEach(() => {
  process.env.SHOCK_ORIGINS = "https://shock.test";
  setTestSession();
});

afterEach(() => {
  delete process.env.SHOCK_ORIGINS;
});

/** The multipart body the upload panel sends: one `upload` file part. */
async function multipartBody() {
  const form = new FormData();
  form.append("upload", new File(["ACGT"], "reads.fq"));
  const source = new Request("http://local.test", {
    method: "POST",
    body: form,
  });
  const rawBody = await source.arrayBuffer();
  return {
    rawBody,
    contentType: source.headers.get("content-type") ?? "",
    contentLength: String(rawBody.byteLength),
  };
}

async function uploadRequest(
  overrides: {
    nodeUrl?: string | null;
    /** A replacement, or a rewrite of the serialized body's own header. */
    contentType?: string | ((serialized: string) => string);
    contentLength?: string;
    signal?: AbortSignal;
  } = {},
) {
  const body = await multipartBody();
  const { contentType } = overrides;
  const headers: Record<string, string> = {
    "content-type":
      typeof contentType === "function"
        ? contentType(body.contentType)
        : (contentType ?? body.contentType),
    "content-length": overrides.contentLength ?? body.contentLength,
  };
  const nodeUrl = overrides.nodeUrl === undefined ? shockUrl : overrides.nodeUrl;
  if (nodeUrl !== null) headers["x-shock-node-url"] = nodeUrl;
  return {
    request: mockNextRequest({
      method: "POST",
      rawBody: body.rawBody,
      headers,
      signal: overrides.signal,
    }),
    ...body,
  };
}

describe("POST /api/services/workspace/upload", () => {
  it("streams the multipart body to the Shock node with OAuth auth", async () => {
    let seen:
      | {
          authorization: string | null;
          contentType: string | null;
          contentLength: string | null;
          uploadName: string | null;
          uploadText: string | null;
        }
      | undefined;
    server.use(
      http.put(shockUrl, async ({ request }) => {
        const authorization = request.headers.get("Authorization");
        const contentType = request.headers.get("content-type");
        const contentLength = request.headers.get("content-length");
        const upload = (await request.formData()).get("upload");
        seen = {
          authorization,
          contentType,
          contentLength,
          uploadName: upload instanceof File ? upload.name : null,
          uploadText: upload instanceof File ? await upload.text() : null,
        };
        return HttpResponse.json({ data: { id: "793b90fb" } });
      }),
    );

    const { request, contentType, contentLength } = await uploadRequest();
    const response = await POST(request, {});

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { id: "793b90fb" } });
    expect(seen).toEqual({
      authorization: "OAuth test-token",
      // Same boundary, so the forwarded bytes still parse.
      contentType,
      contentLength,
      uploadName: "reads.fq",
      uploadText: "ACGT",
    });
  });

  it("forwards the body to Shock before the browser has sent all of it", async () => {
    const { rawBody, contentType } = await multipartBody();
    const bytes = new Uint8Array(rawBody);
    const half = Math.floor(bytes.byteLength / 2);
    let source: ReadableStreamDefaultController<Uint8Array> | undefined;
    const browserBody = new ReadableStream<Uint8Array>({
      start(controller) {
        source = controller;
        controller.enqueue(bytes.slice(0, half));
      },
    });
    let firstChunkArrived: () => void = () => undefined;
    const firstChunk = new Promise<"first chunk">((resolve) => {
      firstChunkArrived = () => {
        resolve("first chunk");
      };
    });
    let received = 0;
    server.use(
      http.put(shockUrl, async ({ request }) => {
        if (!request.body) return HttpResponse.json({}, { status: 400 });
        for await (const chunk of request.body) {
          received += chunk.byteLength;
          firstChunkArrived();
        }
        return HttpResponse.json({});
      }),
    );

    const response = POST(
      mockNextRequest({
        method: "POST",
        rawBody: browserBody,
        headers: { "content-type": contentType, "x-shock-node-url": shockUrl },
      }),
      {},
    );
    const seen = await Promise.race([firstChunk, delay(2000)]);
    source?.enqueue(bytes.slice(half));
    source?.close();

    expect(seen).toBe("first chunk");
    expect((await response).status).toBe(200);
    expect(received).toBe(bytes.byteLength);
  });

  it("answers a refused Shock connection with 502 and the cause", async () => {
    server.use(
      http.put(shockUrl, () => {
        throw connectionRefused();
      }),
    );

    const response = await POST((await uploadRequest()).request, {});
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Could not reach the BV-BRC file storage service: connection refused.",
      code: "upstream",
    });
  });

  it("keeps Shock's status for a maintenance page without forwarding HTML as the message", async () => {
    server.use(http.put(shockUrl, () => maintenancePage()));

    const response = await POST((await uploadRequest()).request, {});
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      error: "Shock upload failed: 503 Service Unavailable",
      details: maintenanceSummary,
    });
    expect(text).not.toContain("<");
  });

  it("refuses a request without the Shock node URL header", async () => {
    const response = await POST(
      (await uploadRequest({ nodeUrl: null })).request,
      {},
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid 'X-Shock-Node-Url' header (Shock node URL)",
    });
  });

  it.each([
    ["a disallowed origin", "https://evil.test/services/shock_api/node/abc-123"],
    [
      "a path that is not a node",
      "https://shock.test/services/shock_api/node/abc-123/acl/owner",
    ],
    ["a non-Shock path ending in a node", "https://shock.test/other/node/abc-123"],
    ["a node outside the Shock API path", "https://shock.test/node/abc-123"],
    ["a query string", `${shockUrl}?download`],
    [
      "credentials in the URL",
      "https://user:pass@shock.test/services/shock_api/node/abc-123",
    ],
  ])("refuses a Shock node URL with %s", async (_case, nodeUrl) => {
    const response = await POST((await uploadRequest({ nodeUrl })).request, {});
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "URL is not an allowed Shock endpoint",
    });
  });

  it("refuses a body that is not multipart", async () => {
    const response = await POST(
      (await uploadRequest({ contentType: "application/octet-stream" }))
        .request,
      {},
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Expected a multipart/form-data body with an 'upload' file field",
    });
  });
  it("refuses a multipart content type without a boundary parameter", async () => {
    const response = await POST(
      (await uploadRequest({ contentType: "multipart/form-data" })).request,
      {},
    );
    expect(response.status).toBe(400);
  });

  it("accepts a boundary parameter in any letter case", async () => {
    let uploadText: string | null = null;
    server.use(
      http.put(shockUrl, async ({ request }) => {
        const upload = (await request.formData()).get("upload");
        uploadText = upload instanceof File ? await upload.text() : null;
        return HttpResponse.json({});
      }),
    );
    const response = await POST(
      (
        await uploadRequest({
          contentType: (serialized) =>
            serialized.replace("boundary=", "BOUNDARY="),
        })
      ).request,
      {},
    );
    expect(response.status).toBe(200);
    expect(uploadText).toBe("ACGT");
  });

  it("uses the API path of a SHOCK_ORIGINS entry that names one", async () => {
    process.env.SHOCK_ORIGINS = "https://other.test, https://shock.test/shock/";
    const nodeUrl = "https://shock.test/shock/node/abc-123";
    server.use(http.put(nodeUrl, () => HttpResponse.json({})));

    const accepted = await POST((await uploadRequest({ nodeUrl })).request, {});
    expect(accepted.status).toBe(200);
    const refused = await POST((await uploadRequest()).request, {});
    expect(refused.status).toBe(400);
  });

  it.each([
    ["an opaque-origin", "foo:bar", "foo:bar/node/abc-123"],
    ["a non-HTTP", "ftp://shock.test", "ftp://shock.test/services/shock_api/node/abc-123"],
  ])(
    "ignores %s SHOCK_ORIGINS entry",
    async (_case, shockOrigins, nodeUrl) => {
      process.env.SHOCK_ORIGINS = shockOrigins;
      const response = await POST((await uploadRequest({ nodeUrl })).request, {});
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "URL is not an allowed Shock endpoint",
      });
    },
  );

  it("refuses a request without a body", async () => {
    const { contentType } = await multipartBody();
    const response = await POST(
      mockNextRequest({
        method: "POST",
        headers: { "content-type": contentType, "x-shock-node-url": shockUrl },
      }),
      {},
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing or invalid 'upload' file",
    });
  });

  it("does not forward a content-length that is not a byte count", async () => {
    let contentLength: string | null = "unset";
    server.use(
      http.put(shockUrl, ({ request }) => {
        contentLength = request.headers.get("content-length");
        return HttpResponse.json({});
      }),
    );

    const response = await POST(
      (await uploadRequest({ contentLength: "12abc" })).request,
      {},
    );
    expect(response.status).toBe(200);
    expect(contentLength).not.toBe("12abc");
  });

  it("treats a redirect from Shock as a failed upload and releases its body", async () => {
    // MSW hands the route one branch of a tee'd body, so the cancel shows on
    // that stream, not on the source below.
    const cancel = vi.spyOn(ReadableStream.prototype, "cancel");
    try {
      server.use(
        http.put(
          shockUrl,
          () =>
            new HttpResponse(
              new ReadableStream({
                // Never closed: the route must not wait for its end.
                start(controller) {
                  controller.enqueue(new TextEncoder().encode("Moved"));
                },
              }),
              {
                status: 303,
                headers: { Location: "https://elsewhere.test/node/abc-123" },
              },
            ),
        ),
      );

      const response = await POST((await uploadRequest()).request, {});
      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({
        error:
          "Shock upload failed: 303 See Other (Shock redirected the upload, and redirects are not followed)",
        code: "upstream",
      });
      expect(cancel).toHaveBeenCalled();
    } finally {
      cancel.mockRestore();
    }
  });

  it("answers a cancelled upload without an error body or a log line", async () => {
    const controller = new AbortController();
    server.use(
      http.put(shockUrl, async () => {
        controller.abort();
        await delay("infinite");
        return HttpResponse.json({});
      }),
    );

    const response = await POST(
      (await uploadRequest({ signal: controller.signal })).request,
      {},
    );
    expect(response.status).toBe(499);
    await expect(response.text()).resolves.toBe("");
    expect(console.error).not.toHaveBeenCalled();
  });
});
