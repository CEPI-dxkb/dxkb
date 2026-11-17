import { columnWidthLimitsFor, previewWidthLimits } from "./folder-picker-utils";

export const pickerLayoutKey = "dxkb-folder-picker-layout:v1";
export const dialogWidthLimits = { min: 720, max: 1920, initial: 1280 };
export const dialogHeightLimits = { min: 480, max: 1400, initial: 672 };
/** 2rem: the room the dialog's CSS max-width and max-height keep free around it. */
export const dialogGutter = 32;
/**
 * A column at this index or deeper is neither stored nor read back: its handle still
 * responds, but the change is dropped and the column keeps its default width. That is far
 * deeper than any real workspace nesting the picker shows; `columnEntry` applies the cap
 * to both directions, so every column below it is remembered.
 */
export const maxStoredColumns = 32;

export interface DialogSize {
  width: number;
  height: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface StoredPickerLayout {
  /** Absent means the default size. */
  dialog?: DialogSize;
  /** By column index; only entries that differ from the column's default. */
  columns: Record<number, number>;
  /** The info pane's width; absent means the default. */
  preview?: number;
}

function clampAxis(
  value: number,
  limits: { min: number; max: number },
  available: number,
): number {
  const ceiling = Math.min(limits.max, available - dialogGutter);
  const floor = Math.min(limits.min, available - dialogGutter);
  return Math.round(Math.max(floor, Math.min(ceiling, value)));
}

/** The size the dialog really renders: the stored one, inside the limits and the window. */
export function effectiveDialogSize(
  stored: DialogSize | undefined,
  viewport: Viewport,
): DialogSize {
  return {
    width: clampAxis(
      stored?.width ?? dialogWidthLimits.initial,
      dialogWidthLimits,
      viewport.width,
    ),
    height: clampAxis(
      stored?.height ?? dialogHeightLimits.initial,
      dialogHeightLimits,
      viewport.height,
    ),
  };
}

/** The dialog is centred, so an edge follows the pointer only if the size changes by twice its travel. */
export function resizeDialogSize(
  start: DialogSize,
  dx: number,
  dy: number,
  viewport: Viewport,
): DialogSize {
  return effectiveDialogSize(
    { width: start.width + 2 * dx, height: start.height + 2 * dy },
    viewport,
  );
}

/** A side of the dialog, or a corner, by compass point: the part a resize drags. */
export type ResizeEdge = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

/**
 * Which way the pointer's travel moves each axis. Dragging a side outward grows the dialog
 * and dragging it inward shrinks it, so the east and south sides take the travel as it is
 * and the west and north sides take it reversed; a side that does not touch an axis (an
 * edge touches one, a corner two) takes none of it.
 */
const edgeSigns: Record<ResizeEdge, { x: -1 | 0 | 1; y: -1 | 0 | 1 }> = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
  nw: { x: -1, y: -1 },
  ne: { x: 1, y: -1 },
  sw: { x: -1, y: 1 },
  se: { x: 1, y: 1 },
};

/**
 * `resizeDialogSize` for a drag of one side or corner, where `dx` and `dy` are the pointer's
 * travel since the press. An axis the side does not touch comes back as `start` has it, so
 * `rememberUntouchedAxes` leaves what is remembered for it alone.
 */
export function resizeDialogByEdge(
  edge: ResizeEdge,
  start: DialogSize,
  dx: number,
  dy: number,
  viewport: Viewport,
): DialogSize {
  const signs = edgeSigns[edge];
  return resizeDialogSize(start, signs.x * dx, signs.y * dy, viewport);
}

export function maximizeDialogSize(viewport: Viewport): DialogSize {
  return effectiveDialogSize(
    { width: Infinity, height: Infinity },
    viewport,
  );
}

/**
 * The size a resize stores. A resize reports the size the dialog renders, which a small
 * window clamps, so an axis it did not visibly change (`next` equals `current`) keeps the
 * value remembered for it instead of the clamped one, and a later, larger window still
 * opens at that value.
 */
