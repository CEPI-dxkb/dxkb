"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { serializeUiPreferenceCookie } from "./cookie";
import {
  defaultUiPreferences,
  legacyUiPreferenceCookies,
  type UiPreferenceKey,
  type UiPreferences,
} from "./definitions";

// Only a component and a hook are exported from here. Constants and types live in
// definitions.ts so Server Components can import them (see the note there).

type PreferenceUpdate<T> = T | ((current: T) => T);

function isUpdater<T>(update: PreferenceUpdate<T>): update is (current: T) => T {
  return typeof update === "function";
}

interface UiPreferencesContextValue {
  preferences: UiPreferences;
  setPreference: <K extends UiPreferenceKey>(
    key: K,
    update: PreferenceUpdate<UiPreferences[K]>,
  ) => void;
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(
  null,
);

export function UiPreferencesProvider({
  initialPreferences,
  children,
}: PropsWithChildren<{ initialPreferences: UiPreferences }>) {
  const [preferences, setPreferences] = useState(initialPreferences);
  // The latest value each setter asked for, which can be ahead of `preferences` while
  // a render (or a startTransition) is still pending.
  const requestedRef = useRef(initialPreferences);

  useEffect(() => {
    for (const { name, path } of legacyUiPreferenceCookies) {
      document.cookie = `${name}=; Path=${path}; Max-Age=0; SameSite=Lax`;
    }
  }, []);

  // The cookie is written inside the setter, not from an effect after commit. A
  // reload or full navigation right after a click or drag can land before a pending
  // render commits (the view rail toggles in a transition), and the next server render
  // would then restore the old value. The state updater stays pure and touches only
  // its own key, so a transition still defers just its own change.
  const setPreference = <K extends UiPreferenceKey>(
    key: K,
    update: PreferenceUpdate<UiPreferences[K]>,
  ) => {
    const current = requestedRef.current[key];
    const next = isUpdater(update) ? update(current) : update;
    if (Object.is(next, current)) return;
    requestedRef.current = { ...requestedRef.current, [key]: next };
    document.cookie = serializeUiPreferenceCookie(key, next, {
      secure: window.location.protocol === "https:",
    });
    setPreferences((state) =>
      Object.is(state[key], next) ? state : { ...state, [key]: next },
    );
  };

  return (
    <UiPreferencesContext.Provider value={{ preferences, setPreference }}>
      {children}
    </UiPreferencesContext.Provider>
  );
}

/**
 * A persisted UI preference, `useState`-shaped. Without a provider (isolated unit
 * tests) it behaves like plain component state: same default, nothing persisted.
 * The app always has one, mounted by the root layout.
 */
export function useUiPreference<K extends UiPreferenceKey>(
  key: K,
): readonly [
  UiPreferences[K],
  (update: PreferenceUpdate<UiPreferences[K]>) => void,
] {
  const context = useContext(UiPreferencesContext);
  const [localValue, setLocalValue] = useState<UiPreferences[K]>(
    defaultUiPreferences[key],
  );
  if (context === null) return [localValue, setLocalValue] as const;
  return [
    context.preferences[key],
    (update) => {
      context.setPreference(key, update);
    },
  ] as const;
}
