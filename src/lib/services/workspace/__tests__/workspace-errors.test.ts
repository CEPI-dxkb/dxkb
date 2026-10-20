import { UpstreamError } from "@/lib/api/upstream-failure";
import { WorkspaceApiError } from "@/lib/services/workspace/domain";
import {
  isWorkspaceHomeMissing,
  isWorkspaceObjectMissing,
  workspaceErrorMessage,
} from "@/lib/services/workspace/workspace-errors";

const timedOut =
  "The BV-BRC workspace service did not respond (connection timed out after 10 s).";

/** What `rpc()` throws for the proxy's answer to a JSON-RPC error inside a 500. */
function rpcError(message: string, status = 500) {
  return new WorkspaceApiError(
    message,
    "Workspace.get",
    { code: -32603, message },
    status,
  );
}

/** What `WorkspaceApiClient.makeRequest` throws for the same answer. */
function clientError(upstreamMessage: string, status = 500) {
  return Object.assign(
    new Error(`BV-BRC API error: ${String(status)} Internal Server Error`),
    { status, apiResponse: { code: -32603, message: upstreamMessage } },
  );
}

describe("isWorkspaceObjectMissing", () => {
  it.each([
    ["an rpc 'Object not found'", rpcError("_ERROR_Object not found!_")],
    ["a client 'Object not found'", clientError("_ERROR_Object /u/home/x not found_ERROR_")],
    ["'lacks permission'", rpcError("_ERROR_User lacks permission to /u/home/_ERROR_")],
    ["'lacks permission' against its marker", rpcError("_ERROR_User lacks permission_ERROR_")],
    ["'Workspace not found'", rpcError("_ERROR_Workspace not found!_ERROR_")],
    ["'Workspace … does not exist'", rpcError("_ERROR_Workspace u@bvbrc/home does not exist!_ERROR_")],
    ["a marker-stripped 'Object not found'", new Error("Object not found!")],
    ["a 404", Object.assign(new Error("BV-BRC API error: 404 Not Found"), { status: 404 })],
  ])("is true for %s", (_label, error) => {
    expect(isWorkspaceObjectMissing(error)).toBe(true);
  });

  it.each([
    ["a 504 outage", new WorkspaceApiError(timedOut, "Workspace.get", timedOut, 504)],
    [
      "a 502 'host not found' outage",
      new WorkspaceApiError(
        "Could not reach the BV-BRC workspace service: host not found.",
        "Workspace.ls",
        undefined,
        502,
      ),
    ],
    [
      "a server-side UpstreamError",
      new UpstreamError({ status: 502, code: "service_unavailable", message: "Could not reach x: host not found." }),
    ],
    ["a browser network failure", new WorkspaceApiError("Failed to fetch", "Workspace.ls", undefined)],
    ["a generic 500", clientError("Internal error")],
    ["a JSON-RPC 'Method not found'", clientError("Method not found")],
    ["an rpc 'Method not found'", rpcError("Method not found")],
    ["'host not found' without an outage status", new Error("Could not reach the BV-BRC workspace service: host not found.")],
    ["an unrelated 'not found'", new Error("Download URL not found for the requested path")],
    ["no error", null],
  ])("is false for %s", (_label, error) => {
    expect(isWorkspaceObjectMissing(error)).toBe(false);
  });
});

describe("isWorkspaceHomeMissing", () => {
  it("is true for the permission error a missing home answers", () => {
    expect(
      isWorkspaceHomeMissing(new Error("_ERROR_User lacks permission to /a@bvbrc/home/_ERROR_")),
    ).toBe(true);
    expect(
      isWorkspaceHomeMissing(rpcError("_ERROR_Workspace a@bvbrc/home does not exist!_ERROR_")),
    ).toBe(true);
  });

  it("is false for 'not found', outages and other failures", () => {
    expect(isWorkspaceHomeMissing(new Error("_ERROR_Object not found!_"))).toBe(false);
    expect(
      isWorkspaceHomeMissing(
        new UpstreamError({ status: 504, code: "upstream_timeout", message: timedOut }),
      ),
    ).toBe(false);
    expect(isWorkspaceHomeMissing(new Error("Workspace API HTTP 503 Service Unavailable"))).toBe(
      false,
    );
    expect(isWorkspaceHomeMissing(clientError("Method not found"))).toBe(false);
  });
});

describe("workspaceErrorMessage", () => {
  it("prefers the Workspace's reason over the proxy's status label, without markers", () => {
    expect(workspaceErrorMessage(clientError("_ERROR_Object /u/home/x not found!_"), "fallback")).toBe(
      "Object /u/home/x not found!",
    );
    expect(
      workspaceErrorMessage(rpcError("_ERROR_User lacks permission to /u/home/_ERROR_"), "fallback"),
    ).toBe("User lacks permission to /u/home/");
  });

  it("keeps an outage message as is", () => {
    expect(
      workspaceErrorMessage(new WorkspaceApiError(timedOut, "Workspace.ls", timedOut, 504), "fallback"),
    ).toBe(timedOut);
  });

  it("falls back only when there is no message", () => {
    expect(workspaceErrorMessage(new Error(""), "fallback")).toBe("fallback");
  });
});
