import { getRequiredEnv } from "@/lib/env";

export async function getProfileMetadata(
  token: string,
  username: string,
): Promise<Record<string, unknown> | null> {
  try {
    const userResponse = await fetch(
      `${getRequiredEnv("USER_URL")}/${encodeURIComponent(username)}`,
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

export async function getUserEmailByUsername(
  username: string,
): Promise<string | null> {
  try {
    const userResponse = await fetch(
      `${getRequiredEnv("USER_URL")}/${encodeURIComponent(username)}`,
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
