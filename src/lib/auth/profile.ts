import { getRequiredEnv } from "@/lib/env";

export async function fetchUserProfile(
  username: string,
  token?: string,
): Promise<Record<string, unknown> | null> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers["Authorization"] = token;

  try {
    const response = await fetch(
      `${getRequiredEnv("USER_URL")}/${encodeURIComponent(username)}`,
      { headers },
    );

    if (response.ok) return await response.json();

    console.warn(`Failed to fetch user profile for ${username}:`, response.status);
    return null;
  } catch (error) {
    console.warn("Failed to fetch user profile:", error);
    return null;
  }
}
