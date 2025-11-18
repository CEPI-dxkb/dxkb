import { cookies } from "next/headers";
import { safeDecodeURIComponent } from "../../../lib/auth-utils";

// Re-export for backward compatibility
export { safeDecodeURIComponent };

// Helper function to fetch user profile metadata from BV-BRC
export async function getProfileMetadata(
  token: string,
  username: string,
): Promise<any | null> {
  try {
    const userResponse = await fetch(
      `https://user.bv-brc.org/user/${username}`,
      {
        headers: {
          Authorization: token,
          Accept: "application/json",
        },
      },
    );

    if (userResponse.ok) {
      return await userResponse.json();
    }

    console.warn(
      `Failed to fetch user profile for ${username}:`,
      userResponse.status,
    );
    return null;
  } catch (error) {
    console.warn("Failed to fetch user profile metadata:", error);
    return null;
  }
}

// Helper function to fetch user email by username for password reset
export async function getUserEmailByUsername(
  username: string,
): Promise<string | null> {
  try {
    const userResponse = await fetch(
      `https://user.bv-brc.org/user/${username}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (userResponse.ok) {
      const userData = await userResponse.json();
      return userData.email || null;
    }

    console.warn(
      `Failed to fetch user email for ${username}:`,
      userResponse.status,
    );
    return null;
  } catch (error) {
    console.warn("Failed to fetch user email by username:", error);
    return null;
  }
}

// Helper function to set authentication cookies
export async function setAuthCookies(
  token: string,
  username: string,
  realm?: string,
  userProfile?: any,
) {
  const cookieStore = await cookies();
  const maxAge = 3600 * 4; // 4 hours

  // Set token cookie
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: maxAge,
    path: "/",
  });

  // Create auth cookie with JSON containing token
  const authData = JSON.stringify({ token });
  cookieStore.set("auth", authData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: maxAge,
    path: "/",
  });

  if (realm) {
    cookieStore.set("realm", realm, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: maxAge,
      path: "/",
    });
  }

  // Set user profile cookie if we have user data
  if (userProfile) {
    cookieStore.set("user_profile", JSON.stringify(userProfile), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: maxAge,
      path: "/",
    });
  }

  cookieStore.set(
    "user_id",
    userProfile.id || username.match(/[A-Za-z\W0-9]+(?=[@])/)?.[0] || username,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: maxAge,
      path: "/",
    },
  );
}

// Helper function to clear all authentication cookies
export async function clearAuthCookies() {
  const cookieStore = await cookies();

  // Clear all authentication cookies by setting them to expire immediately
  cookieStore.set("token", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  cookieStore.set("auth", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  cookieStore.set("refresh_token", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  cookieStore.set("user_id", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  cookieStore.set("realm", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  cookieStore.set("user_profile", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
}