export function rememberUntouchedAxes(
  next: DialogSize,
  current: DialogSize,
  remembered: DialogSize,
): DialogSize {
  return {
    width: next.width === current.width ? remembered.width : next.width,
    height: next.height === current.height ? remembered.height : next.height,
  };
}

/**
 * What Expand stores: the window maximum, but never less than the remembered size (the
 * default when none) on either axis. The stored size is not the rendered one: where the
 * window is too small on one axis the maximum is clamped there, and storing that clamped
 * value would shrink the width or height the next, larger window opens with. The size
 * still renders as the maximum, since `effectiveDialogSize` clamps it to the window.
 */
export function expandedDialogSize(
  stored: DialogSize | undefined,
  viewport: Viewport,
): DialogSize {
  const maximum = maximizeDialogSize(viewport);
  return {
    width: Math.max(maximum.width, stored?.width ?? dialogWidthLimits.initial),
    height: Math.max(maximum.height, stored?.height ?? dialogHeightLimits.initial),
  };
}

/** Whether Expand would change the size: the window leaves room to grow on at least one axis. */
export function canMaximize(size: DialogSize, viewport: Viewport): boolean {
  const maximum = maximizeDialogSize(viewport);
  return maximum.width > size.width || maximum.height > size.height;
}

export function isMaximized(size: DialogSize, viewport: Viewport): boolean {
  const maximum = maximizeDialogSize(viewport);
  return size.width === maximum.width && size.height === maximum.height;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clampTo(value: number, limits: { min: number; max: number }): number {
  return Math.round(Math.max(limits.min, Math.min(limits.max, value)));
}

function parseDialog(value: unknown): DialogSize | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const width = finiteNumber((value as Record<string, unknown>).width);
  const height = finiteNumber((value as Record<string, unknown>).height);
  return width === null || height === null ? undefined : { width, height };
}

/** One stored column as `[index, width]`, inside the cap and the column's limits; `null` if it cannot be stored. */
function columnEntry(key: string, raw: unknown): [number, number] | null {
  const index = Number(key);
  const width = finiteNumber(raw);
  if (
    width === null ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= maxStoredColumns
  ) {
    return null;
  }
  return [index, clampTo(width, columnWidthLimitsFor(index))];
}

function parseColumns(value: unknown): Record<number, number> {
  const columns: Record<number, number> = {};
  if (typeof value !== "object" || value === null) return columns;
  for (const [key, raw] of Object.entries(value)) {
    const entry = columnEntry(key, raw);
    if (entry) columns[entry[0]] = entry[1];
  }
  return columns;
}

export function parsePickerLayout(raw: string | null): StoredPickerLayout {
  if (raw === null) return { columns: {} };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { columns: {} };
  }
  if (typeof data !== "object" || data === null) return { columns: {} };
  const record = data as Record<string, unknown>;
  const dialog = parseDialog(record.dialog);
  const preview = finiteNumber(record.preview);
  return {
    ...(dialog ? { dialog } : {}),
    columns: parseColumns(record.columns),
    ...(preview === null ? {} : { preview: clampTo(preview, previewWidthLimits) }),
  };
}

/** Only what differs from the defaults is stored, so a layout back at its defaults leaves nothing behind. */
export function serializePickerLayout(layout: StoredPickerLayout): string | null {
  const columns: Record<number, number> = {};
  for (const [key, raw] of Object.entries(layout.columns)) {
    const entry = columnEntry(key, raw);
    if (entry && entry[1] !== columnWidthLimitsFor(entry[0]).initial) {
      columns[entry[0]] = entry[1];
    }
  }
  const stored: Record<string, unknown> = {};
  if (layout.dialog) stored.dialog = layout.dialog;
  if (Object.keys(columns).length > 0) stored.columns = columns;
  if (layout.preview !== undefined && layout.preview !== previewWidthLimits.initial) {
    stored.preview = layout.preview;
  }
  return Object.keys(stored).length > 0 ? JSON.stringify(stored) : null;
}
