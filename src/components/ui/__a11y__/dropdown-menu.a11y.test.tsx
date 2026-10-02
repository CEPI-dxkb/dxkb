import { expect, describe, it, afterEach } from "vitest";
import { cleanup } from "vitest-browser-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  allThemes,
  renderWithTheme,
  runAxeOnContainer,
  formatBlockingViolations,
} from "@/test-helpers/render-with-theme";

describe("DropdownMenu — a11y primitive", () => {
  // Menu popup is portalled to document.body. cleanup() unmounts the root and
  // removes the portal node between renders.
  afterEach(() => cleanup());

  const states: { label: string; ui: React.ReactNode }[] = [
    {
      label: "open with labeled items",
      ui: (
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger render={<Button variant="outline">Actions</Button>} />
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>File actions</DropdownMenuLabel>
              <DropdownMenuItem>Rename</DropdownMenuItem>
              <DropdownMenuItem>Move</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Delete</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
    {
      label: "open with segmented and preview radio groups",
      ui: (
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger render={<Button variant="outline">Theme</Button>} />
          <DropdownMenuContent>
            <DropdownMenuRadioGroup variant="segmented" aria-label="Color mode" defaultValue="light">
              <DropdownMenuRadioItem variant="segment" value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem variant="segment" value="dark">Dark</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup aria-label="Theme" defaultValue="dxkb">
              <DropdownMenuRadioItem variant="preview" value="dxkb">DXKB</DropdownMenuRadioItem>
              <DropdownMenuRadioItem variant="preview" value="bvbrc">BV-BRC</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  for (const state of states) {
    for (const theme of allThemes) {
      it(`${state.label} / ${theme} has no blocking violations`, async () => {
        await renderWithTheme(state.ui, theme);
        const { blocking, warnings } = await runAxeOnContainer(document.body);
        if (warnings.length > 0) {
          console.warn(`[a11y] DropdownMenu/${state.label}/${theme}: ${String(warnings.length)} warn-tier`);
        }
        expect(
          blocking,
          blocking.length === 0 ? undefined : formatBlockingViolations(blocking, `DropdownMenu/${state.label}/${theme}`),
        ).toEqual([]);
      });
    }
  }
});
