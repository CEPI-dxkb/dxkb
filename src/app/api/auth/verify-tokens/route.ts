import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearAuthCookies, safeDecodeURIComponent } from "../utils";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get("token")?.value;
    const token = rawToken ? safeDecodeURIComponent(rawToken) : undefined;
    const username = cookieStore.get("user_id")?.value;
    const realm = cookieStore.get("realm")?.value;
    const userProfileCookie = cookieStore.get("user_profile")?.value;

    if (!token || !username) {
      return NextResponse.json({
        isAuthenticated: false,
        message: "No authentication cookies found",
      });
    }

    // Check if we have user profile in cookie first
    let userInfo: {
      first_name?: string;
      last_name?: string;
      email?: string;
      email_verified?: boolean;
      id?: string;
    } | null = null;
    let isValid = false;

    if (userProfileCookie) {
      try {
        userInfo = JSON.parse(userProfileCookie);
        isValid = true; // If we have a valid cookie, assume it's valid
      } catch (error) {
        console.warn("Failed to parse user_profile cookie:", error);
      }
    }

    try {
      const response = await fetch(
        `https://user.patricbrc.org/user/${username}`,
        {
          headers: {
            Authorization: token,
            Accept: "application/json",
          },
        },
      );

      if (response.ok) {
        userInfo = await response.json();
        isValid = true;

        // Update user_profile cookie with fresh data from BV-BRC
        if (userInfo) {
          const profileData = {
            first_name: userInfo.first_name,
            last_name: userInfo.last_name,
            email: userInfo.email,
            email_verified: userInfo.email_verified,
            id: userInfo.id,
            username: username,
            realm: realm,
          };

          const responseCookies = await cookies();
          responseCookies.set("user_profile", JSON.stringify(profileData), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 3600, // 1 hour
            path: "/",
          });
        }
      }
    } catch (error) {
      console.error("User validation failed:", error);
      isValid = false;
    }

    console.log("isValid", isValid);
    if (!isValid) {
      // Clear invalid cookies
      await clearAuthCookies();

      return NextResponse.json({
        isAuthenticated: false,
        message: "Invalid authentication token",
      });
    }

    // Return public user information (no sensitive data)
    return NextResponse.json({
      isAuthenticated: true,
      user: {
        username,
        email: userInfo?.email,
        first_name: userInfo?.first_name,
        last_name: userInfo?.last_name,
        realm,
        email_verified: userInfo?.email_verified,
        id: userInfo?.id,
      },
    });
  } catch (error) {
    console.error("Error verifying authentication:", error);
    return NextResponse.json(
      {
        isAuthenticated: false,
        message: "Authentication verification failed",
      },
      { status: 500 },
    );
  }
}
