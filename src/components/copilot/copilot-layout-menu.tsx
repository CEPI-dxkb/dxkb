"use client";

import { AppWindow, Maximize2, PanelRight } from "lucide-react";
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
import type { CopilotSurface } from "@/lib/ui-preferences/definitions";
import { useCopilot } from "./copilot-provider";

/** Where the chat is shown: the side panel, the floating window, or the full page. The button shows the current surface. */
export function CopilotLayoutMenu({ surface }: { surface: CopilotSurface }) {
  const copilot = useCopilot();
  const floating = surface === "floating";
  const Icon = floating ? AppWindow : PanelRight;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Change ${copilotName} layout`}
            title="Layout"
          >
            <Icon aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Show {copilotName} as</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!floating}
            onClick={() => {
              copilot.open("sheet");
            }}
          >
            <PanelRight aria-hidden />
            Side panel
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={floating}
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
