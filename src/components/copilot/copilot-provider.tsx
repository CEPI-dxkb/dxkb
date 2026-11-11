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

  // The full page replaces the panel or window; leaving it does not reopen them.
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

  const value: CopilotContextValue = {
    available,
    username: user?.username ?? null,
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
