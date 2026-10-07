# Folder picker prototypes (throwaway)

**Question:** which design and flow should the shared workspace folder picker
(the Output Folder browse button, later the read-library selectors) use?

**How to try them:** `pnpm dev`, then open
`http://localhost:3019/services/blast?variant=A` and use the floating bar at the
bottom of the page (or the ← / → keys) to switch between A, B, C and D. Click
the folder button next to Output Folder to open the picker.

| Key | Name            | Shape                                                                  |
| --- | --------------- | ---------------------------------------------------------------------- |
| A   | Current dialog  | The shipped `WorkspacePickerDialog`: view select, table, in-dialog pages |
| B   | Finder columns  | Wide dialog, places sidebar, Miller columns, preview pane               |
| C   | Inline popover  | Popover under the field, filter-as-you-type, one-click pick             |
| D   | Side sheet tree | Right-hand sheet, quick access, lazy folder tree, form stays visible    |

New folder and Upload are real in every variant: they write to the signed-in
user's workspace, exactly like the shipped dialog.

The variant switch works only outside production builds (or with
`NEXT_PUBLIC_PROTOTYPES=1`); production always renders A.

**Verdict (in progress, 2026-10-07):** B is the favourite. Round-one tweaks on
B were:

- The sidebar and footer now share one grey (`bg-muted/50`); the header,
  columns and preview are white.
- Arrow-key navigation now scrolls instantly in both directions. Before, going
  forward scrolled smoothly and going back jumped. Row focus no longer scrolls
  the strip on its own.
- The preview is pinned outside the scrolling strip. Its content fades in on
  every change of selection.
- A "Show files" / "Hide files" toggle in the header replaces the checkbox.
  Files show with their size; hidden items stay hidden.
- Columns and the preview can be resized by dragging their edge, or with ← / →
  on the focused handle. Double-click resets. Widths last between opens.

Round two:

- The footer breadcrumb shows every folder in the path, with no "…" collapse.
  Long names truncate, and the full path shows on hover.
- Going into or out of a folder animates again, the same in both directions.
  The new column fades in from slightly to the right, and the closing column
  fades out the same way. When the strip has to scroll, it glides there over
  180 ms. The glide is a scroll tween, not a transform: transforming the
  scrolled content changes its scroll range and the browser clamps the
  position. ↑ / ↓ within a column doesn't animate the columns.
- The default column width is 180 px (was 224 px, 20% smaller). The minimum
  is 144 px.
- Fixed: the scroll bar snapped. React adds or removes a column in one step,
  which changes the content width (and so the scroll bar thumb's size) at
  once. Going in, the thumb jumped at the start; going out, it jumped at the
  end, when the held width was released. The glide now tweens the content
  width together with the scroll position. Also, ↑ / ↓ within a column no
  longer resets the strip's scroll position.
- Footer breadcrumb: a new crumb, going in or moving to a sibling, fades in
  from slightly to the right, in the same direction new columns come from.
  Going back, the crumb that becomes current fades its colour in.

## Cleanup once decided

- Fold the winner into `src/components/workspace/` as a real, tested component
  (rewrite it; the prototype code has no tests) and point `OutputFolder` at it.
- Delete this folder, `src/components/shared/prototype-switcher.tsx`, the
  `FolderPickerPrototypeSwitcher` line in
  `src/app/services/(genomics)/blast/page.tsx`, and the `FolderPickerPrototypes`
  use in `src/components/services/output-folder.tsx`.
