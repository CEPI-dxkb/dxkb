# AskClark dock prototype (DXKBCORE-342) — throwaway

**Question:** how does AskClark stay available (minimized) and, open or minimized, never cover pagination, the action rail or other page controls?

**Common rule in all variants:** the dock is never drawn over the page. The page makes room for it (right dock: `main` gets a right margin; bottom dock: the shell gets bottom padding and `.h-screen` shrinks), and the docks start under the navbar so the navbar and its AskClark button keep full width. Minimizing keeps the panel mounted (just clipped and `inert`), so scroll position, draft and the running answer survive.

Run: `pnpm dev`, then open `/genome?keyword=influenza&variant=A` (also `B`, `C`, `D`; no param = today's sheet/floating window). Arrow keys or the bottom-left bar switch variants; × exits the prototype. Signed-in only (AskClark needs a user).

| | Surface | Open | Minimized | Page space lost (min.) |
|---|---|---|---|---|
| A Side panel · rail | side panel | 420px right column under the navbar | 44px spine with restore, vertical label, working/unread cue | 44px width |
| B Floating · chip | floating window | today's draggable window + Minimize | navbar button becomes the chip (writing… / answer ready); window hidden | none |
| C Floating · pill | floating window | same | pill parked in a bottom strip the page keeps free | 56px height |
| D Edge tab · both | side panel *and* floating (the options menu's "Show AskClark as" switches) | A's column, or the floating window; both hang off the tab's side. The side panel slides off its edge; the floating window shrinks into the tab and fades | one 32×64px tab floating over the page edge with the bot icon; drag it up/down or across to the other edge (snaps; position saved in localStorage); arrow keys move it | none (overlays the page) |

D's tab overlays the page, so it can sit on up to 32px of whatever is at that edge; it is draggable so the user moves it clear. An open floating window overlays the page by nature and can cover the pager, rail and columns; only the side panel (A, D side) and the minimized forms are guaranteed clear.

Open questions to settle before building for real: phones (docks cannot push at 390px; probably full-screen sheet + FAB), footer pages (footer is outside `main`, so a right dock sits on it), whether the Plan/Execute cards need more than 320px, keyboard shortcut to toggle minimize.

**Verdict:** _(fill in: which variant won and why, then delete this folder, the `// PROTOTYPE` hooks in `layout.tsx`, `copilot-surfaces.tsx`, `copilot-launcher.tsx`, the `"dock"` variant in `copilot-panel-header.tsx` (keep the Minimize button if wanted), and the `PROTOTYPE` block at the end of `globals.css`)_
