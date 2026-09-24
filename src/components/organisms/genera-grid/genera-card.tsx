import Avatar from "boring-avatars";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { facetDisplayLabel } from "@/components/organisms/facet-label";
import { Card } from "@/components/ui/card";
import { numberFormatter } from "@/lib/services/organisms/utils";

interface GeneraCardProps {
  name: string;
  href: string;
  count?: number;
  /** Suffix for the link's aria-label, e.g. "genomes" or "overview". */
  viewLabel?: string;
}

export function GeneraCard({ name, href, count, viewLabel = "genomes" }: GeneraCardProps) {
  const displayName = facetDisplayLabel(name);

  return (
    <Card className="gap-0 rounded-md py-0 shadow-none">
      <Link
        href={href}
        aria-label={`View ${displayName} ${viewLabel}`}
        className="flex min-h-12 items-center gap-2.5 px-2.5 py-1.5 transition-colors hover:bg-muted/40"
      >
        <Avatar
          size={28}
          name={displayName}
          variant="beam"
          colors={["#264653", "#2a9d8f", "#e9c46a", "#f4a261", "#e76f51"]}
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3
            className="truncate text-sm leading-tight font-semibold"
            title={displayName}
          >
            {displayName}
          </h3>
          {count !== undefined && (
            <p className="text-2xs leading-tight text-muted-foreground">
              {numberFormatter.format(count)} genomes
            </p>
          )}
        </div>
        <ArrowRight
          size={14}
          className="shrink-0 text-muted-foreground/50"
          aria-hidden="true"
        />
      </Link>
    </Card>
  );
}
