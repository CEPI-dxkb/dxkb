"use server";

import { redirect } from "next/navigation";
import { safePostAuthDestination } from "@/lib/auth/redirect";
import { signOut } from "@/lib/auth/server/actions";

export async function signOutAndRedirect(formData: FormData) {
  try {
    await signOut();
  } catch (cause) {
    console.error("signOut failed; redirecting anyway", { cause });
  }
  const redirectTo = formData.get("redirectTo");
  redirect(
    safePostAuthDestination(typeof redirectTo === "string" ? redirectTo : "/"),
  );
}
