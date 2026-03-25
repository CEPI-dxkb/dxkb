"use client";

import { RefreshCw, Search, FolderPlus, Upload, Eye, EyeOff, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const typeFilterOptions = [
  { value: "all", label: "All Types" },
  { value: "folder", label: "Folders" },
  { value: "contigs", label: "Contigs" },
  { value: "reads", label: "Reads" },
  { value: "job_result", label: "Job Results" },
  { value: "genome_group", label: "Genome Groups" },
  { value: "feature_group", label: "Feature Groups" },
  { value: "experiment_group", label: "Experiment Groups" },
  { value: "txt", label: "Text Files" },
  { value: "csv", label: "CSV Files" },
  { value: "json", label: "JSON Files" },
  { value: "pdf", label: "PDF Files" },
  { value: "pdb", label: "PDB Files" },
];

interface WorkspaceToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  typeFilter: string;
  onTypeFilterChange: (type: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  showHiddenFiles: boolean;
  onShowHiddenFilesChange: (show: boolean) => void;
  onNewFolder?: () => void;
  onUpload?: () => void;
  /** When true, show "New Workspace" instead of New Folder/Upload (root directory). Type filter, search, and refresh remain. */
  isAtRoot?: boolean;
  onNewWorkspace?: () => void;
}

export function WorkspaceToolbar({
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  onRefresh,
  isRefreshing,
  showHiddenFiles,
  onShowHiddenFilesChange,
  onNewFolder,
  onUpload,
  isAtRoot = false,
  onNewWorkspace,
}: WorkspaceToolbarProps) {
  const filterSearchSection = (
    <div className="flex min-w-0 items-center gap-2">
      <Select
        items={typeFilterOptions}
        value={typeFilter}
        onValueChange={(value) => {
          if (value != null) onTypeFilterChange(value);
        }}
      >
        <SelectTrigger className="w-36 shrink-0">
          <SelectValue placeholder="All Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {typeFilterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <div className="relative min-w-0 flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
    </div>
  );

  if (isAtRoot) {
    return (
      <div className="grid min-w-0 grid-cols-1 gap-3 @3xl:grid-cols-[1fr_auto] @3xl:items-center">
        {filterSearchSection}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh the workspace"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              data-icon="inline-start"
            />
            Refresh
          </Button>

          <Button
            variant="outline"
            onClick={onNewWorkspace}
            disabled={!onNewWorkspace}
            title="Create a new workspace directory"
          >
            <HardDrive className="h-4 w-4" data-icon="inline-start" />
            New WS
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 @3xl:grid-cols-[1fr_auto] @3xl:items-center">
      {filterSearchSection}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => onShowHiddenFilesChange(!showHiddenFiles)}
          title={showHiddenFiles ? "Hide dotfiles and hidden items" : "Show hidden files (e.g. .folder)"}
          aria-pressed={showHiddenFiles}
        >
          {showHiddenFiles ? (
            <EyeOff className="h-4 w-4" data-icon="inline-start" />
          ) : (
            <Eye className="h-4 w-4" data-icon="inline-start" />
          )}
          {showHiddenFiles ? "Hide hidden" : "Show hidden"}
        </Button>

        <Button
          variant="outline"
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh the workspace"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            data-icon="inline-start"
          />
          Refresh
        </Button>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button
                variant="outline"
                onClick={onNewFolder}
                disabled={!onNewFolder}
                title={onNewFolder ? "Create a new folder" : undefined}
              >
                <FolderPlus className="h-4 w-4" data-icon="inline-start" />
                New Folder
              </Button>
            </TooltipTrigger>
            {!onNewFolder && (
              <TooltipContent>You do not have write access in this directory</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button
                variant="outline"
                onClick={onUpload}
                disabled={!onUpload}
                title={onUpload ? "Upload a file to the workspace" : undefined}
              >
                <Upload className="h-4 w-4" data-icon="inline-start" />
                Upload
              </Button>
            </TooltipTrigger>
            {!onUpload && (
              <TooltipContent>You do not have write access in this directory</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
