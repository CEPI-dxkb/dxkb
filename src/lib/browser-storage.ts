/**
 * localStorage that never throws — private mode, a full quota, disabled storage and
 * the server all read as "nothing stored" — plus an in-tab change signal. The
 * browser's `storage` event only fires in *other* tabs, so writes made here notify
 * this tab's subscribers themselves.
 *
 * A write that storage refuses is kept in memory for this tab instead: it reads back
 * and notifies like any other write, so a toggle still works for the session and just
 * isn't remembered. The in-memory copy wins over whatever storage holds for that key
 * until the next write that storage accepts clears it.
 */
const listeners = new Set<() => void>();
const unsavedItems = new Map<string, string | null>();

export function readStorageItem(key: string): string | null {
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
