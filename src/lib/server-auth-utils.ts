import { cookies } from "next/headers";
import { safeDecodeURIComponent } from "./auth-utils";

// Get server-side auth token from cookies
export async function getServerAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get("token")?.value;
  return rawToken ? safeDecodeURIComponent(rawToken) : undefined;
}

// Server-side authenticated fetch for API routes
export async function serverAuthenticatedFetch(
  url: string,
  options: RequestInit = {},
) {
  const token = await getServerAuthToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  const headers = {
    ...options.headers,
    Authorization: token,
    "Content-Type": "application/json",
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}
