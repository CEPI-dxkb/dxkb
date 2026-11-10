"use client";

import { CircleHelp, FileUp, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  isUserPlotType,
  keepSequences,
  maxUserFileBytes,
  maxUserTrackRows,
  parseUserTrack,
  userFileAccept,
  type ParsedUserTrack,
  type UserPlotType,
} from "@/lib/circular-viewer/user-track";
import { formatPrefixedErrorMessage } from "@/lib/utils";

const plotItems: Record<UserPlotType, string> = {
  tiles: "Tiles",
  line: "Line plot",
  histogram: "Histogram",
  heatmap: "Heatmap",
};

type UserTrackRead =
  | { ok: true; parsed: ParsedUserTrack; offSequence: number; pastEnd: number }
  | { ok: false; message: string };

// Module-level because a `finally`, or a ternary inside `try`, makes the React
// Compiler skip the component.
async function readUserTrack(
  file: File,
  plot: UserPlotType,
  sequenceLengths: ReadonlyMap<string, number>,
): Promise<UserTrackRead> {
  try {
    const text = await file.text();
    const read = parseUserTrack(text, plot);
    if (read.items.length === 0) {
      return {
        ok: false,
        message:
          plot === "tiles"
            ? "User file format error: no line has an accession, start and end separated by tabs."
            : parseUserTrack(text, "tiles").items.length > 0
              ? "User file format error: no line has an accession, start, end and score separated by tabs. A file of three columns can be shown as Tiles."
              : "User file format error: no line has an accession, start, end and score separated by tabs.",
      };
    }
    const { parsed, offSequence, pastEnd } = keepSequences(read, sequenceLengths);
    if (parsed.items.length === 0) {
      return { ok: false, message: `No line of ${file.name} starts within a drawn sequence of this genome.` };
    }
    if (parsed.items.length > maxUserTrackRows) {
      return {
        ok: false,
        message: `${file.name} has ${parsed.items.length.toLocaleString("en-US")} lines to draw, more than the ${maxUserTrackRows.toLocaleString("en-US")} a track can show. Split the file or keep fewer lines.`,
      };
    }
    return { ok: true, parsed, offSequence, pastEnd };
  } catch (error) {
    return { ok: false, message: formatPrefixedErrorMessage(`Could not read ${file.name}`, error) };
  }
}

function clearFileInput(input: HTMLInputElement | null, file: File): void {
  if (input?.files?.[0] === file) input.value = "";
}

export function UserTrackForm({
  onAdd,
  sequenceLengths,
}: {
  onAdd: (plot: UserPlotType, parsed: ParsedUserTrack, fileName: string, name: string) => void;
  sequenceLengths: ReadonlyMap<string, number> | undefined;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [plot, setPlot] = useState<UserPlotType>("tiles");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [reading, setReading] = useState(false);

  async function add() {
    if (file === null || sequenceLengths === undefined) return;
    if (file.size > maxUserFileBytes) {
      toast.error("User file format error: the file is larger than 20 MB.");
      return;
    }
    // The name can change while the read runs and is then kept; Choose file is disabled meanwhile.
    const submittedFile = file;
    const submittedName = name;
    setReading(true);
    const result = await readUserTrack(submittedFile, plot, sequenceLengths);
    if (result.ok) {
      // No `finally` (it makes the React Compiler skip this component): the
      // catch handles anything `onAdd` or the toasts throw, so
      // `setReading(false)` below still runs.
      try {
        const { parsed, offSequence, pastEnd } = result;
        onAdd(plot, parsed, submittedFile.name, submittedName);
        if (parsed.skipped > 0) {
          toast.warning(`Skipped ${String(parsed.skipped)} line(s) of ${submittedFile.name} that could not be read.`);
        }
        if (offSequence > 0) {
          toast.warning(`Skipped ${String(offSequence)} line(s) of ${submittedFile.name} that are not on a drawn sequence.`);
        }
        if (pastEnd > 0) {
          toast.warning(`Skipped ${String(pastEnd)} line(s) of ${submittedFile.name} that start past the end of their sequence.`);
        }
        setFile((current) => (current === submittedFile ? null : current));
        setName((current) => (current === submittedName ? "" : current));
        clearFileInput(fileInput.current, submittedFile);
      } catch (error) {
        toast.error(formatPrefixedErrorMessage(`Could not read ${submittedFile.name}`, error));
      }
    } else {
      toast.error(result.message);
    }
    setReading(false);
  }

  return (
    <form
      aria-labelledby={`${id}-title`}
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      <div className="space-y-2">
        <div className="flex h-6 items-center gap-1">
          <h2 id={`${id}-title`} className="text-base font-semibold">Upload your own data</h2>
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="icon-xs" aria-label="About uploaded tracks">
                  <CircleHelp className="size-4" />
                </Button>
              }
            />
            <PopoverContent className="w-80">
              <div className="space-y-2 text-xs">
                <p>
                  To show your data as Tiles, upload a text file with accession, start and end
                  positions separated by tabs, for example <code>NC_000962&#9;34&#9;1524</code>.
                </p>
                <p>
                  For a Line plot, Histogram or Heatmap, add a fourth column with a number, for
                  example <code>NC_000962&#9;3596001&#9;3598000&#9;0.6395</code>.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Select
          items={plotItems}
          value={plot}
          onValueChange={(value) => {
            if (isUserPlotType(value)) setPlot(value);
          }}
        >
          <SelectTrigger size="sm" aria-label="Plot type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.entries(plotItems).map(([value, text]) => (
                <SelectItem key={value} value={value}>{text}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {/* The native control's "Choose File" reads as plain text on the card; the
         input stays in the form, hidden, and this button opens it. */}
      <div className="space-y-2">
        <Label id={`${id}-file-label`} htmlFor={`${id}-file-button`}>
          Data file
        </Label>
        <input
          ref={fileInput}
          type="file"
          accept={userFileAccept}
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
          }}
        />
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            id={`${id}-file-button`}
            aria-labelledby={`${id}-file-label ${id}-file-action`}
            aria-describedby={`${id}-file-name`}
            className="shrink-0"
            disabled={reading}
            onClick={() => {
              fileInput.current?.click();
            }}
          >
            <FileUp aria-hidden="true" />
            <span id={`${id}-file-action`}>Choose file</span>
          </Button>
          <span
            id={`${id}-file-name`}
            title={file?.name}
            className={file === null ? "min-w-0 truncate text-sm text-muted-foreground" : "min-w-0 truncate text-sm"}
          >
            {file?.name ?? "No file chosen"}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>Track name (optional)</Label>
        <div className="flex gap-2">
          <Input
            id={`${id}-name`}
            value={name}
            placeholder="Defaults to User track N"
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <Button type="submit" variant="soft" size="icon" aria-label="Add user track" disabled={file === null || sequenceLengths === undefined || reading}>
            {reading ? <Spinner /> : <Plus />}
          </Button>
        </div>
      </div>
    </form>
  );
}
