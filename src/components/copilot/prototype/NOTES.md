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

## Header layouts (adds a "Full page" button)

Second row of the switcher bar, or `?header=0|1|2|3` (default 3). They apply to the side panel and the
floating window while a dock variant is active; the full-page chat keeps today's header. Default is now 3 (the pick).

| Key | Layout | Controls |
| --- | --- | --- |
| 0 Today | Chats, bot, title + Beta, New chat, Options, Minimize, Close | no full-page button (baseline) |
| 1 Two rows | row 1: title + Beta, Expand, Minimize, Close; row 2 (muted toolbar): Chats, New chat, Options | text labels fit; costs ~37px of height (78px header) |
| 2 Regrouped | history icon, title, New chat, Options \| Expand, Minimize, Close (divider before the window controls) | 41px; Beta text only when the window is wider than 24rem |
| 3 Layout menu | history icon, title, New chat, Options (model only), Layout menu, Minimize, Close | Layout menu = Side panel / Floating window / Full page; the gear loses "Show AskClark as" |

At the floating window's 320px minimum the title gets: today 70px, 2: 77px, 3: 86px, 1: 182px.

Keep from this experiment whichever wins: `copilot-options-menu.tsx` (the gear menu, split out with a
`surfaces` prop) and the full-page button. Delete `header-variants.tsx`, the header store in
`dock-state.tsx`, and the `PROTOTYPE` branch in `CopilotPanelHeader`.

### Decided with header 3

- The model picker left the header: it is a dropdown in the composer toolbar (`copilot-model-menu.tsx`,
  passed to the composer as `toolbarExtra`). The gear menu (`copilot-options-menu.tsx`) is now only
  "Show AskClark as" (headers 0-2); header 3 has no gear (its layout menu does that job), and the
  full page and docked prototype surfaces have none.
- Plan / Execute is a dropdown (`ModeMenu` in `copilot-composer.tsx`) instead of a two-button toggle;
  Execute shows filled so it is noticed. The "Shift+Enter for a new line" hint is gone.
- Composer toolbar at the floating window's 320px minimum: attach, folder, mode (61-85px), model
  (shrinks and truncates), send.
