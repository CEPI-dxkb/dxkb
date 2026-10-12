import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface SelectedGenomeRow {
  id: string;
  name: string;
}

interface SelectedGenomesTableProps {
  rows: SelectedGenomeRow[];
  onRemove: (id: string) => void;
  /** Tags the first row as the reference genome (Genome Alignment's anchor). */
  markFirstAsReference?: boolean;
}

/**
 * The selected-genomes table BLAST and Genome Alignment share: one row per
 * genome with its name, ID and a remove button, in a white box that scrolls
 * once the list outgrows it.
 */
export function SelectedGenomesTable({
  rows,
  onRemove,
  markFirstAsReference = false,
}: SelectedGenomesTableProps) {
  return (
    <div className="max-h-84 overflow-y-auto rounded-md border bg-background">
      <Table aria-label="Selected genomes">
        <TableHeader>
          <TableRow variant="static">
            <TableHead className="h-8">Genome</TableHead>
            <TableHead className="h-8">Genome ID</TableHead>
            <TableHead className="h-8 w-20 text-center">Remove</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow variant="static">
              <TableCell colSpan={3} className="py-1.5 text-center">
                <span className="text-muted-foreground">
                  No genomes selected
                </span>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={row.id} variant="static-striped">
                <TableCell className="py-1">
                  {markFirstAsReference && index === 0 ? (
                    <span className="flex items-center gap-2">
                      {row.name}
                      <Badge variant="secondary" size="sm">
                        Reference
                      </Badge>
                    </span>
                  ) : (
                    row.name
                  )}
                </TableCell>
                <TableCell variant="code" className="py-1">
                  {row.id}
                </TableCell>
                <TableCell className="py-1 text-center">
                  <Button
                    type="button"
                    variant="ghost-secondary"
                    size="icon-xs"
                    aria-label={`Remove ${row.name}`}
                    onClick={() => {
                      onRemove(row.id);
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
