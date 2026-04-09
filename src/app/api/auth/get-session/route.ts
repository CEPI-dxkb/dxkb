import { NextResponse } from "next/server";
import { getSession, createSession, deleteSession } from "@/lib/auth/session";
import { getRequiredEnv } from "@/lib/env";

/** BV-BRC user shape from profile cookie or /user API */
interface SessionUserInfo {
  id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  email_verified?: boolean;
}

/**
 * Get current session (better-auth style endpoint)
 * GET /api/auth/get-session
 */
export async function GET() {
  try {
    const { token, userId, realm } = await getSession();

    if (!token || !userId) {
      await deleteSession();
      return NextResponse.json({
        user: null,
        session: null,
      });
    }

    // Validate token against BV-BRC; default to invalid so failed fetch does not allow access
    let userInfo: SessionUserInfo | null = null;
    let isValid = false;

    try {
      const response = await fetch(
        `${getRequiredEnv("USER_URL")}/${userId}`,
        {
          headers: {
            Authorization: token,
            Accept: "application/json",
          },
        },
      );

      if (response.ok) {
        userInfo = (await response.json()) as SessionUserInfo;
        isValid = true;

        // Refresh auth cookies (ID only; profile is not stored in cookies)
        if (userId) {
          await createSession(token, userId, realm);
        }
      } else {
        isValid = false;
        await deleteSession();
      }
    } catch (error) {
      console.error("Session validation failed:", error);
      isValid = false;
      await deleteSession();
    }

    if (!isValid) {
      return NextResponse.json({
        user: null,
        session: null,
      });
    }

    // Return better-auth style response (same shape as sign-in)
    return NextResponse.json({
      user: {
        id: userInfo?.id || userId,
        username: userId,
        email: userInfo?.email || "",
        first_name: userInfo?.first_name || "",
        last_name: userInfo?.last_name || "",
        email_verified: userInfo?.email_verified || false,
        realm,
      },
      session: {
        token: "", // Token is in HTTP-only cookie
        expiresAt: new Date(Date.now() + 3600 * 4 * 1000).toISOString(),
      },
    });
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json(
      {
        user: null,
        session: null,
      },
      { status: 500 },
    );
  }
}
