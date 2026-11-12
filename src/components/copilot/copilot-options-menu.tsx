"use client";

import { AppWindow, Maximize2, PanelRight, Settings2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copilotName } from "@/lib/copilot/name";
import { copilotPagePath } from "@/lib/copilot/paths";
import type { CopilotPanelVariant } from "./copilot-panel-header";
import { useCopilot } from "./copilot-provider";

/**
 * The gear menu: where AskClark is shown. The model picker lives in the composer. A surface that
 * cannot be switched (the full page, the docked prototype surfaces) has no gear.
 */
export function ChatOptionsMenu({ variant }: { variant: CopilotPanelVariant }) {
  const copilot = useCopilot();
  if (variant === "page" || variant === "dock") return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${copilotName} options`}
            title="Options"
          >
            <Settings2 aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Show {copilotName} as</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={variant === "sheet"}
            onClick={() => {
              copilot.open("sheet");
            }}
          >
            <PanelRight aria-hidden />
            Side panel
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={variant === "floating"}
            onClick={() => {
              copilot.open("floating");
            }}
          >
            <AppWindow aria-hidden />
            Floating window
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href={copilotPagePath} />}>
            <Maximize2 aria-hidden />
            Full page
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
