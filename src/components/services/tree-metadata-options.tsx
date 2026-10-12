"use client";

import { ArrowRight, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ServiceCollapsible,
  ServiceCollapsibleContent,
  ServiceCollapsibleTrigger,
} from "@/components/services/form-ui/service-collapsible";
import { ServiceAddButton } from "@/components/services/form-ui/service-add-button";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import {
  metadataFieldOptions,
  type MetadataField,
  type MetadataFieldSection,
} from "@/lib/forms/genome-metadata-fields";

interface TreeMetadataOptionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The fields that can still be added, by section. */
  sections: MetadataFieldSection[];
  /** The field picked in the select, or "" for none. */
  selectedField: string;
  onSelectField: (fieldId: string) => void;
  onAdd: () => void;
  /** The table's fields. */
  fields: MetadataField[];
  onRemove: (fieldId: string) => void;
}

/**
 * The phylogenetic tree forms' "Metadata Options" (Gene / Protein Tree, Viral
 * Genome Tree): pick genome metadata fields for the tree's metadata table.
 */
export function TreeMetadataOptions({
  open,
  onOpenChange,
  sections,
  selectedField,
  onSelectField,
  onAdd,
  fields,
  onRemove,
}: TreeMetadataOptionsProps) {
  return (
    <ServiceCollapsible
      open={open}
      onOpenChange={onOpenChange}
      className="md:col-span-2"
    >
      <ServiceCollapsibleTrigger>
        Metadata Options
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180 transform" : ""}`}
        />
      </ServiceCollapsibleTrigger>
      <ServiceCollapsibleContent>
        <div className="service-card-content-grid">
          <div className="space-y-4">
            <div>
              <ServiceLabel>Metadata Table Fields</ServiceLabel>
              <p className="pb-4 text-sm text-muted-foreground">
                These fields will appear as options in the phyloxml
                visualization
              </p>
              <div className="flex gap-2">
                {/* `items` gives the trigger the picked field's label, not
                  its id. */}
                <Select
                  items={metadataFieldOptions}
                  value={selectedField}
                  onValueChange={(value) => {
                    if (value != null) onSelectField(value);
                  }}
                >
                  <ServiceSelectTrigger aria-label="Metadata table field">
                    <SelectValue placeholder="Select field" />
                  </ServiceSelectTrigger>
                  <SelectContent className="max-h-150">
                    {sections.map((section) => (
                      <SelectGroup key={section.label}>
                        <SelectLabel variant="section" className="mb-1">
                          {section.label}
                        </SelectLabel>
                        {section.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <ServiceAddButton
                  icon={ArrowRight}
                  aria-label="Add metadata field"
                  onClick={onAdd}
                  disabled={!selectedField}
                />
              </div>
            </div>
          </div>
          <div className="rounded-md border bg-background">
            <Table>
              <TableHeader>
                <TableRow variant="static">
                  <TableHead className="h-8 py-1">Field</TableHead>
                  <TableHead className="h-8 w-24 py-1 text-center">
                    Remove
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id} variant="static" className="h-8">
                    <TableCell className="py-1">{field.name}</TableCell>
                    <TableCell className="py-1 text-center">
                      <Button
                        variant="ghost-secondary"
                        size="icon"
                        aria-label="Remove metadata field"
                        onClick={() => {
                          onRemove(field.id);
                        }}
                        className="size-6"
                      >
                        <X size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </ServiceCollapsibleContent>
    </ServiceCollapsible>
  );
}
