"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface SelectedSequenceRow {
  id: string;
  name: string;
  path: string;
  typeLabel: string;
}

interface SelectedSequencesTableProps {
  heading: string;
  rows: SelectedSequenceRow[];
  onRemove: (index: number) => void;
  note?: ReactNode;
}

/**
 * The tree forms' selected inputs: name and path, type, and a remove button per
 * row.
 */
export function SelectedSequencesTable({
  heading,
  rows,
  onRemove,
  note,
}: SelectedSequencesTableProps) {
  const emptyMessage = (
    <span className="text-muted-foreground">No items selected.</span>
  );
  return (
    // The container is this wrapper, not the scrolling box, so a scrollbar
    // appearing inside it does not flip the layout.
    <div className="@container">
      <div className="max-h-84 overflow-y-auto rounded-md border bg-background">
        {/* The path column (`w-full`) takes the rest; its cells' `max-w-0` keep
            a long name from widening the table past the box and hiding Remove.
            Below 32rem the type moves under the path and its column is hidden. */}
        <Table>
          <TableHeader>
            <TableRow variant="static">
              <TableHead className="w-full">{heading}</TableHead>
              <TableHead className="hidden @lg:table-cell">Type</TableHead>
              <TableHead className="w-20 text-center">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow variant="static">
                {/* A cell spanning a hidden column would add a column of its
                    own, so each layout gets its own span. */}
                <TableCell colSpan={2} className="text-center @lg:hidden">
                  {emptyMessage}
                </TableCell>
                <TableCell
                  colSpan={3}
                  className="hidden text-center @lg:table-cell"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={row.id} variant="static-striped">
                  <TableCell variant="wrap" className="max-w-0">
                    <div>{row.name}</div>
                    <div
                      title={row.path}
                      className="truncate-start text-xs text-muted-foreground"
                    >
                      {row.path}
                    </div>
                    <div className="text-xs text-muted-foreground @lg:hidden">
                      {row.typeLabel}
                    </div>
                  </TableCell>
                  <TableCell className="hidden @lg:table-cell">
                    {row.typeLabel}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      type="button"
                      variant="ghost-secondary"
                      size="icon"
                      aria-label="Remove selected sequence"
                      onClick={() => {
                        onRemove(index);
                      }}
                    >
                      <X size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {note != null && (
          <>
            <Separator />
            <p className="px-3 py-2 text-xs text-muted-foreground">{note}</p>
          </>
        )}
      </div>
    </div>
  );
}
