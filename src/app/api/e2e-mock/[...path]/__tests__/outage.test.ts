import { NextRequest } from "next/server";
import {
  makeRouteContext,
  mockNextRequest,
} from "@/test-helpers/api-route-helpers";
import {
  maintenanceSummary,
  outageRecords,
  outageSessionToken,
} from "@/lib/e2e-fixtures/outages";
import { summarizeUpstreamBody } from "@/lib/api/upstream-failure";
import { DELETE, GET, POST, PUT } from "../route";

const loopback = "http://localhost:3020/api/e2e-mock";
const userId = "e2e-test-user@patricbrc.org";

function ctx(path: string) {
  return makeRouteContext({ path: path.split("/") });
}

function rpc(path: string, method: string, token?: string): NextRequest {
  return mockNextRequest({
    method: "POST",
    url: `${loopback}/${path}`,
    body: { id: 1, method, params: [], jsonrpc: "2.0" },
    headers: token ? { Authorization: token } : {},
  });
}

const originalMockEnabled = process.env.E2E_MOCK_ENABLED;

beforeEach(() => {
  process.env.E2E_MOCK_ENABLED = "1";
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalMockEnabled === undefined) {
    delete process.env.E2E_MOCK_ENABLED;
  } else {
    process.env.E2E_MOCK_ENABLED = originalMockEnabled;
  }
});

async function expectMaintenancePage(response: Response): Promise<void> {
  expect(response.status).toBe(503);
  expect(response.statusText).toBe("Service Unavailable");
  expect(response.headers.get("Content-Type")).toBe("text/html");
  const body = await response.text();
  expect(summarizeUpstreamBody(body, "text/html")).toBe(maintenanceSummary);
}

describe("api/e2e-mock outages — session", () => {
  it("answers every call to a named service with the maintenance page", async () => {
    const token = outageSessionToken(userId, { workspace: "maintenance" });

    // A method the healthy dispatch serves, and one it would reject.
    await expectMaintenancePage(
      await POST(rpc("workspace", "Workspace.ls", token), ctx("workspace")),
    );
    await expectMaintenancePage(
      await POST(rpc("workspace", "Workspace.create", token), ctx("workspace")),
    );
  });

  it("reads the token behind an OAuth or Bearer prefix", async () => {
    const token = outageSessionToken(userId, { "app-service": "maintenance" });

    for (const authorization of [`OAuth ${token}`, `Bearer ${token}`]) {
      await expectMaintenancePage(
        await POST(
          rpc(
            "app-service",
            "AppService.query_task_summary_filtered",
            authorization,
          ),
          ctx("app-service"),
        ),
      );
    }
  });

  it("takes the user service's profile lookup down", async () => {
    const response = await GET(
      mockNextRequest({
        url: `${loopback}/user/${encodeURIComponent(userId)}`,
        headers: {
          Authorization: outageSessionToken(userId, { user: "maintenance" }),
        },
      }),
      ctx(`user/${userId}`),
    );

    await expectMaintenancePage(response);
  });

  it("leaves the services the token does not name healthy", async () => {
    const token = outageSessionToken(userId, { workspace: "maintenance" });

    const response = await POST(
      rpc("app-service", "AppService.query_task_summary_filtered", token),
      ctx("app-service"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: {} });
  });

  it("answers PUT and DELETE the same way", async () => {
    const headers = {
      Authorization: outageSessionToken(userId, { workspace: "maintenance" }),
    };
    await expectMaintenancePage(
      await PUT(
        mockNextRequest({ method: "PUT", url: `${loopback}/workspace`, headers }),
        ctx("workspace"),
      ),
    );
    await expectMaintenancePage(
      await DELETE(
        mockNextRequest({
          method: "DELETE",
          url: `${loopback}/workspace`,
          headers,
        }),
        ctx("workspace"),
      ),
    );
  });

  it("rejects a directive naming an unknown service or shape", async () => {
    const response = await POST(
      rpc(
        "workspace",
        "Workspace.ls",
        `un=${userId}|e2e-outage=workspace:meltdown|t`,
      ),
      ctx("workspace"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "e2e-mock: invalid e2e outage request",
      reason: expect.stringContaining("unknown outage shape 'meltdown'") as unknown,
    });
  });
});

describe("api/e2e-mock outages — records", () => {
  const { genomeId, taxonId, keyword } = outageRecords.maintenance;

  it("fails a genome read that names the outage genome", async () => {
    const response = await GET(
      mockNextRequest({
        url: `${loopback}/data/genome/?eq(genome_id,${genomeId})&limit(1)`,
      }),
      ctx("data/genome"),
    );

    await expectMaintenancePage(response);
  });

  it("fails the website API's lookup of the outage taxon", async () => {
    const response = await GET(
      mockNextRequest({ url: `${loopback}/bvbrc-website/taxonomy/${taxonId}` }),
      ctx(`bvbrc-website/taxonomy/${taxonId}`),
    );

    await expectMaintenancePage(response);
  });

  it("fails a multi-query search whose body carries the outage keyword", async () => {
    const response = await POST(
      mockNextRequest({
        method: "POST",
        url: `${loopback}/data/query/`,
        body: {
          genome: {
            dataType: "genome",
            accept: "application/solr+json",
            query: `and(keyword(${keyword}))&limit(10)`,
          },
        },
      }),
      ctx("data/query"),
    );

    await expectMaintenancePage(response);
  });

  it("matches whole terms only", async () => {
    // The outage taxon id inside the outage genome id, and inside a longer one.
    for (const query of [`eq(taxon_id,1${taxonId})`, `eq(genome_id,${genomeId}0)`]) {
      const response = await GET(
        mockNextRequest({ url: `${loopback}/data/genome/?${query}` }),
        ctx("data/genome"),
      );
      expect(response.status).toBe(200);
    }
  });

  it("does not take a non-data service down", async () => {
    const response = await POST(
      mockNextRequest({
        method: "POST",
        url: `${loopback}/workspace`,
        body: {
          id: 1,
          method: "Workspace.ls",
          params: [{ paths: [`/${userId}/home/${genomeId}`] }],
          jsonrpc: "2.0",
        },
      }),
      ctx("workspace"),
    );

    expect(response.status).toBe(200);
  });
});

describe("api/e2e-mock outages — hang", () => {
  it("answers only once the caller gives up", async () => {
    const controller = new AbortController();
    const request = new NextRequest(
      `${loopback}/data/genome/?eq(genome_id,${outageRecords.hang.genomeId})`,
      { signal: controller.signal },
    );
    let settled = false;
    const pending = GET(request, ctx("data/genome")).then((response) => {
      settled = true;
      return response;
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);

    controller.abort();
    const response = await pending;
    expect(response.status).toBe(504);
  });

  it("gives up on its own after the longest production budget", async () => {
    vi.useFakeTimers();
    try {
      const pending = GET(
        mockNextRequest({
          url: `${loopback}/data/genome/?eq(genome_id,${outageRecords.hang.genomeId})`,
        }),
        ctx("data/genome"),
      );
      await vi.advanceTimersByTimeAsync(75_000);
      expect((await pending).status).toBe(504);
    } finally {
      vi.useRealTimers();
    }
  });
});
