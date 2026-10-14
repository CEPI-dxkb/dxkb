import Link from "next/link";
import { viewIcons } from "@/components/views/view-icons";
import { EntityViewShell } from "@/components/views";
import {
  surveillanceTabs,
  type SurveillanceViewRecord,
} from "@/lib/surveillance-view";
import { displaySummary } from "@/lib/views/summary";
import { SurveillanceOverview } from "./surveillance-overview";

interface SurveillanceMemberProps {
  surveillance: SurveillanceViewRecord;
}

export function SurveillanceMember({
  surveillance,
}: SurveillanceMemberProps) {
  return (
    <EntityViewShell
      viewLabel="Surveillance View"
      title={surveillance.sample_identifier}
      breadcrumbs={
        <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
          <Link
            className="text-muted-foreground hover:text-foreground"
            href="/surveillance"
          >
            Surveillance
          </Link>
          <span className="text-muted-foreground/50">»</span>
          <h1 className="m-0 inline text-sm leading-none font-bold text-secondary">
            {surveillance.sample_identifier}
          </h1>
        </div>
      }
      headerContent={
        surveillance.pathogen_test_type?.join(", ") ||
        "Pathogen surveillance sample"
      }
      metadataSummary={
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm">
          <span>
            <strong>Test type:</strong>{" "}
            {surveillance.pathogen_test_type?.join(", ") || "Not available"}
          </span>
          <span>
            <strong>Result:</strong>{" "}
            {displaySummary(surveillance.pathogen_test_result)}
          </span>
          <span>
            <strong>Collection year:</strong>{" "}
            {displaySummary(surveillance.collection_year)}
          </span>
        </div>
      }
      tabs={surveillanceTabs.map((tab) => ({
        ...tab,
        icon: viewIcons.overview,
      }))}
      activeTab="overview"
      defaultTab="overview"
      layout="scroll"
    >
      <SurveillanceOverview surveillance={surveillance} />
    </EntityViewShell>
  );
}
