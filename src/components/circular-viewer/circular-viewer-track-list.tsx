"use client";

import { Eye, EyeOff, X } from "lucide-react";
import { useId, type Dispatch } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { QueryRetryButton } from "@/components/views/query-retry-button";
import { maxTrackFeatures } from "@/lib/circular-viewer/contract";
import type { TrackData } from "@/lib/circular-viewer/drawing";
import type { TrackAction } from "@/lib/circular-viewer/track-state";
import { canSetForeground, trackDescription, type CircularTrack } from "@/lib/circular-viewer/tracks";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import { TrackColorPicker } from "./track-color-picker";

/**
 * A failed track's query, as the data hook hands it over. TanStack resets a
 * query with no data to `pending` when it refetches, so the hook keeps the
 * last error here while the retry runs (as `useRetryKeepingError` does for
 * one query) and only the retry's own answer replaces it.
 */
export interface TrackError {
  /** The query's error, or the last one, kept while its retry is in flight. */
  error: Error;
  /** That query's TanStack `isFetching`: the Retry reads "Retrying…" meanwhile. */
  isFetching: boolean;
  retry: () => void;
}

/** A track's answer beside its title: loading, nothing found, or cut at the feature limit. */
function TrackStatus({ state }: { state: TrackData | undefined }) {
  if (state === undefined || state.status === "pending") {
    return (
      <span className="shrink-0 text-muted-foreground">
        <Spinner className="size-3.5" />
      </span>
    );
  }
  if (state.status === "error") return null;
  const { items } = state;
  if (items.kind === "features" && items.features.length === 0) {
    return <span className="shrink-0 text-2xs text-muted-foreground">None found</span>;
  }
  if (items.kind === "features" && items.truncated) {
    return (
      <span className="shrink-0 text-2xs text-warning">
        First {maxTrackFeatures.toLocaleString("en-US")}
      </span>
    );
  }
  return null;
}

export interface CircularViewerTrackListProps {
  tracks: readonly CircularTrack[];
  data: ReadonlyMap<string, TrackData>;
  gcWindowSize: number | undefined;
  dispatch: Dispatch<TrackAction>;
  /** Every failed track, by id, including one whose retry is in flight. */
  errors: ReadonlyMap<string, TrackError>;
}

/** Legacy `TrackController`'s "Available tracks" table. */
export function CircularViewerTrackList({ tracks, data, gcWindowSize, dispatch, errors }: CircularViewerTrackListProps) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="mb-2 text-base font-semibold">
        Available tracks
      </h2>
      <ul className="divide-y">
        {tracks.map((track) => {
          const state = data.get(track.id);
          const failure = errors.get(track.id);
          const error = failure?.error ?? (state?.status === "error" ? state.error : undefined);
          const description = trackDescription(track, gcWindowSize);
          return (
            <li key={track.id} aria-label={track.title} className="py-0.5">
              {/* One height for every row, with or without its show and remove buttons
                  (24px targets, WCAG 2.5.8). */}
              <div className="flex h-7 items-center gap-2">
                <div className="flex shrink-0 items-center gap-0.5">
                  <TrackColorPicker
                    label={`${track.title} background color`}
                    hint="Background color"
                    color={track.background}
                    onChange={(color) => {
                      dispatch({ type: "setBackground", id: track.id, color });
                    }}
                  />
                  {canSetForeground(track) && (
                    <TrackColorPicker
                      label={`${track.title} color`}
                      hint="Track color"
                      color={track.foreground}
                      darkColor={track.darkForeground}
                      onChange={(color) => {
                        dispatch({ type: "setForeground", id: track.id, color });
                      }}
                    />
                  )}
                </div>
                {description === undefined ? (
                  <span className="min-w-0 flex-1 truncate text-sm">{track.title}</span>
                ) : (
                  <>
                    {/* Focusable so the tooltip opens from the keyboard too; screen readers get the
                        description once, through the hidden span, not from the portalled tooltip. */}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span
                            tabIndex={0}
                            aria-describedby={`${id}-${track.id}-description`}
                            className="min-w-0 flex-1 truncate text-sm"
                          >
                            {track.title}
                          </span>
                        }
                      />
                      <TooltipContent aria-hidden="true">{description}</TooltipContent>
                    </Tooltip>
                    <span id={`${id}-${track.id}-description`} hidden>
                      {description}
                    </span>
                  </>
                )}
                {error === undefined && <TrackStatus state={state} />}
                {!track.fixed && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${track.visible ? "Hide" : "Show"} ${track.title}`}
                      onClick={() => {
                        dispatch({ type: "toggle", id: track.id });
                      }}
                    >
                      {track.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${track.title}`}
                      onClick={() => {
                        dispatch({ type: "remove", id: track.id });
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </>
                )}
              </div>
              {error !== undefined && (
                <Alert variant="destructive" size="sm" aria-busy={failure?.isFetching || undefined}>
                  <AlertDescription>
                    <p>{formatUserFacingErrorMessage(error, "This track could not be loaded.")}</p>
                    {failure !== undefined && (
                      <QueryRetryButton retrying={failure.isFetching} onRetry={failure.retry} />
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
