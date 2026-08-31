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
- [~] Convert SVG icons to PNG (192px, 512px) for Chrome PWA install banner support (Session 6 — manifest/HTML/SW wired for PNG + browser-based generator `icons/generate-png-icons.html` created; **manual step remaining:** open the generator and download the 3 PNGs into `icons/` before next deploy)

---

## Algorithm Improvements (Priority: Medium)

- [ ] **Nurses N-distribution edge case:** Occasionally one nurse gets 10N when both their blocks are 5-day blocks. Add a check to cap at 9 by trimming the second block's last day and reassigning to M/A.
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
- [ ] **Dark mode:** Add optional dark theme (respect `prefers-color-scheme`).
- [ ] **Keyboard navigation:** Allow arrow-key movement through rota cells and Enter to edit.
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
