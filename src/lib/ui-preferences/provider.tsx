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
  // The latest value each setter asked for, which can be ahead of `preferences` while a render is pending.
  const requestedRef = useRef(initialPreferences);

  useEffect(() => {
    for (const { name, path } of legacyUiPreferenceCookies) {
      document.cookie = `${name}=; Path=${path}; Max-Age=0; SameSite=Lax`;
    }
  }, []);

  // The cookie is written in the setter, not an effect: a reload right after a click can land before a pending transition commits.
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

/** A persisted UI preference, `useState`-shaped; without a provider (unit tests) it is plain state. */
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
