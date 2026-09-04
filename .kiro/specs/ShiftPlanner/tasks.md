# ShiftPlanner — Tasks

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Complete

---

## Cleanup & Polish (Priority: High)

- [x] Remove all `console.log` debug statements from `app.js` (Session 6 — also removed a dead no-op diagnostic loop; SW-registration log downgraded to `console.warn`)
- [x] Remove cache-busting `?v=5` from `<script>` tags in `ShiftPlanner.html` (Session 6 — rely on SW cache versioning)
- [x] Bump `CACHE_NAME` in `sw.js` after cleanup changes (Session 6 — `shiftplanner-v4` → `v5`)
- [x] Convert SVG icons to PNG (192px, 512px, maskable-512) for Chrome PWA install banner support (Session 6 generated + wired; **verified present on disk and precached** Session 10 — `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` all in `icons/`, listed first in `manifest.json`, and in the `sw.js` precache. No manual step outstanding.)

### Spec hygiene (from Spec Reviewer pass, Session 8)

- [x] Annotate design.md algorithm step numbering (Step 7 with no Step 6 — Step 6/8 removed in Session 5; note added, references kept)
- [x] Align off-spacing wording across requirements.md and design.md (5–8 window, fallback 4; HK parity)
- [x] Document Manual-mode validation in design.md Validation Logic section
- [x] Add Build Standards flags block (rigour / stack / platforms / data-privacy) to requirements.md
- [x] Refresh icon wording in design.md (architecture tree + PWA section) and requirements.md PWA section to reflect PNG icons added in Session 6 (SVG now fallback) (Session 9)
- [x] Decide a license for ShiftPlanner and add a LICENSE file — **MIT**, `Copyright (c) 2026 Isaac A. Gera` (Session 9)

### Spec hygiene (from Spec Reviewer pass, Session 11)

Doc-only clarifications — no functionality changed:

- [x] **B1** — Resolve N-target contradiction in requirements.md: target range 8–10, **algorithm hard cap 9** (`nWritten < 9` guard in app.js Step 1), 10 is a known tracked defect not an allowed outcome. Acceptance criterion: no nurse exceeds 9 N.
- [x] **S1** — Distinguish hard guarantee (Fixed Night Weeks — must hold) from best-effort rules (Night Week Preferences, Preferred Night Pairs — miss is acceptable); added a measurable acceptance bar for each.
- [x] **S2** — State supported staff counts: Nurses tuned for 7, HK for 3; other counts untested/unsupported until validated.
- [x] **S3** — Define off-spacing fallback (5–8 → ≥4 → place-what-you-can) and that falling short of 4 offs is a defect that must surface, not fail silently.
- [x] **S4** — Add "Generation failure handling" to requirements.md and a failure-modes note to design.md (graceful degradation, surfaced warnings, error boundary) — backs the open error-boundary task.
- [x] **S5** — Reconcile HK "10–11 day blocks" with month length (3 phases split evenly, ~9–11 days; M→A→N guarantee holds at all month lengths).
- [x] **S6** — Add honest Accessibility (target vs current) subsection: keyboard nav done in Manual mode; ARIA/tooltips/screen-reader still open (backs the accessibility-audit task).
- [x] **N2/N3/N4** — Documented Manual-mode undo depth (shared 20-level stack), 'maids'→'housekeeping' migration is idempotent/safe-to-keep, and PL is additive to the 4 auto-offs (not a replacement).

### Spec hygiene (Spec Reviewer re-review, Session 12)

Re-review verdict: **Ready to build** — all Session 11 findings confirmed resolved against code.
Actioned the 3 optional nice-to-haves (doc-only):

- [x] **NTH-1** — Staff Structure tables now read "7 (configurable; only 7 validated)" / "3 (configurable; only 3 validated)" so they're self-consistent without relying on the later subsection.
- [x] **NTH-2** — Migration wording tightened to cite the actual guard (`!d.housekeeping && d.maids && d.maids.length`) and describe it as a no-op "in the normal case."
- [x] **NTH-3** — Verified in code (no edit needed): `commitManualCell` calls `pushUndo()` exactly once per committed change; `pushUndo` caps the stack at 20 (`if(undoStack.length>20)undoStack.shift()`). The undo-depth spec claim is accurate.

### Spec hygiene (from Spec Reviewer pass, Session 12)

Doc-only clarifications — no functionality changed:

- [x] **S-A** — Added a "Versioning & Release Ritual" section to design.md tying `APP_VERSION` (app.js, `4.1.0`) ↔ `CACHE_NAME` bump (sw.js) ↔ changelog, so the release ritual is specified rather than tribal knowledge.
- [x] **S-B** — Added a "Rule scope vs Nurses" subsection to requirements.md HouseKeeping: Fixed Night Weeks, Preferred Night Pairs, and Incompatible Pairs are Nurses-only by design (no `RULES.housekeeping` keys; `incompatiblePairs` intentionally empty). HK night handling is best-effort phase swap on the `nightPref` field only.
- [x] **S-C** — Added a "RULES Configuration Schema" table to design.md cataloguing every referenced `RULES.*` key (Nurses top-level + `RULES.housekeeping.*`) with shipped defaults and meaning, cross-checked against `rules.js`. Includes the HK rule-scope note and supported-staff-count caveat.
- [x] **N-a** — Clarified in requirements.md (Combo Shifts) that the generator only emits MA; **AN is effectively manual-only** (like PL), so the "max 1 AN" target governs manual entry.
- [x] **N-b** — Noted in requirements.md (Editing) that **switching tabs clears the undo stack** (tabs are independent; edits are already saved, only undo history resets). Accepted behaviour.
- [x] **N-c** — Added a PDF-filename caveat in requirements.md (Export): the `ShiftPlanner <Tab> <Month> <Year>` name is a **best-effort browser suggestion** via `document.title`, not guaranteed.
- [x] **N-d** — Added a file-name casing note to the design.md architecture tree: on-disk `UserGuide.html` / `session-log.md` differ from the family convention but match shipped filenames; left as-is on the deployed app, noted so it reads as intentional.

