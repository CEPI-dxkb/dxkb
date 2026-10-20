// @vitest-environment node
// The route reads multipart form data and checks `instanceof File`; under
// jsdom the test's File and FormData are jsdom's while the request parser is
// Node's, so the two never agree. The route only runs on Node.

import { http, HttpResponse } from "msw";

import { mockNextRequest, setTestSession } from "@/test-helpers/api-route-helpers";
import { server } from "@/test-helpers/msw-server";
import {
  connectionRefused,
  maintenancePage,
  maintenanceSummary,
} from "@/test-helpers/upstream-failures";
import { POST } from "../route";

const shockUrl = "https://shock.test/node/abc";

beforeEach(() => {
  process.env.SHOCK_ORIGINS = "https://shock.test";
  setTestSession();
});

afterEach(() => {
  delete process.env.SHOCK_ORIGINS;
});

function uploadRequest() {
  const form = new FormData();
  form.set("url", shockUrl);
  form.set("file", new File(["ACGT"], "reads.fq"));
  return mockNextRequest({ method: "POST", rawBody: form });
}

describe("POST /api/services/workspace/upload", () => {
  it("PUTs the file to Shock with OAuth auth", async () => {
    let authorization: string | null = null;
    server.use(
      http.put(shockUrl, ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json({ data: { id: "abc" } });
      }),
    );

    const response = await POST(uploadRequest(), {});
    expect(response.status).toBe(200);
    expect(authorization).toBe("OAuth test-token");
  });

  it("answers a refused Shock connection with 502 and the cause", async () => {
    server.use(
      http.put(shockUrl, () => {
        throw connectionRefused();
      }),
    );

    const response = await POST(uploadRequest(), {});
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Could not reach the BV-BRC file storage service: connection refused.",
      code: "upstream",
    });
  });

  it("keeps Shock's status for a maintenance page without forwarding HTML as the message", async () => {
    server.use(http.put(shockUrl, () => maintenancePage()));

    const response = await POST(uploadRequest(), {});
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      error: "Shock upload failed: 503 Service Unavailable",
      details: maintenanceSummary,
    });
    expect(text).not.toContain("<");
  });
});
