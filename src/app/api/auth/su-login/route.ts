import { NextRequest, NextResponse } from "next/server";
import {
  getSession,
  createSession,
  createSuBackup,
  extractRealmFromToken,
  sessionMaxAge,
} from "@/lib/auth/session";
import { getRequiredEnv } from "@/lib/env";
import { fetchUserProfile } from "@/lib/auth/profile";
import { allowAdminToAdminImpersonation } from "@/lib/auth/su";

export async function POST(request: NextRequest) {
  try {
    const { targetUser, password } = await request.json();

    if (!targetUser || !password) {
      return NextResponse.json(
        { message: "Target user and password are required" },
        { status: 400 },
      );
    }

    // Verify current user is authenticated
    const { token, userId, realm } = await getSession();
    if (!token || !userId) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 },
      );
    }

    // Re-verify admin role from upstream
    const adminProfile = await fetchUserProfile(userId, token);

    if (!(adminProfile?.roles as string[] | undefined)?.includes("admin")) {
      return NextResponse.json(
        { message: "Admin role required" },
        { status: 403 },
      );
    }

    // Call BV-BRC sulogin endpoint
    const authUrl = getRequiredEnv("USER_AUTH_URL");
    const suResponse = await fetch(`${authUrl}/sulogin`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        targetUser,
        password,
        username: userId,
      }),
    });

    if (!suResponse.ok) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 },
      );
    }

    const targetToken = (await suResponse.text()).trim();
    if (!targetToken) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Fetch target user profile (used for response and optional admin-check)
    const targetRealm = extractRealmFromToken(targetToken);
    const targetProfile = await fetchUserProfile(targetUser, targetToken);

    // Optionally block admin-to-admin impersonation
    if (
      !allowAdminToAdminImpersonation &&
      (targetProfile?.roles as string[] | undefined)?.includes("admin")
    ) {
      return NextResponse.json(
        { message: "Cannot impersonate another admin" },
        { status: 403 },
      );
    }

    // Backup current admin session
    await createSuBackup(token, userId, realm);

    // Set target user's session
    await createSession(targetToken, targetUser, targetRealm);

    return NextResponse.json({
      user: {
        id: (targetProfile?.id as string) || targetUser,
        username: targetUser,
        email: (targetProfile?.email as string) || "",
        first_name: (targetProfile?.first_name as string) || "",
        last_name: (targetProfile?.last_name as string) || "",
        email_verified: (targetProfile?.email_verified as boolean) || false,
        realm: targetRealm,
        roles: (targetProfile?.roles as string[]) || [],
        isImpersonating: true,
        originalUsername: userId,
      },
      session: {
        token: "",
        expiresAt: new Date(Date.now() + sessionMaxAge * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error("SU login error:", error);
    return NextResponse.json(
      { message: "Authentication service unavailable" },
      { status: 503 },
    );
  }
}