---

## Algorithm Improvements (Priority: Medium)

- [ ] **Nurses N-distribution edge case:** Occasionally one nurse gets 10N when both their blocks are 5-day blocks. Add a check to cap at 9 by trimming the second block's last day and reassigning to M/A. **(Acceptance criterion now pinned by B1: no nurse may exceed 9 N in a generated rota.)**
- [ ] **Night week preference accuracy:** Validate that block swapping for preferences actually produces correct week placement across all months (test Aug–Dec 2026).
- [ ] **Preferred night pairs:** Currently best-effort. Investigate whether pairing formula can be adjusted to honour preferred pairs more consistently.
- [ ] **Month carry-forward:** Allow copying last few days of previous month to inform block continuity at month boundaries (e.g., if nurse ended previous month on N-block day 3, continue into new month).

---

## Feature Requests (Priority: Medium)

- [ ] **Leave Calendar view:** Visual overview showing who is on PL across the month (calendar grid, not table).
- [ ] **Copy previous month:** Button to duplicate last month's rota as starting point for manual editing.
- [ ] **WhatsApp-friendly export:** Generate an image (PNG) of the rota table for direct sharing.
- [ ] **Multi-month view:** Side-by-side or sequential view of 2–3 months for planning ahead.
- [ ] **Shift swap request:** Allow marking a cell as "swap requested" (visual indicator) for coordinator review.

---

## UX Improvements (Priority: Low)

- [ ] **Print layout fine-tuning:** Test PDF output on different printers/paper sizes; adjust margins if content overflows.
- [ ] **Mobile responsiveness:** Improve table scrolling and touch targets for phone-sized screens.
- [x] **Dark mode:** Optional Light/Dark theme with header toggle, `sp_theme` persistence, `prefers-color-scheme` default, WCAG-AA contrast in both themes, flash-of-light guard, print-stays-light (v4.2.0, Session 16).
- [x] **Keyboard navigation:** Arrow-key + Tab/Enter movement through rota cells (Manual mode, v4.1). Auto-mode cells still use the click-to-edit popup.
- [ ] **Tooltips on hover:** Show shift time (e.g., "8AM–2PM") when hovering over a cell.

---

## Technical Debt (Priority: Low)

- [ ] **Minified code readability:** Current `app.js` uses very compact formatting. Consider a source/dist separation if file grows further.
- [ ] **Error boundary:** Wrap `generateRotaForMonth()` in try/catch to show user-friendly error instead of silent failure.
- [ ] **Automated testing:** Set up lightweight tests (e.g., a test HTML page) that generate rotas for 12 months and verify all rules are met.
- [ ] **Accessibility audit:** Add ARIA labels to interactive elements, ensure keyboard operability, test with screen reader.
- [ ] **Data backup:** Auto-export staff data to a file periodically (or prompt user to export after changes).

---

## Deployment & Distribution (Priority: Low)

- [ ] **Custom domain:** Set up a memorable URL instead of `isaacgera.github.io/ShiftPlanner/`.
- [ ] **Auto-update notification:** When SW detects new cache version, show a toast prompting user to refresh.
- [ ] **Changelog in-app:** Small "What's New" modal showing recent changes (versioned).

---

## Completed (Reference)

- [x] **v4.2.0 — Light/Dark theme toggle** (two-state header toggle, `sp_theme` persistence, OS-pref default, tokenised colour system, `[data-theme=dark]` block) (Session 16)
- [x] **v4.2.0 — Dark-mode contrast to WCAG AA** (`.btn`/`select`/`.shift-btn` text colour, Sunday-red, Manual/Warning alert bodies; Lighthouse Accessibility 100 in both themes) (Session 16)
- [x] **v4.2.0 — Flash-of-light guard** (inline `<head>` script sets theme before paint) + **print always light** (print resets theme tokens) + **Staff Setup dark polish** (Session 16)
- [x] **v4.1.0 — Manual rota mode** (spreadsheet-style entry, valid codes, editable G-row, keyboard nav, confirm-before-clear; both tabs) (Session 7)
- [x] **v4.1.0 — Live Shift Count + coverage/asterisk updates during manual entry**; Total column = live sum (Session 7)
- [x] **v4.1.0 — Highlight persists during cell edit** (Session 7)
- [x] **v4.1.0 — Month picker rework**: current + next 6 months, "Custom date…" dialog for any month (Session 7)
- [x] Nurses algorithm — pre-planned N-block schedule (Session 5)
- [x] HouseKeeping tab — 3-staff rotation with balanced MA (Session 4–5)
- [x] PWA setup — manifest, service worker, SVG icons (Session 5)
- [x] GitHub Pages deployment (Session 5)
- [x] Staff management — add/remove/rename/import/export (Session 4)
- [x] Night week preferences — W1–W4 checkboxes (Session 4)
- [x] Interactive Shift Count table with highlighting (Session 3)
- [x] Inline edit popup (Session 3)
- [x] Manual edits preserved on Re-generate (Session 3)
- [x] PDF export — A4 landscape with proper formatting (Session 4)
- [x] Organisation name — editable, stored, included in export (Session 4–5)
- [x] HouseKeeping offs tuned to 4 with balanced MA (Session 5)

---

## References

- Session history: #[[file:session-log.md]]
- Rules configuration: #[[file:rules.js]]
- App logic: #[[file:app.js]]
