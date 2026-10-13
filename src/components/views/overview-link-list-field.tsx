import { ExternalLink } from "lucide-react";
import { MetadataLink } from "@/components/detail-panel/metadata-link";
import type { OverviewSectionField } from "./overview-section";

export interface OverviewLinkItem {
  href?: string;
  label: string;
}

/**
 * A field holding zero or more links laid out inline. Each destination goes
 * through the shared `MetadataLink` boundary, which decides internal versus
 * external and renders the new-tab icon only for a destination it classified
 * as external — this field carries no `external` flag of its own, so a caller
 * cannot disagree with the classifier about what a URL is.
 */
export function linkListField(
  label: string,
  items: readonly OverviewLinkItem[],
): OverviewSectionField {
  const availableItems = items.filter((item) => item.label !== "");
  return {
    label,
    value: availableItems,
    available: availableItems.length > 0,
    className: "mt-0.5 flex flex-wrap gap-x-2 wrap-break-word",
    children: availableItems.map((item) =>
      item.href ? (
        <MetadataLink
          key={`${item.href}-${item.label}`}
          href={item.href}
          className="inline-flex items-center gap-1"
          externalIndicator={
            <ExternalLink className="size-3" aria-hidden="true" />
          }
        >
          {item.label}
        </MetadataLink>
      ) : (
        <span key={item.label}>{item.label}</span>
      ),
    ),
  };
}
