"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import type { WorkspaceObject } from "@/lib/services/workspace/types";

interface ReadLibraryInputSectionProps {
  pairedRead1: string | null;
  pairedRead2: string | null;
  singleRead: string | null;
  onPairedRead1Change: (path: string) => void;
  onPairedRead2Change: (path: string) => void;
  onSingleReadChange: (path: string) => void;
  onAddPairedLibrary: () => void;
  onAddSingleLibrary: () => void;
}

export function ReadLibraryInputSection({
  pairedRead1,
  pairedRead2,
  singleRead,
  onPairedRead1Change,
  onPairedRead2Change,
  onSingleReadChange,
  onAddPairedLibrary,
  onAddSingleLibrary,
}: ReadLibraryInputSectionProps) {
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <ServiceLabel>Paired Read Library</ServiceLabel>
          <div className="mx-4 h-px flex-1 bg-border" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Add paired read library"
            onClick={onAddPairedLibrary}
            disabled={!pairedRead1 || !pairedRead2}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <div className="space-y-3">
          <WorkspaceObjectSelector
            preset="reads"
            placeholder="Select READ FILE 1..."
            value={pairedRead1 ?? ""}
            onObjectSelect={(object: WorkspaceObject) => {
              onPairedRead1Change(object.path);
            }}
          />
          <WorkspaceObjectSelector
            preset="reads"
            placeholder="Select READ FILE 2..."
            value={pairedRead2 ?? ""}
            onObjectSelect={(object: WorkspaceObject) => {
              onPairedRead2Change(object.path);
            }}
          />
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <ServiceLabel>Single Read Library</ServiceLabel>
          <div className="mx-4 h-px flex-1 bg-border" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Add single read library"
            onClick={onAddSingleLibrary}
            disabled={!singleRead}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
        <WorkspaceObjectSelector
          preset="reads"
          placeholder="Select READ FILE..."
          value={singleRead ?? ""}
          onObjectSelect={(object: WorkspaceObject) => {
            onSingleReadChange(object.path);
          }}
        />
      </div>
    </>
  );
}
