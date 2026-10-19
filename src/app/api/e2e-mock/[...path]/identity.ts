import { NextRequest, NextResponse } from "next/server";
import { buildLoopbackRpcSuccess } from "@/lib/e2e-fixtures/envelopes";

const e2eAdminProfile = {
  id: "e2e-test-user@patricbrc.org",
  email: "e2e@example.com",
  email_verified: true,
  first_name: "E2E",
  middle_name: "",
  last_name: "User",
  creation_date: "2026-01-01T00:00:00Z",
  l_id: "e2e-test-user",
  last_login: "2026-01-01T00:00:00Z",
  organisms: "",
  reverification: false,
  source: "bvbrc",
  roles: ["admin"],
};

const e2eTargetProfile = {
  id: "e2e-target-user@patricbrc.org",
  email: "target@example.com",
  email_verified: true,
  first_name: "Target",
  middle_name: "",
  last_name: "User",
  creation_date: "2026-01-02T00:00:00Z",
  l_id: "e2e-target-user",
  last_login: "2026-01-02T00:00:00Z",
  organisms: "",
  reverification: false,
  source: "bvbrc",
  roles: [],
};

// A session whose profile lookup always hits a maintenance outage, for the spec
// that checks an outage keeps a signed-in user signed in (auth-outage.spec.ts).
const e2eOutageUserId = "e2e-outage-user@patricbrc.org";
const maintenancePage =
  "<!DOCTYPE html><html><head><title>503 Service Unavailable</title></head><body><h1>BV-BRC is undergoing scheduled maintenance</h1></body></html>";

const e2eAdminToken = "un=e2e-test-user@patricbrc.org|e2e-admin-token";
const e2eTargetToken = "un=e2e-target-user@patricbrc.org|e2e-target-token";

function tokenResponse(token: string): NextResponse {
  return new NextResponse(token, {
    status: 200,
    headers: { Authorization: token, "Content-Type": "text/plain" },
  });
}

function requestedUserId(path: string): string | null {
  const encodedUserId = path.slice("user/".length);
  if (!encodedUserId) return null;
  try {
    return decodeURIComponent(encodedUserId);
  } catch {
    return null;
  }
}

export function handleIdentityGet(path: string): NextResponse | null {
  if (!path.startsWith("user/")) return null;

  const userId = requestedUserId(path);
  if (userId === e2eAdminProfile.id || userId === e2eAdminProfile.l_id) {
    return NextResponse.json(e2eAdminProfile);
  }
  if (userId === e2eTargetProfile.id || userId === e2eTargetProfile.l_id) {
    return NextResponse.json(e2eTargetProfile);
  }
  if (userId === e2eOutageUserId) {
    return new NextResponse(maintenancePage, {
      status: 503,
      headers: { "Content-Type": "text/html" },
    });
  }
  return NextResponse.json({ error: "User not found" }, { status: 404 });
}

export async function handleIdentityPost(
  path: string,
  request: NextRequest,
  rpcMethod?: string,
): Promise<NextResponse | null> {
  if (path === "user-auth/sulogin") {
    const form = new URLSearchParams(await request.clone().text());
    if (
      form.get("username") !== e2eAdminProfile.id ||
      form.get("targetUser") !== e2eTargetProfile.l_id ||
      !form.get("password")
    ) {
      return new NextResponse("Invalid SU login", { status: 401 });
    }
    return tokenResponse(e2eTargetToken);
  }
  if (path === "user-auth") {
    const form = new URLSearchParams(await request.clone().text());
    if (
      form.get("username") !== e2eAdminProfile.l_id ||
      !form.get("password")
    ) {
      return new NextResponse("Invalid username or password", { status: 401 });
    }
    return tokenResponse(e2eAdminToken);
  }
  if (path === "user-register") return tokenResponse(e2eAdminToken);
  if (path === "user-password-reset" || path === "user-verification") {
    return NextResponse.json({ success: true });
  }
  if (path === "user" && rpcMethod === "setPassword") {
    return NextResponse.json(buildLoopbackRpcSuccess(true));
  }
  return null;
}
