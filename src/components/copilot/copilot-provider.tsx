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
import { resolveCopilotModel } from "@/lib/copilot/models";
import { copilotPagePath } from "@/lib/copilot/paths";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import type { CopilotModel } from "@/lib/copilot/types";
import type { CopilotSurface } from "@/lib/ui-preferences/definitions";
import { useUiPreference } from "@/lib/ui-preferences/provider";

const modelStorageKey = "dxkb-copilot-model";

function sessionStorageKey(username: string): string {
  return `dxkb-copilot-session:${username}`;
}

interface CopilotContextValue {
  available: boolean;
  username: string | null;
  onCopilotPage: boolean;
  openSurface: CopilotSurface | null;
  preferredSurface: CopilotSurface;
  open: (surface?: CopilotSurface) => void;
  close: () => void;
  /** The open surface is folded into the edge tab: still mounted (chat, scroll and draft kept) but hidden and inert. */
  minimized: boolean;
  /** A turn ran while minimized; cleared on restore. */
  unread: boolean;
  minimize: () => void;
  restore: () => void;
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

/** Mounted once in the root layout; fetches nothing until a surface opens. */
export function CopilotProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const pathname = usePathname();
  const onCopilotPage = pathname === copilotPagePath;
  const [preferredSurface, setPreferredSurface] = useUiPreference("copilotSurface");
  const [openSurface, setOpenSurface] = useState<CopilotSurface | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [unread, setUnread] = useState(false);

  // Every way of closing, or of opening a surface, starts the next one open rather than minimized.
  const unminimize = () => {
    setMinimized(false);
    setUnread(false);
  };

  // The full page replaces the panel or window; leaving it does not reopen them.
  const [wasOnCopilotPage, setWasOnCopilotPage] = useState(onCopilotPage);
  if (onCopilotPage !== wasOnCopilotPage) {
    setWasOnCopilotPage(onCopilotPage);
    if (onCopilotPage) {
      setOpenSurface(null);
      unminimize();
    }
  }

  const available = user !== null;
  const active = available && (openSurface !== null || onCopilotPage);

  const storageKey = user ? sessionStorageKey(user.username) : null;
  const storedSession = useStorageItem(storageKey ?? sessionStorageKey(""));
  const sessionId = storageKey ? storedSession : null;

  useEffect(() => {
    if (active && storageKey && storedSession === null) {
      writeStorageItem(storageKey, crypto.randomUUID());
    }
  }, [active, storageKey, storedSession]);

  const modelsQuery = useCopilotModels(active);
  const models = modelsQuery.data ?? [];
  const storedModel = useStorageItem(modelStorageKey);
  const model = resolveCopilotModel(models, storedModel);

  const chat = useCopilotChat(user?.username ?? null);

  const visibleSurface = onCopilotPage || !available ? null : openSurface;
  const isMinimized = visibleSurface !== null && minimized;
  if (isMinimized && !unread && isCopilotTurnActive(chat.active?.turn ?? null)) {
    setUnread(true);
  }

  const value: CopilotContextValue = {
    available,
    username: user?.username ?? null,
    onCopilotPage,
    openSurface: visibleSurface,
    preferredSurface,
    open: (surface = preferredSurface) => {
      if (surface !== preferredSurface) setPreferredSurface(surface);
      setOpenSurface(surface);
      unminimize();
    },
    close: () => {
      setOpenSurface(null);
      unminimize();
    },
    minimized: isMinimized,
    unread: isMinimized && unread,
    minimize: () => {
      if (visibleSurface !== null) setMinimized(true);
    },
    restore: unminimize,
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
