# DXKB Accessibility Manual Checklist

Automated tests (axe-core + scripted keyboard/focus) cover ~35–40% of WCAG 2.1 AA criteria.
This checklist covers the remaining criteria that require human judgment.

Run this checklist before any release that touches **nav, modals, data tables, charts, or animated surfaces**.

---

## WCAG 1.4.13 — Content on Hover or Focus

Tooltips, hover cards, and popover content that appears on hover or focus must be:

- [ ] **Dismissible** — pressing Escape hides the tooltip/hover content without moving focus.
- [ ] **Hoverable** — the user can move the pointer onto the revealed content without it disappearing.
- [ ] **Persistent** — the content stays visible long enough to read (no auto-dismiss in < 3s on hover).

**Surfaces to check:**
- Toolbar icon buttons (Refresh, New Folder, Upload) in the workspace browser
- Chart legend pills in the Metadata Distributions section of organism pages
- Column header sort indicators in the data table
- Job status badges in the jobs list
- Virus-family pathogens panel on the Viruses landing cards (toggle "Major human pathogens in <Family>"): the pointer can move from the card onto the panel without closing it, Escape dismisses it and leaves focus on the toggle (also when focus was on a pathogen link), it stays open while the pointer or focus is inside (leaving with one input does not close it while the other is still there), and it opens on hover, on focus, and on tap or Enter/Space (the toggle pins it; a press outside closes it). The other cards fade to 50% while one is open, so check their text stays readable in the dark themes

---

## WCAG 1.3.5 — Identify Input Purpose

Form inputs that collect personal user data must have an `autocomplete` attribute set to the correct [autofill detail token](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill-detail-tokens).

- [ ] Sign-in form: `email` field has `autocomplete="email"`, `password` has `autocomplete="current-password"`.
- [ ] Sign-up form: `email` has `autocomplete="email"`, password has `autocomplete="new-password"`.
- [ ] Settings profile fields: name fields use `autocomplete="given-name"` / `autocomplete="family-name"`.

---

## WCAG 2.5.3 — Label in Name

The visible label text of interactive elements must be contained in (or match) the accessible name.

- [ ] Toolbar buttons whose icon is the visible label: verify the `aria-label` starts with or exactly matches the visible tooltip text.
- [ ] Command palette search input: the visible placeholder matches the accessible name / label.
- [ ] Chart legend toggles: the visible pill text matches the button's accessible name (check with axe too — axe covers 2.5.3 via `label-content-name-mismatch`).
- [ ] Charts menu button in the Metadata Distributions header (taxon overview and Genome list overview): the visible text is "Charts N/M", and the accessible name ("Charts N/M shown", with ", customised" once a chart is hidden) starts with it.

---

## Screen-reader announcement quality

Axe does not verify that announcements are *useful*, only that they exist. Use a real screen reader (VoiceOver on macOS, NVDA on Windows) for the following surfaces:

- [ ] **Workspace file table** — row selection, single/multi-select state, file details panel opening.
  - Expected: "N items selected", file name + type announced on selection, panel heading announced on open.
- [ ] **Jobs list** — status column values should be announced as plain text ("completed", "failed"), not as icon-only.
- [ ] **Command palette** — dialog open/close announcement, item count, focused item name.
- [ ] **Toast notifications (sonner)** — toast content must be announced via an `aria-live` region. Verify with VoiceOver by triggering a file upload success or error.
- [ ] **Data table sort** — after clicking a column header, the sort direction change ("ascending"/"descending") is announced.
- [ ] **Taxonomy charts (Metadata Distributions)** — chart containers must have an accessible title (or `aria-labelledby`) so screen-reader users know what each chart depicts.
- [ ] **Charts menu (Metadata Distributions header)** — on the taxon and Genome list overviews, the menu button is announced as "Charts N/M shown" (plus "customised" once a chart is hidden), and the menu heading names the group whose list it edits ("Show charts for all bacteria", "…all viruses", "…all other taxa" or "…all genome lists"). Each chart is announced as a checkbox menu item with its checked state, and "Show all charts" as a menu item that is announced as unavailable (dimmed) while no chart is hidden and available once one is. After hiding or restoring a chart, the button's count and the checked state update, and the last visible chart's item is announced as unavailable (dimmed), so it cannot be hidden. When every chart of the page is hidden (for example all but AMR hidden on the Genome list, then a filter whose genomes have no AMR data), the section is announced as "All charts are hidden for this view." followed by a "Show all charts" button, which restores the charts; that button appears only in that state. The organism landings have no Charts menu.

---

## WCAG 2.4.6 — Headings and Labels (descriptive)

Automated tools verify heading hierarchy but not content quality.

- [ ] Each page has a unique, descriptive `<h1>` that describes the page's purpose (not just "DXKB").
- [ ] Section headings in long pages (About, FAQ, Publications) are descriptive enough to navigate by heading.
- [ ] Form field labels are descriptive: "Output folder" not just "Folder"; "Read 1 (FASTQ)" not just "File 1".

---

## WCAG 2.4.7 — Focus Visible (enhanced — WCAG 2.2 AA)

The automated keyboard spec checks for outline/box-shadow presence but cannot judge visual prominence.

- [ ] Focused elements are clearly visible against both **light** and **dark** themes.
- [ ] Focused elements within data tables and the command palette have visible rings (the dark theme's ring colour must meet 3:1 contrast against adjacent background).

---

## WCAG 1.4.4 — Resize Text (200%)

- [ ] Browse the app at 200% browser zoom. Verify text does not overflow containers or become truncated without a way to read it.
- [ ] The workspace file name column should show an ellipsis with a tooltip or full expansion available.

---

## How to run a manual pass

1. Install [axe DevTools browser extension](https://www.deque.com/axe/devtools/) for quick supplemental scans.
2. Enable VoiceOver (macOS: `Cmd + F5`) or NVDA (Windows: free download from nvaccess.org).
3. Navigate each surface by **keyboard only**: Tab, Shift+Tab, arrow keys, Enter, Space, Escape.
4. Check every item above; file GitHub issues for failures tagged `a11y`.
5. Record the date and your browser/OS in the issue description.

---

*Last updated: 2026-06-17. Review this checklist after any design system upgrade or new component introduction.*
