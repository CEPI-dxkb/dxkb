import Link from "next/link";
import { viewIcons } from "@/components/views/view-icons";
import { EntityViewShell } from "@/components/views";
import { serologyTabs, type SerologyViewRecord } from "@/lib/serology-view";
import { displaySummary } from "@/lib/views/summary";
import { SerologyOverview } from "./serology-overview";

interface SerologyMemberProps {
  serology: SerologyViewRecord;
}

export function SerologyMember({ serology }: SerologyMemberProps) {
  return (
    <EntityViewShell
      viewLabel="Serology View"
      title={serology.sample_identifier}
      breadcrumbs={
        <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
          <Link
            className="text-muted-foreground hover:text-foreground"
            href="/serology"
          >
            Serology
          </Link>
          <span className="text-muted-foreground/50">»</span>
          <h1 className="m-0 inline text-sm leading-none font-bold text-secondary">
            {serology.sample_identifier}
          </h1>
        </div>
      }
      headerContent={serology.test_type || "Serology sample"}
      metadataSummary={
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm">
          <span>
            <strong>Test type:</strong> {displaySummary(serology.test_type)}
          </span>
          <span>
            <strong>Result:</strong> {displaySummary(serology.test_result)}
          </span>
          <span>
            <strong>Interpretation:</strong>{" "}
            {displaySummary(serology.test_interpretation)}
          </span>
        </div>
      }
      tabs={serologyTabs.map((tab) => ({
        ...tab,
        icon: viewIcons.overview,
      }))}
      activeTab="overview"
      defaultTab="overview"
      layout="scroll"
    >
      <SerologyOverview serology={serology} />
    </EntityViewShell>
  );
}
