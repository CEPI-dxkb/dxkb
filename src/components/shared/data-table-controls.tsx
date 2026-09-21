import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DataTableInstance, DataTableProps } from "./data-table";
import { useDataTableDownload } from "./use-data-table-download";

interface DataTableControlsProps {
  table: DataTableInstance;
  resource: string;
  selectedIds?: string[];
  isAllPagesSelected: boolean;
  onDownloadAll?: DataTableProps["onDownloadAll"];
  onDownloadSelected?: DataTableProps["onDownloadSelected"];
  showExportControls: boolean;
}

export function DataTableControls({
  table,
  resource,
  selectedIds,
  isAllPagesSelected,
  onDownloadAll,
  onDownloadSelected,
  showExportControls,
}: DataTableControlsProps) {
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [onlyVisibleColumns, setOnlyVisibleColumns] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const { downloadingButton, handleDownload } = useDataTableDownload({
    table,
    resource,
    selectedIds,
    isAllPagesSelected,
    onDownloadAll,
    onDownloadSelected,
    onlyVisibleColumns,
  });
  const canDownloadSelected =
    Boolean(onDownloadSelected) ||
    (isAllPagesSelected && Boolean(onDownloadAll));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        columnMenuRef.current &&
        !columnMenuRef.current.contains(event.target as Node)
      ) {
        setShowColumnMenu(false);
      }
    };

    if (showColumnMenu)
      document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showColumnMenu]);

  return (
    <div className="mb-2 flex w-full justify-end px-5">
      <div className="relative inline-block text-left" ref={columnMenuRef}>
        {" "}
        <Button
          className="border-border bg-background text-foreground hover:bg-muted mr-2 flex w-full justify-end rounded border px-2 py-1 text-xs font-medium"
          onClick={() => {
            setShowColumnMenu((previous) => !previous);
          }}
        >
          Columns ▾
        </Button>
        {showColumnMenu && (
          <div className="ring-opacity-5 bg-background ring-border absolute left-0 z-50 mt-1 w-40 rounded-md shadow-lg ring-1">
            <div className="max-h-64 overflow-auto py-1 text-xs">
              {table.getAllColumns().map((column) =>
                column.id === "__select__" ? null : (
                  <label
                    key={column.id}
                    className="text-foreground hover:bg-muted flex cursor-pointer items-center space-x-2 px-2 py-1"
                  >
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={() => {
                        column.toggleVisibility();
                      }}
                    />
                    <span>{column.columnDef.header as string}</span>
                  </label>
                ),
              )}
            </div>
          </div>
        )}
      </div>

      {showExportControls && (
        <>
          <DownloadButton
            label="Download (CSV)"
            buttonKey="csv-all"
            downloadingButton={downloadingButton}
            onClick={() => handleDownload("csv")}
            className="border-border bg-background text-foreground hover:bg-muted mx-2 rounded border px-2 py-1 text-xs font-medium"
          />
          <DownloadButton
            label="Download (TXT)"
            buttonKey="txt-all"
            downloadingButton={downloadingButton}
            onClick={() => handleDownload("txt")}
          />

          {((selectedIds?.length ?? 0) > 0 || isAllPagesSelected) &&
            canDownloadSelected && (
              <>
                <DownloadButton
                  label="Download Selected (CSV)"
                  buttonKey="csv-selected"
                  downloadingButton={downloadingButton}
                  onClick={() => handleDownload("csv", true)}
                />
                <DownloadButton
                  label="Download Selected (TXT)"
                  buttonKey="txt-selected"
                  downloadingButton={downloadingButton}
                  onClick={() => handleDownload("txt", true)}
                />
              </>
            )}

          <label className="text-foreground ml-4 flex items-center text-xs">
            <input
              type="checkbox"
              checked={onlyVisibleColumns}
              onChange={() => {
                setOnlyVisibleColumns((previous) => !previous);
              }}
              className="mr-1"
            />
            Download Displayed Columns Only
          </label>
        </>
      )}
    </div>
  );
}

function DownloadButton({
  label,
  buttonKey,
  downloadingButton,
  onClick,
  className = "mr-2 rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted",
}: {
  label: string;
  buttonKey: string;
  downloadingButton: string | null;
  onClick: () => Promise<void>;
  className?: string;
}) {
  return (
    <Button
      onClick={() => {
        void onClick();
      }}
      className={className}
      disabled={downloadingButton !== null}
    >
      {downloadingButton === buttonKey ? (
        <span className="text-red-600">Downloading...</span>
      ) : (
        label
      )}
    </Button>
  );
}
