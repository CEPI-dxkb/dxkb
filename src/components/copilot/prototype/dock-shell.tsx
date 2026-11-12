"use client";

// PROTOTYPE (DXKBCORE-342): question — "How does AskClark stay available (minimized) and stay open
// without covering pagination, the action rail or other page controls?" Three variants, switched
// with `?variant=A|B|C` (or the bar at the bottom). No param = today's side sheet / floating window.
//
// The shell wraps the whole app in the root layout. The dock is never drawn over the page: the
// page gets right/bottom padding equal to the dock, so every control keeps its own space.

import { useEffect, useState, type ReactNode } from "react";
import { useCopilotSession } from "@/hooks/copilot/use-copilot-queries";
import { useStorageItem } from "@/hooks/use-storage-item";
import { writeStorageItem } from "@/lib/browser-storage";
import { isCopilotTurnActive } from "@/lib/copilot/turn";
import type { CopilotSurface } from "@/lib/ui-preferences/definitions";
import { useOptionalCopilot } from "../copilot-provider";
import {
  DockProvider,
  useAskClarkVariant,
  type DockApi,
  type DockProps,
  type DockState,
  type DockSummary,
  type TabPlacement,
  type VariantKey,
} from "./dock-state";
import { PrototypeSwitcher } from "./prototype-switcher";
import { VariantADock, variantAInset } from "./variant-a-rail";
import { VariantBDock, variantBInset } from "./variant-b-floating-chip";
import { VariantCDock, variantCInset } from "./variant-c-floating-pill";
import { VariantDDock, variantDInset } from "./variant-d-edge-tab";

const variants: Record<
  VariantKey,
  {
    Dock: (props: DockProps) => ReactNode;
    inset: (
      state: DockState,
      size: number,
      surface: CopilotSurface | null,
      side: TabPlacement["side"],
    ) => { left?: number; right: number; bottom: number };
    defaultSize: number;
    /** B shows the minimized chat's status as text in the navbar button. */
    launcherChip: boolean;
    /** B and D: with the chat open, the navbar button minimizes it instead of closing it. */
    launcherMinimizes: boolean;
  }
> = {
  A: { Dock: VariantADock, inset: variantAInset, defaultSize: 420, launcherChip: false, launcherMinimizes: false },
  B: { Dock: VariantBDock, inset: variantBInset, defaultSize: 0, launcherChip: true, launcherMinimizes: true },
  C: { Dock: VariantCDock, inset: variantCInset, defaultSize: 0, launcherChip: false, launcherMinimizes: false },
  D: { Dock: VariantDDock, inset: variantDInset, defaultSize: 420, launcherChip: false, launcherMinimizes: true },
};

const placementKey = "dxkb-askclark-tab";

function parsePlacement(raw: string | null): TabPlacement {
  const [side, top] = (raw ?? "").split(":");
  const fraction = Number(top);
  return {
    side: side === "left" ? "left" : "right",
    top: Number.isFinite(fraction) && top !== "" ? Math.min(0.94, Math.max(0.08, fraction)) : 0.75,
  };
}

function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/[*_`#>|[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export function AskClarkDockShell({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") return <>{children}</>;
  return <DockShell>{children}</DockShell>;
}

function DockShell({ children }: { children: ReactNode }) {
  const copilot = useOptionalCopilot();
  const variant = useAskClarkVariant();
  const open = Boolean(variant && copilot?.available && copilot.openSurface !== null);

  const placement = parsePlacement(useStorageItem(placementKey));
  const [minimized, setMinimized] = useState(false);
  const [unread, setUnread] = useState(false);

  // The docks sit under the navbar, so the navbar keeps its full width and its AskClark button.
  const [navBottom, setNavBottom] = useState(0);
  useEffect(() => {
    const navbar = document.getElementById("navbar-container");
    if (!navbar) return;
    const measure = () => {
      setNavBottom(Math.max(0, Math.round(navbar.getBoundingClientRect().bottom)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(navbar);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Closing (any way) resets the minimized state, so the next open starts open.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setMinimized(false);
      setUnread(false);
    }
  }

  const sessionId = copilot?.sessionId ?? null;
  const active = copilot?.chat.active;
  const turn = active?.sessionId === sessionId ? active.turn : null;
  const working = isCopilotTurnActive(turn);
  const session = useCopilotSession(sessionId, { enabled: open, streaming: working });
  const lastAnswer = [...(session.data?.messages ?? [])]
    .reverse()
    .find((message) => message.role === "assistant")?.content;
  const summary: DockSummary = {
    working,
    preview: plainText((working ? turn?.answer || turn?.liveLabel : lastAnswer) ?? ""),
  };

  const state: DockState = !open ? "closed" : minimized ? "minimized" : "open";
  if (state === "minimized" && working && !unread) setUnread(true);

  const spec = variant ? variants[variant] : null;
  const size = spec?.defaultSize ?? 0;
  const inset = spec ? spec.inset(state, size, copilot?.openSurface ?? null, placement.side) : { right: 0, bottom: 0 };

  const api: DockApi | null =
    variant && copilot && spec
      ? {
          variant,
          state,
          unread,
          summary,
          minimize: () => {
            setMinimized(true);
          },
          restore: () => {
            setMinimized(false);
            setUnread(false);
          },
          close: () => {
            copilot.close();
          },
          placement,
          setPlacement: (next) => {
            writeStorageItem(placementKey, `${next.side}:${next.top.toFixed(3)}`);
          },
          launcherChip: spec.launcherChip,
          launcherMinimizes: spec.launcherMinimizes,
          onLauncherClick: () => {
            if (state === "closed") copilot.open();
            else if (state === "minimized") {
              setMinimized(false);
              setUnread(false);
            } else if (spec.launcherMinimizes) setMinimized(true);
            else copilot.close();
          },
        }
      : null;

  const dockProps: DockProps | null =
    api && variant
      ? { api, size }
      : null;

  return (
    <DockProvider value={api}>
      <div
        className="askclark-shell"
        style={
          {
            "--ac-left": `${String(inset.left ?? 0)}px`,
            "--ac-right": `${String(inset.right)}px`,
            "--ac-bottom": `${String(inset.bottom)}px`,
            "--ac-top": `${String(navBottom)}px`,
          } as React.CSSProperties
        }
      >
        {children}
        {spec && dockProps && state !== "closed" && <spec.Dock {...dockProps} />}
        {variant && (
          <PrototypeSwitcher
            current={variant}
            side={placement.side === "left" ? "right" : "left"}
          />
        )}
      </div>
    </DockProvider>
  );
}
