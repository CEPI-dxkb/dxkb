"use client";

import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import {
  ServiceLibraryAddButton,
  ServiceLibraryHeader,
} from "@/components/services/form-ui/service-library-header";
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
        <ServiceLibraryHeader title="Paired Read Library">
          <ServiceLibraryAddButton
            aria-label="Add paired read library"
            onClick={onAddPairedLibrary}
            disabled={!pairedRead1 || !pairedRead2}
          />
        </ServiceLibraryHeader>
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
        <ServiceLibraryHeader title="Single Read Library">
          <ServiceLibraryAddButton
            aria-label="Add single read library"
            onClick={onAddSingleLibrary}
            disabled={!singleRead}
          />
        </ServiceLibraryHeader>
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
