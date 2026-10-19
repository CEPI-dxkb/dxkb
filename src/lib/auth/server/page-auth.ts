import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { encodeQueryComponent } from "@/lib/url";
import { safePostAuthDestination } from "@/lib/auth/redirect";

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

/**
 * The current user, or a redirect to sign-in when signed out. A user whose
 * session the profile service could not verify (`sessionUnverified`) is still
 * signed in, so the page renders and the navbar explains the outage.
 */
export async function requireCurrentUserOrRedirect(fallbackPath: string) {
  const user = await getCurrentUser();
  if (user) return user;

  const requestPath = (await headers()).get(protectedPageRequestHeader);
  const destination = requestDestination(fallbackPath, requestPath);
  redirect(`/sign-in?redirect=${encodeQueryComponent(destination)}`);
}

/**
 * Sends a signed-in user away from a sign-in or sign-up page, back to the
 * page's `?redirect=` destination when it is a same-origin path, else home.
 */
export async function redirectSignedInUser(
  destination: string | string[] | undefined,
): Promise<void> {
  if (!(await getCurrentUser())) return;
  redirect(
    safePostAuthDestination(typeof destination === "string" ? destination : "/"),
  );
}
