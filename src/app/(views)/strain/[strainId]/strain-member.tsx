import Link from "next/link";
import { Dna, LayoutDashboard } from "lucide-react";
import { EntityViewShell } from "@/components/views";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  genomeIdsFromStrains,
  strainTabs,
  type StrainViewRecord,
} from "@/lib/strain-view";
import { cn } from "@/lib/utils";
import { genomesHrefFromIds } from "@/lib/views/hrefs";
import { displaySummary } from "@/lib/views/summary";
import { StrainOverview } from "./strain-overview";

interface StrainMemberProps {
  strain: StrainViewRecord;
}

export function StrainMember({ strain }: StrainMemberProps) {
  const name = strain.strain ?? `Strain ${strain.id}`;
  // `null` past the Data API's `in(...)` ceiling as well as for no genomes, so
  // the button never links to a list the destination would reject.
  const genomesHref = genomesHrefFromIds(genomeIdsFromStrains([strain]));
  return (
    <EntityViewShell
      viewLabel="Strain View"
      title={name}
      breadcrumbs={
        <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
          <Link
            className="text-muted-foreground hover:text-foreground"
            href="/strain"
          >
            Strains
          </Link>
          <span className="text-muted-foreground/50">»</span>
          <h1 className="m-0 inline text-sm leading-none font-bold text-secondary">
            {name}
          </h1>
        </div>
      }
      headerContent={strain.species ?? "Strain record"}
      metadataSummary={
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm">
          <span>
            <strong>Subtype:</strong> {displaySummary(strain.subtype)}
          </span>
          <span>
            <strong>Segments:</strong> {displaySummary(strain.segment_count)}
          </span>
          <span>
            <strong>Status:</strong> {displaySummary(strain.status)}
          </span>
        </div>
      }
      metadataActions={
        genomesHref ? (
          <Link
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-2",
            )}
            href={genomesHref}
          >
            <Dna className="size-4" aria-hidden="true" /> View genomes
          </Link>
        ) : undefined
      }
      tabs={strainTabs.map((tab) => ({ ...tab, icon: <LayoutDashboard /> }))}
      activeTab="overview"
      defaultTab="overview"
      layout="scroll"
    >
      <StrainOverview strain={strain} />
    </EntityViewShell>
  );
}
