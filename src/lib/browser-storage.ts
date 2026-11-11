/** localStorage that never throws, plus an in-tab change signal (`storage` only fires in other tabs); a refused write is kept in memory for the session. */
const listeners = new Set<() => void>();
const unsavedItems = new Map<string, string | null>();

export function readStorageItem(key: string): string | null {
  // Node 25+ has a shared localStorage global of its own, so the server must not consult it.
  if (typeof window === "undefined") return null;
  if (unsavedItems.has(key)) return unsavedItems.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorageItem(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    unsavedItems.delete(key);
  } catch {
    unsavedItems.set(key, value);
  }
  for (const listener of listeners) listener();
}

export function subscribeToStorage(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
