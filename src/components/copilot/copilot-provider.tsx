"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { useStorageItem } from "@/hooks/use-storage-item";
import {
  useCopilotChat,
  type CopilotChat,
} from "@/hooks/copilot/use-copilot-chat";
import { useCopilotModels } from "@/hooks/copilot/use-copilot-queries";
import { useAuth } from "@/lib/auth/provider";
import { writeStorageItem } from "@/lib/browser-storage";
import type { CopilotModel } from "@/lib/copilot/types";
import type { CopilotSurface } from "@/lib/ui-preferences/definitions";
import { useUiPreference } from "@/lib/ui-preferences/provider";

/** The full-page chat; the panel and floating window stay closed there. */
export const copilotPagePath = "/copilot";

const modelStorageKey = "dxkb-copilot-model";

function sessionStorageKey(username: string): string {
  return `dxkb-copilot-session:${username}`;
}

/**
 * The model to use: the user's last pick while the gateway still offers it,
 * else the gateway's default, else its first.
 */
export function resolveCopilotModel(
  models: CopilotModel[],
  stored: string | null,
): string | null {
  if (stored && models.some((model) => model.model === stored)) return stored;
  const fallback = models.find((model) => model.isDefault) ?? models.at(0);
  return fallback ? fallback.model : null;
}

interface CopilotContextValue {
  /** Signed in: the Copilot needs the user's BV-BRC session. */
  available: boolean;
  onCopilotPage: boolean;
  /** The surface showing now, outside the full page. */
  openSurface: CopilotSurface | null;
  /** Where the navbar button opens the chat. */
  preferredSurface: CopilotSurface;
  open: (surface?: CopilotSurface) => void;
  close: () => void;
  sessionId: string | null;
  selectSession: (sessionId: string) => void;
  newChat: () => void;
  models: CopilotModel[];
  modelsError: Error | null;
  modelsLoading: boolean;
  model: string | null;
  setModel: (model: string) => void;
  chat: CopilotChat;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

/**
 * Chat state shared by the side panel, the floating window and the `/copilot`
 * page, so switching between them keeps the conversation and a running
 * answer. Mounted once in the root layout; it fetches nothing until a surface
 * opens.
 */
export function CopilotProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const pathname = usePathname();
  const onCopilotPage = pathname === copilotPagePath;
  const [preferredSurface, setPreferredSurface] = useUiPreference("copilotSurface");
  const [openSurface, setOpenSurface] = useState<CopilotSurface | null>(null);

  // The full page replaces the panel or window; leaving it does not reopen
  // them. (State adjusted during render, as React advises for a change of
  // input, rather than in an effect.)
  const [wasOnCopilotPage, setWasOnCopilotPage] = useState(onCopilotPage);
  if (onCopilotPage !== wasOnCopilotPage) {
    setWasOnCopilotPage(onCopilotPage);
    if (onCopilotPage) setOpenSurface(null);
  }

  const available = user !== null;
  const active = available && (openSurface !== null || onCopilotPage);

  const storageKey = user ? sessionStorageKey(user.username) : null;
  const storedSession = useStorageItem(storageKey ?? sessionStorageKey(""));
  const sessionId = storageKey ? storedSession : null;

  // A user who has never chatted on this device starts with a fresh id; the
  // gateway creates the session with the first question.
  useEffect(() => {
    if (active && storageKey && storedSession === null) {
      writeStorageItem(storageKey, crypto.randomUUID());
    }
  }, [active, storageKey, storedSession]);

  const modelsQuery = useCopilotModels(active);
  const models = modelsQuery.data ?? [];
  const storedModel = useStorageItem(modelStorageKey);
  const model = resolveCopilotModel(models, storedModel);

  const chat = useCopilotChat();

  const value: CopilotContextValue = {
    available,
    onCopilotPage,
    openSurface: onCopilotPage ? null : openSurface,
    preferredSurface,
    open: (surface = preferredSurface) => {
      if (surface !== preferredSurface) setPreferredSurface(surface);
      setOpenSurface(surface);
    },
    close: () => {
      setOpenSurface(null);
    },
    sessionId,
    selectSession: (next) => {
      if (storageKey) writeStorageItem(storageKey, next);
    },
    newChat: () => {
      if (storageKey) writeStorageItem(storageKey, crypto.randomUUID());
      chat.dismissError();
    },
    models,
    modelsError: modelsQuery.error,
    modelsLoading: modelsQuery.isPending && active,
    model,
    setModel: (next) => {
      writeStorageItem(modelStorageKey, next);
    },
    chat,
  };

  return (
    <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>
  );
}

/** The Copilot, or null outside `<CopilotProvider>` (a navbar rendered alone). */
export function useOptionalCopilot(): CopilotContextValue | null {
  return useContext(CopilotContext);
}

export function useCopilot(): CopilotContextValue {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error("useCopilot must be used within <CopilotProvider>");
  }
  return context;
}
