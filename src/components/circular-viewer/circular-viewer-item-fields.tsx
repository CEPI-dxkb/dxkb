import type { HoverItem } from "@/lib/circular-viewer/drawing";

/** The hovered item's heading: a feature's PATRIC id, else its sequence. */
export function itemTitle(item: HoverItem): string {
  switch (item.kind) {
    case "feature":
      return item.feature.patricId ?? item.feature.featureId;
    case "contig":
      return item.contig.accession;
    case "region":
      return item.region.accession;
    case "score":
      return item.point.accession;
  }
}

function formatBases(value: number): string {
  return `${value.toLocaleString("en-US")} bp`;
}

/**
 * Label/value rows: the short set for the tooltip (legacy's `mini` popup),
 * the full set for the pinned dialog. Empty values are left out.
 */
export function itemFields(item: HoverItem, full: boolean): [string, string][] {
  const rows: [string, string | undefined][] = [];
  if (item.kind === "feature") {
    const { feature } = item;
    rows.push(
      ["Product", feature.product],
      ["Gene", feature.gene],
      ["Type", feature.featureType],
      ["Location", `${feature.accession}:${String(feature.start)}..${String(feature.end)}${feature.strand ? ` (${feature.strand})` : ""}`],
    );
    if (full) {
      rows.push(
        ["Length", feature.naLength === undefined ? undefined : formatBases(feature.naLength)],
        ["Protein length", feature.aaLength === undefined ? undefined : `${String(feature.aaLength)} aa`],
        ["RefSeq locus tag", feature.refseqLocusTag],
        ["Protein ID", feature.proteinId],
        ["Feature ID", feature.featureId],
      );
    }
  } else if (item.kind === "contig") {
    const { contig } = item;
    rows.push(
      ["Length", formatBases(contig.length)],
      ["GC content", contig.gcContent === undefined ? undefined : `${String(contig.gcContent)}%`],
      ["Topology", contig.topology],
      ["Sequence type", contig.sequenceType],
    );
    if (full) rows.push(["Sequence ID", contig.sequenceId]);
  } else if (item.kind === "region") {
    const { region } = item;
    rows.push(
      ["Start", String(region.start)],
      ["End", String(region.end)],
      ["Score", region.score === null ? undefined : String(region.score)],
    );
  } else {
    const { point } = item;
    rows.push(["Start", String(point.start + 1)], ["End", String(point.end)], ["Score", String(point.score)]);
  }
  return rows.flatMap(([label, value]) => (value === undefined || value === "" ? [] : [[label, value]]));
}

/**
 * What a screen reader hears for the keyboard's item: its track, its place
 * on the ring, and the tooltip's text.
 */
export function itemAnnouncement(target: {
  title: string;
  position: number;
  count: number;
  item: HoverItem;
}): string {
  const fields = itemFields(target.item, false).map(
    ([label, value]) => `${label}: ${value}.`,
  );
  return [
    `${target.title}, ${String(target.position + 1)} of ${String(target.count)}: ${itemTitle(target.item)}.`,
    ...fields,
  ].join(" ");
}

export function ItemFieldList({ item, full }: { item: HoverItem; full: boolean }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {itemFields(item, full).map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="wrap-anywhere">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
