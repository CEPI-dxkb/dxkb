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
  uiPreferenceKeys,
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
  const persistedRef = useRef(initialPreferences);

  // React state is the source of truth; the cookies mirror it for the next server
  // render. Writing after commit keeps the state updater pure, so callers can still
  // wrap updates in startTransition.
  useEffect(() => {
    const secure = window.location.protocol === "https:";
    for (const key of uiPreferenceKeys) {
      if (!Object.is(preferences[key], persistedRef.current[key])) {
        document.cookie = serializeUiPreferenceCookie(key, preferences[key], {
          secure,
        });
      }
    }
    persistedRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    for (const { name, path } of legacyUiPreferenceCookies) {
      document.cookie = `${name}=; Path=${path}; Max-Age=0; SameSite=Lax`;
    }
  }, []);

  const setPreference = <K extends UiPreferenceKey>(
    key: K,
    update: PreferenceUpdate<UiPreferences[K]>,
  ) => {
    setPreferences((current) => {
      const next = isUpdater(update) ? update(current[key]) : update;
      return Object.is(next, current[key])
        ? current
        : { ...current, [key]: next };
    });
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
