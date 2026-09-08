import Link from "next/link";
import type { ReactNode } from "react";
import { FlaskConical, LayoutDashboard } from "lucide-react";
import { EntityViewShell, ResourceChildCollection } from "@/components/views";
import {
  experimentBiosetRql,
  experimentTabs,
  type ExperimentTab,
  type ExperimentViewRecord,
} from "@/lib/experiment-view";
import { ExperimentOverview } from "./experiment-overview";

const icons: Record<ExperimentTab, ReactNode> = {
  overview: <LayoutDashboard />,
  biosets: <FlaskConical />,
};

interface ExperimentMemberProps {
  experiment: ExperimentViewRecord;
  activeTab: ExperimentTab;
}

export function ExperimentMember({
  experiment,
  activeTab,
}: ExperimentMemberProps) {
  const content =
    activeTab === "biosets" ? (
      <ResourceChildCollection
        resource="bioset"
        label="Biosets"
        idField="bioset_id"
        rql={experimentBiosetRql(experiment.exp_id)}
        defaultSort="bioset_id:asc"
      />
    ) : (
      <ExperimentOverview experiment={experiment} />
    );
  return (
    <EntityViewShell
      viewLabel="Experiment View"
      title={
        experiment.exp_title ??
        experiment.exp_name ??
        `Experiment ${experiment.exp_id}`
      }
      breadcrumbs={
        <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
          <Link
            className="text-muted-foreground hover:text-foreground"
            href="/experiment"
          >
            Experiments
          </Link>
          <span className="text-muted-foreground/50">»</span>
          <h1 className="m-0 inline text-sm leading-none font-bold text-secondary">
            {experiment.exp_id}
          </h1>
        </div>
      }
      headerContent={
        experiment.study_title ??
        experiment.study_name ??
        `Experiment ${experiment.exp_id}`
      }
      metadataSummary={
        activeTab === "overview" ? (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-card px-4 py-3 text-sm">
            <span>
              <strong>Type:</strong> {experiment.exp_type ?? "Not available"}
            </span>
            <span>
              <strong>Technique:</strong>{" "}
              {experiment.measurement_technique ?? "Not available"}
            </span>
            <span>
              <strong>Biosets:</strong> {experiment.biosets ?? "Not available"}
            </span>
          </div>
        ) : undefined
      }
      tabs={experimentTabs.map((tab) => ({ ...tab, icon: icons[tab.key] }))}
      activeTab={activeTab}
      defaultTab="overview"
      layout={activeTab === "overview" ? "scroll" : "fill"}
    >
      {content}
    </EntityViewShell>
  );
}
