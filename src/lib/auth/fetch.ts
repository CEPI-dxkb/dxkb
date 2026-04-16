import { getActiveAuthStore } from "@/lib/auth/store";

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const store = getActiveAuthStore();
  if (store) return store.authenticatedFetch(input, init);
  return fetch(input, { ...init, credentials: "include" });
}
