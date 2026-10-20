"use client";

import { Network } from "lucide-react";
import { useState } from "react";

import { ResourceWorkspace } from "@/components/views/resource-workspace";
import { useRetryKeepingError } from "@/components/views/use-retry-keeping-error";
import { SectionError } from "@/components/organisms/shared/section-error";
import { Skeleton } from "@/components/ui/skeleton";
import type { ArchaeopteryxNode } from "@/lib/phylogeny/archaeopteryx";

import { ArchaeopteryxPhylogeny } from "./archaeopteryx-phylogeny";
import { useBacterialTreeXml } from "./use-phylogeny-data";

export function BacterialPhylogenyPanel({
  taxonId,
  taxonName,
}: {
  taxonId: number;
  taxonName: string;
}) {
  const tree = useBacterialTreeXml(taxonId);
  // A Retry keeps the failure up ("Retrying…") instead of going back to the
  // loading skeleton until it answers.
  const treeRetry = useRetryKeepingError(tree, String(taxonId));
  const [selection, setSelection] = useState<{
    taxonId: number;
    node: ArchaeopteryxNode;
  } | null>(null);
  const selected = selection?.taxonId === taxonId ? selection.node : null;

  if (treeRetry.error) {
    return (
      <div className="p-4">
        <SectionError
          section="Phylogeny"
          error={treeRetry.error}
          onRetry={treeRetry.retry}
          isRetrying={treeRetry.retrying}
        />
      </div>
    );
  }
  if (tree.data === undefined) {
    return <Skeleton className="m-4 h-[calc(100%-2rem)]" />;
  }
  if (tree.data === null) {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-md">
          <Network className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No published tree</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A phylogenetic tree is not currently available for {taxonName}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ResourceWorkspace
      hasSidePanel={!!selected}
      sidePanel={
        <div className="h-full overflow-auto p-5">
          {selected ? (
            <>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Selected leaf
              </p>
              <h2 className="mt-1 text-lg font-semibold wrap-break-word">
                {selected.name ?? "Unnamed leaf"}
              </h2>
              <dl className="mt-5 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Branch length</dt>
                <dd>{selected.branch_length ?? "Not provided"}</dd>
                {selected.confidences?.[0]?.value != null && (
                  <>
                    <dt className="text-muted-foreground">Confidence</dt>
                    <dd>{selected.confidences[0].value}</dd>
                  </>
                )}
                {selected.taxonomies?.[0]?.scientific_name && (
                  <>
                    <dt className="text-muted-foreground">Taxonomy</dt>
                    <dd>{selected.taxonomies[0].scientific_name}</dd>
                  </>
                )}
              </dl>
              {selected.properties && selected.properties.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <h3 className="mb-2 text-sm font-semibold">Properties</h3>
                  {selected.properties.map((property) => (
                    <div
                      key={`${property.ref ?? "property"}:${property.applies_to ?? ""}:${String(property.value)}:${property.unit ?? ""}`}
                      className="mb-2 text-xs"
                    >
                      <div className="font-medium wrap-break-word">
                        {property.ref ?? "Property"}
                      </div>
                      <div className="wrap-break-word text-muted-foreground">
                        {String(property.value ?? "")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
              Select a leaf to inspect its phyloXML attributes.
            </div>
          )}
        </div>
      }
    >
      <ArchaeopteryxPhylogeny
        key={taxonId}
        xml={tree.data}
        title={taxonName}
        selectable
        onSelect={(node) => {
          setSelection(node ? { taxonId, node } : null);
        }}
      />
    </ResourceWorkspace>
  );
}
