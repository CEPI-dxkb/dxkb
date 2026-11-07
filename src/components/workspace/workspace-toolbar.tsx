"use client";

import type { ReactNode } from "react";
import {
  Ellipsis,
  Eye,
  EyeOff,
  FolderPlus,
  HardDrive,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
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

const noWriteAccess = "You do not have write access in this directory";

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

/**
 * A toolbar button. Its label shows from the toolbar container's @3xl width
 * and folds into the accessible name below it (`foldable` size), leaving the
 * icon and the `title`.
 */
function ToolbarButton({
  icon,
  label,
  title,
  onClick,
  disabled,
  pressed,
  unavailableReason,
}: {
  icon: ReactNode;
  label: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  /** Shown in a tooltip on the disabled button, which takes no hover itself. */
  unavailableReason?: string;
}) {
  const button = (
    <Button
      variant="outline"
      size="foldable"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={pressed}
    >
      {icon}
      <span data-label>{label}</span>
    </Button>
  );
  if (!unavailableReason) return button;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex" />}>
          {button}
        </TooltipTrigger>
        <TooltipContent>{`${label}: ${unavailableReason}`}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * The filter, search and actions share one row at every width, so opening the
 * details panel (which narrows this pane) never changes the toolbar's height
 * and never moves the table rows under the pointer. Narrower than @3xl the
 * action labels fold away; narrower than @md the actions move into a menu.
 */
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
  const refreshIcon = (
    <RefreshCw
      className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
      data-icon="inline-start"
    />
  );
  const refreshButton = (
    <ToolbarButton
      icon={refreshIcon}
      label="Refresh"
      title="Refresh the workspace"
      onClick={onRefresh}
      disabled={isRefreshing}
    />
  );
  const refreshItem = (
    <DropdownMenuItem onClick={onRefresh} disabled={isRefreshing}>
      {refreshIcon}
      Refresh
    </DropdownMenuItem>
  );

  const actions = isAtRoot ? (
    <>
      {refreshButton}
      <ToolbarButton
        icon={<HardDrive className="size-4" data-icon="inline-start" />}
        label="New WS"
        title="Create a new workspace directory"
        onClick={onNewWorkspace}
        disabled={!onNewWorkspace}
      />
    </>
  ) : (
    <>
      <ToolbarButton
        icon={
          showHiddenFiles ? (
            <EyeOff className="size-4" data-icon="inline-start" />
          ) : (
            <Eye className="size-4" data-icon="inline-start" />
          )
        }
        label={showHiddenFiles ? "Hide hidden" : "Show hidden"}
        title={
          showHiddenFiles
            ? "Hide dotfiles and hidden items"
            : "Show hidden files (e.g. .folder)"
        }
        onClick={() => {
          onShowHiddenFilesChange(!showHiddenFiles);
        }}
        pressed={showHiddenFiles}
      />
      {refreshButton}
      <ToolbarButton
        icon={<FolderPlus className="size-4" data-icon="inline-start" />}
        label="New Folder"
        title={onNewFolder ? "Create a new folder" : undefined}
        onClick={onNewFolder}
        disabled={!onNewFolder}
        unavailableReason={onNewFolder ? undefined : noWriteAccess}
      />
      <ToolbarButton
        icon={<Upload className="size-4" data-icon="inline-start" />}
        label="Upload"
        title={onUpload ? "Upload a file to the workspace" : undefined}
        onClick={onUpload}
        disabled={!onUpload}
        unavailableReason={onUpload ? undefined : noWriteAccess}
      />
    </>
  );

  const menuItems = isAtRoot ? (
    <>
      {refreshItem}
      <DropdownMenuItem onClick={onNewWorkspace} disabled={!onNewWorkspace}>
        <HardDrive />
        New WS
      </DropdownMenuItem>
    </>
  ) : (
    <>
      <DropdownMenuCheckboxItem
        checked={showHiddenFiles}
        onCheckedChange={onShowHiddenFilesChange}
      >
        <Eye />
        Show hidden
      </DropdownMenuCheckboxItem>
      {refreshItem}
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        {(!onNewFolder || !onUpload) && (
          <DropdownMenuLabel>{noWriteAccess}</DropdownMenuLabel>
        )}
        <DropdownMenuItem onClick={onNewFolder} disabled={!onNewFolder}>
          <FolderPlus />
          New Folder
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onUpload} disabled={!onUpload}>
          <Upload />
          Upload
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </>
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select
        items={typeFilterOptions}
        value={typeFilter}
        onValueChange={(value) => {
          if (value != null) onTypeFilterChange(value);
        }}
      >
        <SelectTrigger aria-label="Filter by type" className="w-36 min-w-0">
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

      <InputGroup className="min-w-20 flex-1">
        <InputGroupAddon align="inline-start">
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
          }}
        />
      </InputGroup>

      <div className="hidden shrink-0 items-center gap-2 @md:flex">
        {actions}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="Workspace actions"
              title="Workspace actions"
              className="@md:hidden"
            >
              <Ellipsis aria-hidden />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-auto">
          {menuItems}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
