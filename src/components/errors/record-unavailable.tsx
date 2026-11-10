import Link from "next/link";

import { EntityViewShell } from "@/components/views/entity-view-shell";
import { viewIcons } from "@/components/views/view-icons";

import { ErrorPanel } from "./error-panel";
import { RefreshRetryButton } from "./retry-button";

interface RecordUnavailableProps {
  viewLabel: string;
  recordLabel: string;
  recordId: string;
  message: string;
  collectionHref: string;
  collectionLabel: string;
}

export function RecordUnavailable({
  viewLabel,
  recordLabel,
  recordId,
  message,
  collectionHref,
  collectionLabel,
}: RecordUnavailableProps) {
  const title = `${recordLabel} ${recordId}`;
  return (
    <EntityViewShell
      viewLabel={viewLabel}
      title={title}
      breadcrumbs={
        <div className="flex flex-wrap items-baseline gap-x-1 text-sm">
          <Link
            className="text-muted-foreground transition-colors hover:text-foreground"
            href={collectionHref}
          >
            {collectionLabel}
          </Link>
          <span className="text-muted-foreground/50 select-none">»</span>
          <h1 className="m-0 inline text-sm leading-none font-bold text-secondary">
            {title}
          </h1>
        </div>
      }
      tabs={[{ key: "overview", label: "Overview", icon: viewIcons.overview }]}
      activeTab="overview"
      defaultTab="overview"
    >
      <ErrorPanel
        headingLevel="h2"
        title={`${title} could not be loaded`}
        message={message}
        retry={<RefreshRetryButton />}
        backHref={collectionHref}
        backLabel={`Browse ${collectionLabel.toLowerCase()}`}
      />
    </EntityViewShell>
  );
}
