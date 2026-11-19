import type { CSSProperties, ReactNode } from "react";
import { Info } from "lucide-react";

import { MetadataLink } from "@/components/detail-panel/metadata-link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isGenomeId } from "@/lib/genome-view/schema";
import { colors } from "@/lib/interactions/graph-theme";
import type { GNode } from "@/lib/interactions/types";
import { featureHref, genomeHref } from "@/lib/views/hrefs";

// Pieces the selection panels (a protein, an interaction, a bulk selection) share.

/** A host protein is not a BV-BRC feature, so it never links out. */
export function featureLinkHref(node: GNode | undefined): string | null {
  if (!node?.featureId || node.kind === "host") return null;
  return featureHref(node.featureId);
}

export function genomeLinkHref(node: GNode | undefined): string | null {
  if (!node?.genomeId || node.kind === "host" || !isGenomeId(node.genomeId)) {
    return null;
  }
  return genomeHref(node.genomeId);
}

export function MaybeLink({
  href,
  children,
}: {
  href: string | null;
  children: ReactNode;
}) {
  return href ? <MetadataLink href={href}>{children}</MetadataLink> : children;
}

/** Indigo for a verified interaction, grey for a predicted one: the legend's two lines. */
export function EvidenceSwatch({ verified }: { verified: boolean }) {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-3 shrink-0 rounded-full bg-(--swatch)"
      style={
        {
          "--swatch": verified ? colors.edgeExperimental : colors.dim,
        } as CSSProperties
      }
    />
  );
}

/** "Focus on this protein" with a popover that says what it does and how to undo it. */
export function FocusAction({
  node,
  onFocusNode,
}: {
  node: GNode;
  onFocusNode: (node: GNode) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="soft"
        size="sm"
        onClick={() => {
          onFocusNode(node);
        }}
      >
        Focus on this protein
      </Button>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost-accent"
              size="icon-sm"
              aria-label="About focusing"
            />
          }
        >
          <Info />
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start">
          <PopoverHeader>
            <PopoverTitle>Focusing on a protein</PopoverTitle>
            <PopoverDescription>
              Shows only this protein&apos;s interactions; remove the Protein
              filter in the Filters menu to undo.
            </PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    </div>
  );
}
