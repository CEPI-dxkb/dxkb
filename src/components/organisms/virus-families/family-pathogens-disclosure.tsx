"use client";

import Avatar from "boring-avatars";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { createContext, type ReactNode, useContext, useId } from "react";

import { organismAvatarColors } from "@/components/organisms/genera-grid/avatar-colors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useHoverDisclosure } from "./use-hover-disclosure";

export interface FamilyPathogenLink {
  name: string;
  href: string;
}

const pileSize = 3;

interface DisclosureState {
  open: boolean;
  toggle: () => void;
  panelId: string;
}

const disclosureContext = createContext<DisclosureState | null>(null);

function useDisclosure(): DisclosureState {
  const state = useContext(disclosureContext);
  if (!state) {
    throw new Error(
      "FamilyPathogensToggle and FamilyPathogensDrawer render inside FamilyPathogensDisclosure",
    );
  }
  return state;
}

/**
 * Wraps a family card and owns whether its pathogens panel is open. The card
 * (a Server Component) arrives as `children`, so no taxon logic or card markup
 * ships to the client. While one panel is open the other cards in the
 * `group/grid` ancestor fade back; `data-open` is also what squares the open
 * card's bottom corners (`Card` variant `tile`, `group/disclosure`).
 */
export function FamilyPathogensDisclosure({
  children,
}: {
  children: ReactNode;
}) {
  const { ref, open, toggle, handlers } = useHoverDisclosure();
  const panelId = useId();

  return (
    <disclosureContext.Provider value={{ open, toggle, panelId }}>
      <div
        ref={ref}
        data-open={open}
        className="group/disclosure relative transition-opacity duration-150 data-[open=false]:group-has-data-[open=true]/grid:opacity-50 motion-reduce:transition-none"
        {...handlers}
      >
        {children}
      </div>
    </disclosureContext.Provider>
  );
}

/**
 * The control beside a card's link: a pile of the first pathogens' avatars
 * (+N for the rest), or a chevron when the family has none. Hover and focus
 * open the panel on their own; a click or tap pins it.
 */
export function FamilyPathogensToggle({
  familyName,
  pathogens,
}: {
  familyName: string;
  pathogens: FamilyPathogenLink[];
}) {
  const { open, toggle, panelId } = useDisclosure();
  const shown = pathogens.slice(0, pileSize);
  const rest = pathogens.length - shown.length;
  // The visible "+N" must be part of the name (WCAG 2.5.3 Label in Name), so a
  // voice user can say it; the panel's own label stays the plain sentence.
  const label =
    rest > 0
      ? `Major human pathogens in ${familyName}, +${String(rest)} more`
      : `Major human pathogens in ${familyName}`;

  return (
    <div className="flex shrink-0 items-center pr-1.5">
      <Button
        type="button"
        variant="ghost"
        size="pile"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
      >
        {shown.length > 0 ? (
          <>
            <span className="flex -space-x-1.5">
              {shown.map((pathogen) => (
                <span
                  key={pathogen.href}
                  className="inline-flex rounded-full bg-card ring-2 ring-card group-hover/button:ring-muted group-aria-expanded/button:ring-muted"
                >
                  <Avatar
                    aria-hidden
                    size={20}
                    name={pathogen.name}
                    variant="beam"
                    colors={organismAvatarColors}
                  />
                </span>
              ))}
            </span>
            {rest > 0 && (
              <span className="text-2xs font-semibold text-muted-foreground">
                +{rest}
              </span>
            )}
          </>
        ) : (
          <ChevronDown
            aria-hidden
            className={cn(
              "text-muted-foreground transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        )}
      </Button>
    </div>
  );
}

/** The panel that unfolds from the card's bottom edge while it is open. */
export function FamilyPathogensDrawer({
  familyName,
  pathogens,
  note,
}: {
  familyName: string;
  pathogens: FamilyPathogenLink[];
  /** Shown in place of the chips when `pathogens` is empty. */
  note?: string;
}) {
  const { open, panelId } = useDisclosure();
  if (!open) return null;

  return (
    <div
      id={panelId}
      role="group"
      aria-label={`Major human pathogens in ${familyName}`}
      className="absolute inset-x-0 top-full z-30 -mt-px flex flex-col gap-2 rounded-b-md bg-card p-2.5 text-card-foreground shadow-md ring-1 ring-foreground/25 duration-150 animate-in fade-in-0 slide-in-from-top-1 motion-reduce:animate-none"
    >
      <p className="text-2xs font-bold tracking-wider text-muted-foreground uppercase">
        Major human pathogens
      </p>
      {pathogens.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {pathogens.map((pathogen) => (
            <li key={pathogen.href} className="max-w-full">
              <Badge
                variant="outline"
                size="chip"
                render={<Link href={pathogen.href} title={pathogen.name} />}
              >
                <span className="inline-flex shrink-0">
                  <Avatar
                    aria-hidden
                    size={16}
                    name={pathogen.name}
                    variant="beam"
                    colors={organismAvatarColors}
                  />
                </span>
                <span className="truncate">{pathogen.name}</span>
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{note}</p>
      )}
    </div>
  );
}
