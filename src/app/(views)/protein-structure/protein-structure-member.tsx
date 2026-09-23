"use client";

import { ExternalLink } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { featureHref, genomeHref, taxonomyHref } from "@/lib/views/hrefs";
import { isTaxonId } from "@/lib/taxonomy-view";
import {
  isPdbId,
  resolveProteinStructureSources,
  type StructureSource,
} from "@/lib/protein-structure-view";
import type { ProteinStructureLookup } from "@/lib/protein-structure-view/server";

const StructureSourceViewer = dynamic(
  () =>
    import("@/components/workspace/file-viewer/viewers/structure-source-viewer").then(
      (module) => module.StructureSourceViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center">
        Loading structure viewer...
      </div>
    ),
  },
);

const layout = { showControls: true, regionState: "full" as const };

function values(
  value: string | number | readonly (string | number)[],
): string[] {
  return (Array.isArray(value) ? value : [value]).map(String);
}

type StructureMetadataValue = NonNullable<ProteinStructureLookup["metadata"]>;

function StructureMetadata({ metadata }: { metadata: StructureMetadataValue }) {
  const uniProtAccessions = (
    Array.isArray(metadata.uniprotkb_accession)
      ? metadata.uniprotkb_accession
      : [metadata.uniprotkb_accession]
  ).reduce<string[]>((accessions, value) => {
    for (const item of value?.split(",") ?? []) {
      const accession = item.trim();
      if (accession) accessions.push(accession);
    }
    return accessions;
  }, []);
  const provenance = [
    metadata.file_path ? `BV-BRC file: ${metadata.file_path}` : undefined,
    metadata.release_date ? `Released ${metadata.release_date}` : undefined,
    metadata.date_inserted ? `Added ${metadata.date_inserted}` : undefined,
  ].filter((item): item is string => Boolean(item));

  return (
    <section
      className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-3"
      aria-label="Structure metadata"
    >
      <div>
        <h2 className="text-sm font-semibold">Identity</h2>
        <dl className="mt-2 space-y-1 text-sm">
          <div>
            <dt className="inline text-muted-foreground">PDB ID: </dt>
            <dd className="inline">{metadata.pdb_id}</dd>
          </div>
          {metadata.product && (
            <div>
              <dt className="inline text-muted-foreground">Product: </dt>
              <dd className="inline">{values(metadata.product).join(", ")}</dd>
            </div>
          )}
          {metadata.gene && (
            <div>
              <dt className="inline text-muted-foreground">Gene: </dt>
              <dd className="inline">{values(metadata.gene).join(", ")}</dd>
            </div>
          )}
        </dl>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Organism and records</h2>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {metadata.organism_name && (
            <span>{values(metadata.organism_name).join(", ")}</span>
          )}
          {metadata.taxon_id != null &&
            values(metadata.taxon_id)
              .filter((taxonId) => isTaxonId(taxonId))
              .map((taxonId) => (
                <Link
                  key={taxonId}
                  className="underline underline-offset-4"
                  href={taxonomyHref(taxonId)}
                >
                  Taxon {taxonId}
                </Link>
              ))}
          {metadata.genome_id && (
            <Link
              className="underline underline-offset-4"
              href={genomeHref(metadata.genome_id)}
            >
              Genome {metadata.genome_id}
            </Link>
          )}
          {metadata.patric_id && (
            <Link
              className="underline underline-offset-4"
              href={featureHref(metadata.patric_id)}
            >
              Feature {metadata.patric_id}
            </Link>
          )}
        </div>
      </div>
      <div>
        <h2 className="text-sm font-semibold">Experiment and provenance</h2>
        <dl className="mt-2 space-y-1 text-sm">
          {metadata.method && (
            <div>
              <dt className="inline text-muted-foreground">Method: </dt>
              <dd className="inline">{values(metadata.method).join(", ")}</dd>
            </div>
          )}
          {metadata.resolution != null && (
            <div>
              <dt className="inline text-muted-foreground">Resolution: </dt>
              <dd className="inline">{metadata.resolution} A</dd>
            </div>
          )}
          {provenance.map((item) => (
            <div key={item}>{item}</div>
          ))}
        </dl>
      </div>
      <div className="flex flex-wrap gap-2 md:col-span-3">
        {isPdbId(metadata.pdb_id) && (
          <a
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-2",
            )}
            href={`https://www.rcsb.org/structure/${encodeURIComponent(metadata.pdb_id)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            RCSB PDB <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        )}
        {uniProtAccessions.map((accession) => (
          <a
            key={accession}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-2",
            )}
            href={`https://www.uniprot.org/uniprotkb/${encodeURIComponent(accession)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            UniProt {accession}{" "}
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        ))}
        {metadata.pmid != null &&
          values(metadata.pmid).map((pmid) => (
            <a
              key={pmid}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "gap-2",
              )}
              href={`https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              PubMed {pmid}{" "}
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          ))}
      </div>
    </section>
  );
}

interface ProteinStructureMemberProps {
  lookups?: readonly ProteinStructureLookup[];
  workspacePath?: string;
}

export function ProteinStructureMember({
  lookups,
  workspacePath,
}: ProteinStructureMemberProps) {
  const defaultSelection = lookups?.[0]?.accession ?? workspacePath ?? "";
  const [previousDefaultSelection, setPreviousDefaultSelection] =
    useState(defaultSelection);
  const [selected, setSelected] = useState(defaultSelection);
  const selectionAvailable =
    !lookups || lookups.some((item) => item.accession === selected);

  if (defaultSelection !== previousDefaultSelection) {
    setPreviousDefaultSelection(defaultSelection);
    setSelected(defaultSelection);
  } else if (!selectionAvailable) {
    setSelected(defaultSelection);
  }

  const lookup = lookups?.find((item) => item.accession === selected);
  const sources: StructureSource[] = workspacePath
    ? resolveProteinStructureSources({ workspacePath })
    : resolveProteinStructureSources({ pdb_id: selected, ...lookup?.metadata });
  const primarySource = sources.at(0);
  const metadata = lookup?.metadata;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase">
            Protein Structure View
          </p>
          <h1 className="text-xl font-semibold">
            {workspacePath ? primarySource?.label : selected}
          </h1>
          {lookup?.metadata?.title && (
            <p className="text-sm text-muted-foreground">
              {lookup.metadata.title}
            </p>
          )}
        </div>
        {(lookups?.length ?? 0) > 1 && (
          <div
            className="flex flex-wrap gap-2"
            aria-label="Structure accession selector"
          >
            {lookups?.map((item) => (
              <Button
                key={item.accession}
                size="sm"
                variant={item.accession === selected ? "default" : "outline"}
                onClick={() => {
                  setSelected(item.accession);
                }}
              >
                {item.accession}
              </Button>
            ))}
          </div>
        )}
      </header>
      {lookup?.error && (
        <Alert variant="destructive">
          <AlertTitle>Structure metadata could not be loaded</AlertTitle>
          <AlertDescription>{lookup.error}</AlertDescription>
        </Alert>
      )}
      {!lookup?.error && lookup && !metadata && (
        <Alert>
          <AlertTitle>Metadata not found</AlertTitle>
          <AlertDescription>
            No BV-BRC metadata was found. The public structure source is still
            available.
          </AlertDescription>
        </Alert>
      )}
      {metadata && <StructureMetadata metadata={metadata} />}
      <div className="relative flex min-h-96 flex-1 overflow-hidden rounded-lg border bg-background">
        {primarySource ? (
          <StructureSourceViewer
            key={selected}
            source={primarySource}
            sources={sources}
            layout={layout}
          />
        ) : (
          <Alert variant="destructive" className="m-4 self-start">
            <AlertTitle>Structure viewer unavailable</AlertTitle>
            <AlertDescription>
              No valid structure source could be resolved.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
