import Link from "next/link";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { viewIcons } from "@/components/views/view-icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCount,
  previewRowCount,
  type ResultRow,
  type TypeResults,
} from "@/lib/search/all-types-search";
import { cn } from "@/lib/utils";

/** Each data type's view icon, as every view rail shows it. */
const typeIcons: Readonly<Record<string, ReactNode>> = {
  taxonomy: viewIcons.taxonomy,
  genome: viewIcons.genomes,
  strain: viewIcons.strains,
  genome_feature: viewIcons.features,
  protein_feature: viewIcons.domainsAndMotifs,
  epitope: viewIcons.epitopes,
  protein_structure: viewIcons.proteinStructures,
  surveillance: viewIcons.surveillance,
  serology: viewIcons.serology,
  experiment: viewIcons.experiments,
};

export function searchTypeIcon(id: string): ReactNode {
  return typeIcons[id] ?? viewIcons.features;
}

/**
 * ↑/↓ move between the result links inside the handler's element, past the
 * rows "Show more" has yet to show. From anything else focused there (a fold
 * button, a type's heading link), they go to the nearest result link in that
 * direction.
 */
export function moveResultFocus(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const from = document.activeElement;
  if (!from) return;
  const links = [
    ...event.currentTarget.querySelectorAll<HTMLElement>("[data-result-link]"),
  ].filter((link) => !link.closest("[inert]"));
  const next =
    event.key === "ArrowDown"
      ? links.find(
          (link) =>
            from.compareDocumentPosition(link) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        )
      : links.findLast(
          (link) =>
            from.compareDocumentPosition(link) &
            Node.DOCUMENT_POSITION_PRECEDING,
        );
  if (!next) return;
  event.preventDefault();
  next.focus();
}

function ResultTitle({ row }: { row: ResultRow }) {
  const className = cn(
    "block truncate font-medium",
    row.monoTitle && "font-mono text-xs",
  );
  return row.href ? (
    <Link
      href={row.href}
      data-result-link
      className={cn(
        className,
        "text-link hover:underline focus-visible:underline focus-visible:outline-none",
      )}
    >
      {row.title}
    </Link>
  ) : (
    <span className={className}>{row.title}</span>
  );
}

/**
 * One type's matches: a one-line header that folds the card, and a table of
 * its top rows with the type's own columns, expandable from five rows to ten.
 * The rows past five are laid out but collapsed (`visibility: collapse`): they
 * take no height but still size the columns, so showing them moves none.
 */
export function TypeResultsCard({
  type,
  open,
  onOpenChange,
}: {
  type: TypeResults;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const extra = type.rows.length - previewRowCount;
  const labels = [
    ...new Set(type.rows.flatMap((row) => row.facts.map((fact) => fact.label))),
  ];

  return (
    <Card variant="raised" className="gap-0 py-0">
      <div
        className={cn("flex items-center gap-2 px-4 py-1", open && "border-b")}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${type.label}`}
          onClick={() => {
            onOpenChange(!open);
          }}
          className="-ml-1.5"
        >
          {open ? <ChevronDown /> : <ChevronRight />}
        </Button>
        <span
          aria-hidden
          className="flex shrink-0 items-center text-muted-foreground [&_svg]:size-4"
        >
          {searchTypeIcon(type.id)}
        </span>
        {/* The type's own list, searched for the same keyword. */}
        <h2 className="text-sm font-semibold">
          <Link
            href={type.listHref}
            className="text-link hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {type.label}
          </Link>
        </h2>
        <span className="text-xs text-foreground/80 tabular-nums">
          ({formatCount(type.count)})
        </span>
      </div>
      {open ? (
        <>
          <Table size="xs">
            <TableHeader variant="muted">
              <TableRow variant="muted-header">
                <TableHead size="xs" className="h-8 w-[32%] px-4">
                  Name
                </TableHead>
                <TableHead size="xs" className="h-8 w-[28%]">
                  {type.contextLabel}
                </TableHead>
                {labels.map((label) => (
                  <TableHead key={label} size="xs" className="h-8">
                    {label}
                  </TableHead>
                ))}
                <TableHead size="xs" className="h-8 px-4">
                  ID
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {type.rows.map((row, index) => {
                const hidden = !expanded && index >= previewRowCount;
                return (
                  <TableRow
                    key={row.key}
                    variant={
                      !expanded && index === previewRowCount - 1
                        ? "last-shown"
                        : "default"
                    }
                    inert={hidden}
                    className={cn(hidden && "collapse")}
                  >
                    <TableCell className="max-w-0 px-4">
                      <ResultTitle row={row} />
                    </TableCell>
                    <TableCell className="max-w-0">
                      <span
                        title={row.context}
                        className="block truncate text-muted-foreground"
                      >
                        {row.context || "-"}
                      </span>
                    </TableCell>
                    {labels.map((label) => (
                      <TableCell key={label}>
                        <span className="text-muted-foreground">
                          {row.facts.find((fact) => fact.label === label)
                            ?.value ?? "-"}
                        </span>
                      </TableCell>
                    ))}
                    <TableCell variant="code" className="px-4">
                      <span className="text-muted-foreground">{row.id}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {extra > 0 ? (
            <div className="border-t px-2 py-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  setExpanded(!expanded);
                }}
              >
                {expanded ? <ChevronUp /> : <ChevronDown />}
                {expanded
                  ? "Show fewer"
                  : `Show ${String(extra)} more ${type.label.toLowerCase()}`}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
