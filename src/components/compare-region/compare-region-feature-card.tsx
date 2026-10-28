"use client";

/**
 * The feature card: a click on a gene pins its hover tooltip where it stands
 * (just below and right of the gene) and expands it with the gene's record,
 * the details BV-BRC's Compare Region Viewer shows in its Feature Summary.
 * The record is the detail panel's `genome_feature` sections (Genome,
 * Source, Identifiers, Location, …), read through `/api/data`, with the
 * gene's FASTA downloads and page. Collapse leaves the tooltip's lines;
 * Close (or Escape) clears the pin, and with it the card. The chart moves it
 * with the gene (`placeFeaturePopupElement`).
 */
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronDown, ChevronUp, X } from "lucide-react";
import Link from "next/link";
import { useId, type ReactNode, type Ref } from "react";
import { InfoPanel } from "@/components/detail-panel/info-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FastaDownloadButtons } from "@/components/views/fasta-download-buttons";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { isCompareRegionLinkable } from "@/lib/compare-region/contract";
import {
  resolveFeature,
  type ChartModel,
  type FeatureRef,
  type ResolvedFeature,
} from "@/lib/compare-region/families";
import { featureStandIn } from "@/lib/compare-region/feature-card";
import { DataRepository } from "@/lib/data-api/client";
import { memberQueryOptions } from "@/lib/data-api/query-options";
import {
  featureDisplayName,
  featureFastaTypes,
} from "@/lib/feature-view/display";
import { featureViewRecordSchema } from "@/lib/feature-view/schema";
import { cn, formatUserFacingErrorMessage } from "@/lib/utils";
import { featureHref } from "@/lib/views/hrefs";
import { FeatureLines, featureTooltipSurface } from "./compare-region-tooltip";

const repository = new DataRepository();

const linkClass =
  "inline-flex items-center gap-1 font-medium text-link hover:underline dark:hover:text-foreground";

interface FeatureDetailsProps {
  chosen: ResolvedFeature;
  id: string;
}

/**
 * The gene's record (or the comparison's stand-in), with its state, FASTA
 * downloads and page (the strip carries "Compare regions"). Mounted only
 * while expanded.
 */
function FeatureDetails({ chosen, id }: FeatureDetailsProps) {
  const { feature, row } = chosen;
  const linkable = isCompareRegionLinkable(feature.fid);
  const query = useQuery({
    ...memberQueryOptions(repository, "genome_feature", {
      id: feature.fid,
      idField: "patric_id",
    }),
    enabled: linkable,
    // A record changes rarely: collapsing and expanding again, or pinning the
    // gene again, shows it without another read.
    staleTime: 5 * 60_000,
  });
  const retry = useRetryKeepingError(query, feature.fid);
  const found = query.data?.row ?? null;
  const parsed = found ? featureViewRecordSchema.safeParse(found) : null;
  const record = parsed?.success ? parsed.data : null;
  const fastaTypes = record ? featureFastaTypes(record) : [];

  let notice: ReactNode = null;
  if (retry.error) {
    notice = (
      <Alert variant="destructive">
        <AlertTitle>Could not load the feature record</AlertTitle>
        <AlertDescription>
          <p>
            {formatUserFacingErrorMessage(
              retry.error,
              "The Data API did not answer.",
            )}
          </p>
          <p>These details come from the comparison.</p>
          <QueryRetryButton retrying={retry.retrying} onRetry={retry.retry} />
        </AlertDescription>
      </Alert>
    );
  } else if (!linkable) {
    notice = (
      <p className="text-muted-foreground">
        This feature has no BV-BRC feature record. These details come from the
        comparison.
      </p>
    );
  } else if (query.isPending) {
    notice = (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Spinner />
        Loading the feature record…
      </p>
    );
  } else if (!found) {
    notice = (
      <p className="text-muted-foreground">
        {`No BV-BRC feature record matches ${feature.fid}. These details come from the comparison.`}
      </p>
    );
  }

  return (
    <div id={id} className="mt-3 flex min-h-0 flex-1 flex-col gap-2">
      {notice}
      {/* Scrolls within the card's height (`--popup-max-h`, the room on its side). */}
      <div
        data-popup-scroller=""
        className="scrollbar-themed -mx-3 min-h-0 flex-1 overflow-y-auto border-y"
      >
        <InfoPanel
          variant="search"
          activeTab="genome_feature"
          selectedIds={[feature.fid]}
          selectedRow={found ?? featureStandIn(feature, row)}
          // The card's first line already names the gene.
          hideHeader
          // The comparison's few fields leave most sections empty: that says
          // nothing about the record, so those sections are left out.
          hideEmptySections={!found}
        />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1">
        {record && fastaTypes.length > 0 && (
          <FastaDownloadButtons
            resource="genome_feature"
            ids={[record.feature_id]}
            types={fastaTypes}
            fileNameBase={featureDisplayName(record)}
          />
        )}
        {linkable && (
          <Link
            className={cn("ml-auto", linkClass)}
            href={featureHref(feature.fid)}
          >
            Open feature
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

function CardButton({
  label,
  onClick,
  expanded,
  controls,
  children,
}: {
  label: string;
  onClick: () => void;
  expanded?: boolean;
  controls?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            aria-expanded={expanded}
            aria-controls={controls}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

interface FeatureCardProps {
  model: ChartModel;
  /** The pinned gene. */
  at: FeatureRef;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onClose: () => void;
  /** The chart's, to place the card: it starts hidden (`data-offscreen`) until placed. */
  ref: Ref<HTMLDivElement>;
}

/** The pinned gene's card, absolutely placed in the chart's root. */
export function FeatureCard({
  model,
  at,
  expanded,
  onExpandedChange,
  onClose,
  ref,
}: FeatureCardProps) {
  const detailsId = useId();
  const chosen = resolveFeature(model.layout, at);
  if (!chosen) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Feature details"
      data-offscreen=""
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className={cn(
        "absolute top-0 left-0 z-10 flex max-h-(--popup-max-h) max-w-(--popup-max-w) translate-x-(--popup-x) translate-y-(--popup-y) flex-col data-offscreen:invisible",
        featureTooltipSurface,
        expanded ? "w-96" : "w-80",
      )}
    >
      <FeatureLines
        model={model}
        at={at}
        actions={
          <span className="-my-1 -mr-1 ml-auto flex shrink-0 items-center">
            <CardButton
              label={expanded ? "Collapse details" : "Expand details"}
              expanded={expanded}
              controls={expanded ? detailsId : undefined}
              onClick={() => {
                onExpandedChange(!expanded);
              }}
            >
              {expanded ? <ChevronUp /> : <ChevronDown />}
            </CardButton>
            <CardButton label="Close details" onClick={onClose}>
              <X />
            </CardButton>
          </span>
        }
      />
      {expanded && <FeatureDetails chosen={chosen} id={detailsId} />}
    </div>
  );
}
