import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "./actions";
import { protectedPageRequestHeader } from "../routes";

function requestDestination(
  fallbackPath: string,
  value: string | null,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallbackPath;
  }
  return value;
}

export async function requireCurrentUserOrRedirect(fallbackPath: string) {
  const user = await getCurrentUser();
  if (user) return user;

  const requestPath = (await headers()).get(protectedPageRequestHeader);
  const destination = requestDestination(fallbackPath, requestPath);
  redirect(`/sign-in?redirect=${encodeURIComponent(destination)}`);
}
