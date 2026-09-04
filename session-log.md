# ShiftPlanner — Session Log

## Project Info
- **App Name:** ShiftPlanner
- **Institution:** Sanctum Natural Birth Centre
- **Location:** `C:\Users\615509493\OneDrive - BT Plc\Data Drive\Personal\Learning\Kiro\Projects\hospital-tools\ShiftPlanner\`
- **AI Partner:** Forje
- **Files:** `ShiftPlanner.html` (UI/CSS), `rules.js` (configurable rules), `app.js` (logic)

---

## Session 1 — Aug 20-21, 2026
**Initial Build + Rule Iteration**

### What Was Built
- Single HTML app with modular JS: `ShiftPlanner.html` + `rules.js` + `app.js`
- Shift rota generator for 7 nurses + 1 G-shift person (Jaya)
- Click-to-edit any cell with shift selector modal
- Validation alerts (coverage, incompatible pairs, max off per day)
- Save/Undo buttons for manual edits (20-level undo stack)
- PDF export via browser print (landscape layout)
- Staff Setup modal (add/remove nurses, roles, incompatible pairs)
- Nurses & Maids tabs (maids to be configured later)
- Coverage indicator integrated into date column headers (green/yellow/red)
- Sunday columns: bold red date/day headers

### Staff
- Nurses: SAROJA, VASANTHA, PUNNAMMA, SUVARNA, SANDHYA, SHAILAJA, VIJAYA
- G-Shift: JAYA (every day except Sunday = O)
- Incompatible Pair: SUVARNA & PUNNAMMA (cannot be on same shift)

### Rules (in rules.js)
1. **N shifts** — Exactly 2 nurses per day, in 4-5 day blocks, ~9-10 per nurse/month
2. **M shifts** — 2 nurses per day (can be 3 if no one off), 4-5 day blocks, ~8-10 per nurse
3. **A shifts** — 2 nurses per day (can be 3 if no one off), 4-5 day blocks, ~8-10 per nurse
4. **MA/AN combos** — Only for coverage gaps when PL breaks the pattern. Max 2 MA, max 1 AN per nurse
5. **G shift** — Fixed for Jaya, off on Sundays
6. **O (Day off)** — 4-5 per nurse, spaced out (~1 per week), max 1 nurse off per day
7. **PL** — Manual only
8. **Incompatible pairs** — Cannot be on same M/A/N shift
9. **Typical day** — 2M + 2A + 2N + 1O + Jaya G = 8 people covered

### Current Algorithm (Session 2 — Rewritten)
**"Rotating day-off with block shifts"** — 2-phase approach:

**Phase 1: Off Assignment**
- Round-robin: nurse `(d % numNurses)` is off on day `d`
- Produces perfect spacing (~7 days apart), max 1 nurse off per day
- Each nurse gets 4-5 offs per month (ceil(31/7) = 5 for some, 4 for others)

**Phase 2: Shift Block Assignment (day-by-day)**
- Each working day has 6 nurses → exactly 2N + 2M + 2A
- Nurses staggered into starting shifts: [N,N,M,M,A,A,N] (index-based)
- Block continuity: each nurse stays on same shift for 4-5 working days (BLOCK_MIN=4, BLOCK_MAX=5)
- Rotation order: N → M → A → N → ... (cycles through all shift types)
- Day-by-day decision logic:
  - `mustStay`: block < BLOCK_MIN → cannot change shift
  - `mustRotate`: block >= BLOCK_MAX OR first assignment → rotates to next shift
  - `canRotate`: block between min/max → stays if shift still needs coverage, rotates if full
- Coverage balancing: if any shift over/under target, swap the most flexible nurse
- Edge case: if all 7 working (no one off that day), extra nurse assigned to M or A (alternating)

**Post-processing:**
1. Incompatible pair separation — swap with another nurse on a different shift (checks for cascading conflicts)
2. Validation safety net — any day with <2 coverage gets fixed by moving excess nurses

**Properties guaranteed:**
- Continuous shift blocks of 4-5 working days
- Offs spaced ~7 days apart (never clustered)
- Max 1 nurse off per day
- 2N + 2M + 2A daily coverage (or 2N + 3M + 2A / 2N + 2M + 3A if 7 working)
- Incompatible pairs never on same shift
- Each nurse gets ~9-10 N, ~8-10 M, ~8-10 A, ~4-5 O per month

### Known Issues / Next Steps
- **Algorithm needs real-world testing** — generate for Aug/Sep 2026 and compare visually
- **Maids tab** — not yet configured (same shift structure, fewer staff: Manjula, Eshwari, Mallamma + Gita on G)
- **Month navigation** — consider letting user copy/carry-forward from previous month
- **Print layout** — may need further PDF formatting tweaks
- **Off-day block interruption** — offs can visually split a shift block (e.g., MMM-O-MM) but logic treats it as one 5-day M block

### Decisions Made
- Separate `rules.js` for easy modification by non-technical user
- Modern clean UI (indigo/gold theme, color-coded shifts, rounded cards)
- localStorage persistence (survives page refresh)
- No external dependencies (pure vanilla JS, single-folder deployment)

---

## Session 2 — Aug 21, 2026
**Algorithm Rewrite**

### What Was Done
- Completely rewrote `generateRotaForMonth()` in `app.js`
- Replaced the old slot-rotation + off-redistribution approach (which produced clustered offs and coverage gaps)
- New 2-phase algorithm: round-robin offs → coverage-balanced block assignment
- Added handling for days where all 7 nurses work (no off → 3M or 3A allowed per rules)
- Cleaned up verbose design comments into concise documentation
- Removed unused variables (`totalOffs`, `offAssignment`, `SLOT_SHIFTS`, `NUM_SLOTS`)

### Why
- Old algorithm clustered offs (5-day O-blocks) and relied on fragile redistribution post-processing
- New algorithm assigns single off-days upfront with perfect spacing, then fills shifts day-by-day respecting block continuity
- Much more predictable output that closely matches how the rota is done manually

---

## Session 3 — Aug 21, 2026 (continued)
**Major Algorithm Rewrite + UI Enhancements**

### Algorithm Changes
- **Complete rewrite to Deterministic Slot-Rotation Table**
  - 7 slots `[N,M,A,N,M,A,O]` rotate every ~4-5 days (one phase)
  - Each nurse occupies a fixed slot position that advances deterministically
  - Guarantees equal distribution: every nurse cycles through all slots equally
  - O-slot converted to alternating M/A, then offs placed evenly across month

- **Key rules enforced:**
  - No off during Night block (offs only from M/A days)
  - Max 5 consecutive nights per nurse (hard cap)
  - No standalone N — any N-streak < 3 days gets converted to M
  - N or AN must be part of a 3-5 day block (never random/adhoc)
  - Offs CAN break M/A blocks but NEVER N blocks
  - Every nurse MUST get 4-5 offs, spaced ~4-7 days apart
  - Max 2 nurses off per day (prefer 1)
  - MA combos (2-3 per nurse) used for coverage gaps; AN avoided
  - Equal distribution across all nurses (±1-2 variance max)

- **Incompatible pair handling fixed:**
  - When both are on N: pair[1] gets MA instead of swapping with another nurse (prevents N-block fragmentation)
  - For M/A conflicts: swaps never pick a nurse on N as partner

- **Fixed Night Weeks:** Vijaya placed at index 0 so slot rotation naturally gives her N in weeks 1 & 3

- **Preferred Night Pairs:** Algorithm tries to pair preferred nurses on N together (best-effort)

- **Second-pass off placement:** After main generation, scans fully-staffed days to top up nurses below 5 offs

### New Rules Added (rules.js)
- `night.maxConsecutive: 5` — hard cap on consecutive nights
- `night.noStandalone: true` — N/AN must be part of a block
- `dayOff.maxPerDay: 2` — allow up to 2 offs per day
- `dayOff.spacing: [4,7]` — offs must be 4-7 days apart
- `dayOff.canBreakMA: true` — offs can interrupt M/A blocks
- `combo.maMax: 3` — preferably 2-3 MA per nurse
- `combo.preferMA: true` — prefer MA over AN
- `incompatiblePairs: [['SUVARNA','PUNNAMMA'],['VIJAYA','SHAILAJA']]`
- `preferredNightPairs: [[VIJAYA,SUVARNA],[VIJAYA,SANDHYA],[VASANTHA,SHAILAJA],[SAROJA,SANDHYA],[SAROJA,SUVARNA]]`
- `fixedNightWeeks: {VIJAYA: [1,3]}` — Vijaya MUST have N in weeks 1 & 3
- `general.equalDistribution: true`
- `general.manualEditsLocked: true`

### UI/UX Changes
- **Merged header:** ShiftPlanner title + legend in single card (saves vertical space)
- **Inline edit popup:** Click a cell → floating panel appears at cell location (no center-screen modal)
- **Generate → Re-generate:** Button changes text/color after first generation; Re-generate preserves all manual edits
- **Manual edits tracked:** All manually changed cells preserved on Re-generate (stored in localStorage)
- **Fully-staffed day indicator:** Green asterisk (*) on day headers with no offs + full coverage; clickable to manually add off
- **Add Off modal:** Click asterisk → shows eligible nurses sorted by need; one-click to assign
- **Shift Count table (interactive):**
  - Renamed from "Shift Counts" to "Shift Count"
  - Headers clickable: Name/Total highlights all rows; M/A/N/G/O/PL highlights all cells of that type
  - Name cells clickable: highlights that nurse's full row in main table
  - Count cells clickable: highlights specific shift cells for that nurse
  - Multi-select supported (click multiple items to accumulate highlights)
  - Active state shown with purple background on selected summary cells
  - Click same item again or click outside to clear
  - Header colors match main table shift colors
- **Diagonal Name/Date cell:** Top-left corner with visible diagonal line, "Date" top-right, "Name" bottom-left
- **Styling:**
  - Cell colors: M=blue, A=orange, N=grey/black, O=red bold, PL=lavender bold, G=green, MA=blue/brown, AN=grey/slate
  - Sunday headers: same coverage background as other days, bold red text retained
  - Font size increased ~17% across table
  - O and PL cells use `font-weight:700 !important`
  - All shift cells use `font-weight:600` (matching summary header style)

### Known Issues / Still Testing
- **Vijaya's N placement:** Using index-swap approach to place her at position 0 for natural week 1&3 N
- **Preferred pairs:** Best-effort, may not always achieve perfect pairing due to block constraints
- **Console debug logs still present** — remove before final release
- **Cache-busting `?v=5`** on script tags — remove when stable
- **Maids tab** — not yet configured

### Files Modified
- `app.js` — complete rewrite of generation algorithm + inline edit + highlight system
- `ShiftPlanner.html` — merged header/legend, new CSS for inline popup, highlight, summary colors, diagonal cell
- `rules.js` — all new rules added

---

## Preferences
- Isaac helps spouse create rota monthly
- Rota shared via WhatsApp as PDF + printed for manual reference
- Spouse is not from IT/CS background — app must be simple
- Previously done in Excel (SANCTUM - ROTA.xlsx)


---

## Session 4 — Aug 21, 2026
**HouseKeeping Tab + Nurses Algorithm Rewrite + App Improvements**
**AI Partner:** Kiro

### What Was Done

#### HouseKeeping Tab (new)
- Renamed "Maids" tab to "HouseKeeping" throughout
- Role changed from 'maid' to 'housekeeping' everywhere
- Completely separate generation algorithm from Nurses:
  - 3 staff rotate through M → A → N in 10-11 day blocks (3 phases per month)
  - Monthly rotation via `monthOffset = month % 3` for fairness
  - 3 offs per staff, only from M/A days (never N)
  - Offs spaced 8-11 days apart, max 1 per day
  - When someone is off, M-person (or A-person) covers MA
  - MA balanced to ~3 each via preference-aware off placement
- Separate rules in `rules.js` under `RULES.housekeeping`
- Coverage target = 1 per shift (vs 2 for nurses)

#### Nurses Algorithm — Complete Rewrite
- Replaced the old slot-rotation table with a day-by-day N-assignment approach
- **N-assignment (Step 1):** Single-pass day-by-day with block continuity
  - Picks 2 nurses per day for N based on: (1) continue existing block, (2) fewest N count, (3) week preference as tiebreaker
  - Enforces 4-5 day blocks (must-continue for days 1-3, can-continue for day 4-5)
  - Caps at 9N per nurse
  - Night week preference support (W1/W2/W3/W4 checkboxes in Staff Setup)
- **M/A assignment (Step 2):** Each available nurse gets their deficit shift (the one they have fewer of), with coverage enforcement (min 2M + 2A per day)
- **Offs (Step 3):** Exactly 4 per nurse, only from M/A, spaced 5+ days, max 1 per day
- **Coverage check (Step 4):** Swap excess shifts first, MA only as absolute last resort
- **Incompatible pairs (Step 5):** Swap with another nurse on a different shift
- **Max 5 consecutive N (Step 6):** Safety cap
- **Final M/A cap at 9 (Step 7):** Convert overflow to MA (spread evenly across month)
- **Standalone N cleanup (Step 8):** Any N-block < 4 days converted to M

#### Known Issue — Nurses N-Distribution
- The day-by-day N-assignment algorithm still produces uneven N-counts in some cases
- Block continuity logic may be too aggressive (locks 2 nurses for 4 days, leaving others starved)
- **Next session:** Needs further debugging — possibly revert to a simpler sequential block assignment or add a rebalancing pass

#### UI/Layout Changes
- Tabs (Nurses/HouseKeeping) moved into header card, second row, left side
- Legend moved to center of second row
- Staff Setup + Export PDF buttons moved to far right of second row
- "ROTA FOR THE MONTH OF..." title centered in header between app name and controls
- Table sizes reduced ~12-15% (font, padding, min-width) to avoid horizontal scrollbar
- Shift Count table column order: G | M | MA | A | AN | N | O | PL | Total
- MA and AN columns added to Shift Count (counted separately, not included in M/A/N totals)

#### Staff Management
- **Org name:** Made app organisation-agnostic — org name editable (click in header), stored in localStorage
- **No hardcoded staff:** `getDefaultStaff()` returns empty arrays — first-time users add staff via Staff Setup
- **Rename staff:** Click name or ✏️ icon → prompt to rename. Updates rota data, edits, and incompatible pairs
- **Add staff:** New staff auto-added to existing rota table (empty row). Defaults to correct role per tab
- **Night preference:** W1/W2/W3/W4 checkboxes per nurse in Staff Setup. Saved as `nightPref` array
- **Export/Import:** JSON and CSV export/import in Staff Setup. Includes orgName and nightPref
- **Persistence fix:** Removed `loadStaff()` condition that was overwriting user data with defaults on reload

#### Generate/Re-generate Logic
- Fixed: `updateButtons()` now called on empty-rota early return path
- Fixed: generation failure shows toast "No staff configured"
- Fixed: localStorage migration for old 'maids' key
- Empty state shows "No staff configured" with button to open Staff Setup

#### PDF/Print Export
- Filename defaults to `ShiftPlanner <Tab> <Month> <Year>`
- A4 Landscape, 0.8cm margins
- Print mirrors screen layout: header with org name, active tab only, legend, rota + summary
- Hidden on print: Generate, Save, Undo, Staff Setup, Export PDF buttons, inactive tab
- Uniform 1.5px borders on all table cells
- 3px outer border around entire page content
- Sticky positioning disabled on print (fixes header border alignment)
- `print-color-adjust: exact` for shift cell backgrounds

### Files Modified
- `app.js` — complete rewrite of generation algorithms (nurses + housekeeping), staff management, export/import, org name, night preferences
- `ShiftPlanner.html` — header layout restructure, tab placement, legend positioning, print CSS rewrite, table size reduction, summary table header colors
- `rules.js` — housekeeping rules section added, nurses dayOff changed to maxPerDay:1 and targetPerNurse:[4,4], removed hardcoded staff names

### Open Items for Next Session
1. **Nurses N-distribution** — day-by-day algorithm needs fixing. Consider:
   - Adding a post-assignment rebalancing pass that swaps entire 4-day blocks between nurses
   - Or reverting to the dual-stream approach but with proper conflict-free sequencing
   - Goal: every nurse gets 8-9 N in clean 4-5 day blocks
2. **Night week preference** — currently implemented but not producing correct results due to the N-distribution bug
3. **Test across multiple months** — verify monthly rotation fairness for both tabs
4. **Remove console.log debug statements** before release
5. **Cache-busting `?v=5`** on script tags — remove when stable

---

## Session 5 — Aug 22, 2026
**Nurses N-Distribution Fix + HK Offs Update + PWA Deployment**
**AI Partner:** Forje

### What Was Done

#### Nurses N-Distribution — Fixed
- Replaced day-by-day N-assignment with **pre-planned block schedule**
  - 7 blocks of 4-5 days per month, 2 nurses per block
  - Pairing formula: `n1=(b+monthOffset)%7`, `n2=(b+3+monthOffset)%7` — guarantees no nurse in adjacent blocks
  - Each nurse appears exactly 2 times = 8-9 N per nurse (capped at 9 in write loop)
  - Max 5 consecutive N enforced after write (clears excess, filled by M/A in Step 2)
- Removed Step 6 (max-5-nights) that was destroying valid blocks
- Removed Step 8 (standalone N cleanup) — blocks are pre-planned correctly
- Incompatible pairs only enforced on M/A (never break N-blocks)
- Night week preference: swaps block positions without creating adjacency (validated before applying)
- **Result:** N-counts consistently 8-9 per nurse across multiple months

#### HouseKeeping — 4 Offs
- Changed targetPerStaff from 3 to 4
- Spacing reduced from [8,11] to [6,8] to accommodate 4 offs
- MA target updated to 4 per staff (12 total offs ÷ 3 staff = 4 MA each)
- Expected distribution: ~10-11 N, ~7 M, ~7 A, ~4 MA, 4 O per 31-day month

#### PWA Setup
- Created `manifest.json` (app name, theme, standalone display, SVG icons)
- Created `sw.js` (service worker — cache-first, offline support)
- Created `icons/icon-192.svg`, `icons/icon-512.svg`, `icons/icon-maskable.svg`
- Added PWA meta tags to `ShiftPlanner.html` (manifest link, theme-color, Apple metas, SW registration)
- Note: Chrome requires PNG icons for install prompt — SVG works for manifest but not installability

#### GitHub Pages Deployment
- Repo: `https://github.com/isaacgera/ShiftPlanner`
- Live URL: `https://isaacgera.github.io/ShiftPlanner/ShiftPlanner.html`
- User Guide: `https://isaacgera.github.io/ShiftPlanner/UserGuide.html`
- Deploy workflow: `git add -A` → `git commit -m "msg"` → `git push origin main`

#### Other
- Restored default staff in `getDefaultStaff()` (app loads ready-to-use without import)
- Regenerated `ShiftPlanner-Staff.json` and `.csv` backup files
- Created `UserGuide.html` — comprehensive single-file user guide
- Organisation name made dynamic (click to edit, stored in localStorage, included in export/import)

### Files in Repo
- `ShiftPlanner.html` — the app (UI + CSS)
- `app.js` — all logic (generation, editing, export, highlighting)
- `rules.js` — configurable shift rules (nurses + housekeeping)
- `sw.js` — service worker for PWA offline caching
- `manifest.json` — PWA manifest
- `UserGuide.html` — user documentation
- `icons/` — SVG app icons (192, 512, maskable)
- `session-log.md` — development history
- `ShiftPlanner-Staff.json` + `.csv` — staff backup files

### Known Limitations
- PWA install prompt requires PNG icons (SVG works for manifest but Chrome won't show install banner)
- "Add to Home Screen" on mobile works regardless
- N-distribution: occasionally one nurse gets 10N if both their blocks are 5-day blocks (rare, acceptable)
- File:// protocol shows "unsafe" console warning (normal — use hosted version instead)

### Deployment Checklist for Updates
1. Make changes to files
2. `git add -A && git commit -m "description"`
3. Run `git push origin main` from terminal (needs credentials)
4. Bump `CACHE_NAME` in `sw.js` for PWA users to get the update
5. Wait 1-2 min for GitHub Pages to deploy


### Update — HK Offs Tuned to 4
- Target distribution confirmed:
  - 30-day month: M=6, MA=4, A=6, N=10, O=4 (all 3 staff identical)
  - 31-day month: M=6/7, MA=4, A=6/7, N=10/11, O=4 (rotational fairness)
- Off spacing relaxed to [5,8] with fallback to [4] to guarantee all 4 offs placed
- Phase 4 MA balancing target = 4 per staff (12 total offs ÷ 3 = 4 MA each)

---

## Session 6 — Aug 30, 2026
**Cleanup / Release Hygiene**
**AI Partner:** Forjé

### What Was Done

#### Debug logging removed (`app.js`)
- Removed 3 debug `console.log` statements (nurses/days summary, N-Schedule dump, N-Appearances dump)
- Removed a dead no-op diagnostic loop that checked for adjacent-block conflicts but only logged (the real correction happens in the appearances-fix loop below it) — replaced with an explanatory comment
- `app.js` and `rules.js` now contain zero `console.*` statements

#### Cache-busting query strings removed (`ShiftPlanner.html`)
- Removed `?v=5` from both `<script src="rules.js">` and `<script src="app.js">` tags — SW `CACHE_NAME` versioning is the single mechanism for cache invalidation now
- Downgraded the SW-registration failure `console.log` to `console.warn` (kept — it's a legitimate non-fatal error handler)

#### PNG icons for Chrome install banner
- Chrome requires PNG icons to show the "Install app" banner (SVG works for the manifest but not installability)
- **No raster tooling on this machine** (no ImageMagick/Inkscape/Node; the `python.exe` is the non-functional Windows Store stub), so created a zero-dependency browser-based generator: **`icons/generate-png-icons.html`**
  - Draws the icon on a `<canvas>` matching the existing SVG design (indigo `#6366f1`, white "SP", `#c7d2fe` "ShiftPlanner" label)
  - One-click downloads for `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (maskable uses full-bleed background + ~82% safe-zone scaling)
- `manifest.json`: now lists the 3 PNGs first (192, 512, maskable-512), with the 2 SVGs kept as scalable fallbacks
- `ShiftPlanner.html`: favicon + apple-touch-icon now point to `icon-192.png`
- `sw.js`: `CACHE_NAME` bumped `shiftplanner-v4` → `shiftplanner-v5`; `ASSETS` precache list now includes the 3 PNGs + 2 SVGs

### Verification
- IDE diagnostics clean on `app.js`, `ShiftPlanner.html`, `sw.js`, `manifest.json` (no errors)
- Confirmed via `findstr`: no `?v=` anywhere, no `console.*` in `app.js`/`rules.js`, icon references consistent across HTML/manifest/SW
- **Not yet verified in a live browser** (Windows shell can't run a server here reliably) — see manual checks below

### ⚠️ Remaining Manual Step (do before next deploy)
1. Open `icons/generate-png-icons.html` in a browser (double-click, or via Live Server)
2. Click each of the 3 Download buttons; save the files into the `icons/` folder with the exact names shown
3. **Important:** the SW `ASSETS` list now references those PNGs, and `cache.addAll()` is all-or-nothing — if the PNGs don't exist at deploy time, the service worker install will fail. Generate them first.

### Manual Checks Suggested
- Load `ShiftPlanner.html` via Live Server (not `file://`), open DevTools → Application → Manifest: confirm PNG icons resolve and "Add to Home screen / Install" is offered
- Confirm the tab favicon shows the SP icon
- Regenerate a rota (Nurses + HouseKeeping) to confirm the `app.js` edits didn't affect generation

### Deploy Checklist
1. Generate the 3 PNGs (above)
2. `git add -A && git commit -m "Cleanup: remove debug logs + cache-bust, add PNG icons, bump SW to v5"`
3. `git push origin main`
4. SW `CACHE_NAME` already bumped to `v5` — existing PWA users will pull the update

### Files Modified
- `app.js` — removed debug logs + dead diagnostic loop
- `ShiftPlanner.html` — removed `?v=5`, PNG favicon/apple-touch-icon, `console.warn`
- `manifest.json` — PNG icons added (SVG kept as fallback)
- `sw.js` — `CACHE_NAME` v4→v5, PNGs added to precache
- `icons/generate-png-icons.html` — **new** browser-based PNG generator

### Addendum — App Version Constant + Backlog Sync
- **Introduced a single app version constant.** Added `APP_VERSION = '4.0.1'` at the top of `app.js` as the single source of truth for the app's semantic version. Previously the app had no version constant and was leaning on the SW `CACHE_NAME` (`shiftplanner-vN`) as a proxy — but that's a cache-busting tag, not an app version. They're now explicitly decoupled (comment in `app.js` notes this).
  - Surfaced as a small superscript `v4.0.1` next to the app title in the header (`#app-version` span, `.app-version` CSS — muted, unobtrusive). Also appears on printed PDF (inside `<h1>`), which is acceptable/nice.
  - Also exposed as `window.SP.version` for convenience.
- **Versioning going forward:** the previous shipped state was effectively v4.0. This cleanup pass is patch-level (no feature/behaviour change) → **v4.0.1**. Bump `APP_VERSION` on each release and keep it in step with a changelog; bump the SW `CACHE_NAME` separately when cached assets change.
- **Ideas backlog synced.** `Ideas.md` ShiftPlanner row moved `Built (v4.0)` → `In Progress (v4.0.1)` (should have flipped to In Progress at the start of the session — corrected). Set back to `Built (v4.0.1)` once this deploys and is verified.

### Files Modified (addendum)
- `app.js` — `APP_VERSION` constant, `renderVersion()` at init, `window.SP.version`
- `ShiftPlanner.html` — `#app-version` span in header + `.app-version` CSS
- `Ideas.md` (backlog) — status → In Progress (v4.0.1)

---

## Session 7 — Aug 30, 2026
**v4.1.0 — Manual Rota Mode + Live Summary/Coverage + Picker & Nav (prototype-first, then ported)**
**AI Partner:** Forjé

### Workflow
Adopted the new **prototype-first** standing rule for this feature set. Built and iterated in
`prototypes/ShiftPlanner-prototype.html` + `app-proto.js` + `rules-proto.js` (sandbox with
`spproto_`-namespaced localStorage so it could never touch live data), across three review
rounds with Isaac, then ported the finalized behaviour into the live app in one pass.

### What Was Built (v4.1.0)

#### Manual rota mode (new)
- New **Manual** button (teal) beside Generate/Re-generate, for both Nurses and HouseKeeping.
- Builds a blank, hand-editable grid. **Confirms before clearing** an existing rota.
- Cells are **spreadsheet-style contenteditable** — type the shift code directly, no dropdown/popup.
  - Accepts only valid codes (M, G, A, N, O, PL, MA, AN), **case-insensitive**; invalid entries
    flash red, revert, and toast a message. Empty cells allowed.
  - **G-shift row** is auto-prefilled (G weekdays / O Sundays) as a starting point but is
    **editable** in Manual mode (overridable by hand). In auto mode it stays fixed as before.
  - Keyboard navigation: **Enter / Tab** commit + advance (Shift = reverse); **arrow keys**
    move between cells (←/→ same person across days, ↑/↓ same day across people); **Escape**
    reverts. At a grid edge, focus stays put (no dead state). Manual entry keeps working on return.
  - Non-blocking validation warnings (coverage / incompatible pairs) surface as toasts.

#### Live summary & coverage (items 3 & 4)
- New `refreshSummaryAndCoverage()` updates the Shift Count table and the day-header coverage
  colour + fully-staffed asterisk **in place** (no full re-render), so the cursor isn't disrupted
  during manual entry. Called after each committed manual cell — counts/coverage update live.
- **Total column** is now the **live sum** of G+M+MA+A+AN+N+O+PL per staff (was hardcoded to
  days-in-month). Equals days-in-month when a row is fully filled — doubles as a completeness check.
  Applies in both auto and manual modes.

#### Highlight persistence during edit (bug fix)
- The Shift Count highlight now **survives editing** a main-table cell: `render()` re-applies the
  active highlight after rebuilds, and the outside-click handler no longer clears the highlight when
  the click is inside the rota table or the inline shift-picker popup.

#### Month/year picker rework
- Default list = **current month + next 6** only (past months dropped from the quick list),
  defaulting to the current month.
- **Custom date…** is the last dropdown entry — opens a month/year dialog (year range now±5) to
  jump to any past/future month. A custom pick shows in the dropdown tagged "(custom)".

#### Smaller items
- Empty-state message updated: "…click **Generate** to create a balanced schedule, or click
  **Manual** to create a schedule manually."
- HouseKeeping default night preferences seeded to P1/P2/P3 for the three staff (fresh installs only).

### Release chores
- `APP_VERSION` bumped **4.0.1 → 4.1.0** (minor: new feature).
- SW `CACHE_NAME` bumped **shiftplanner-v5 → v6** so existing PWA users pull the update.
- Ideas backlog row → **In Progress (v4.1.0)** (kept In Progress — more changes planned).

### Verification
- IDE diagnostics clean on `app.js`, `ShiftPlanner.html`, `sw.js`.
- Storage keys confirmed to resolve to the original `sp_*` names (via `PK='sp_'`), so existing
  users' saved staff/rotas load seamlessly — no data migration needed.
- **Not browser-tested here** (Windows shell can't run a live server). Isaac tested each round in
  the prototype via Live Server; the live app should be re-checked the same way before/after deploy.

### Manual check before deploy
- Load `ShiftPlanner.html` via Live Server. Confirm: Manual mode entry + nav on both tabs, live
  Shift Count + coverage updates, Total = live sum, highlight persists during edit, month dropdown
  shows current + next 6 with a working "Custom date…" entry.

### Deploy status
- **Committed locally, held for Isaac's review — not pushed yet.** On approval:
  `git push origin main` (SW already at v6; GitHub Pages serves within 1–2 min).

### Prototype
- Kept under `prototypes/` for future iteration. It remains the sandbox for the next round
  (e.g. the mooted nurses-generation-algorithm rework).

### Files Modified
- `app.js` — full v4.1 logic (ported from `app-proto.js`, re-namespaced to `sp_`, version 4.1.0)
- `ShiftPlanner.html` — Manual button, manual-hint bar, manual-mode/editing/invalid-flash CSS
- `sw.js` — `CACHE_NAME` v5 → v6
- `UserGuide.html` — added "Building a Rota Manually" section (keyboard nav, live counts), updated Total-column and month-picker (Custom date) descriptions, workflow steps
- `.kiro/specs/ShiftPlanner/*` — requirements/design/tasks updated
- `Ideas.md` (backlog) — row → In Progress (v4.1.0)

---

## Session 8 — Aug 30, 2026
**Spec review (new Spec Reviewer agent) + spec-hygiene fixes**
**AI Partner:** Forjé

### What Was Done
Ran the new **Spec Reviewer** Kiro agent against the ShiftPlanner spec trilogy (read-only review),
then actioned the findings. **No app code changed** — this session only touched the spec docs.

#### Fixes applied to `.kiro/specs/ShiftPlanner/`
- **design.md — step-numbering glitch:** the Nurses pipeline listed Step 7 with no Step 6 (Step 6
  "max 5 consecutive nights" and old Step 8 "standalone-N cleanup" were removed in Session 5).
  Added an explanatory note; kept the 1–5/7 numbering so it still matches `app.js` and the log.
- **Off-spacing drift aligned:** design.md Nurses off-placement now states the **5–8 day** window
  with fallback to 4 (was ">= 5 / fallback >= 4"), matching requirements.md. Added the
  "(with fallback to 4 if needed)" parenthetical to the HouseKeeping spacing line for parity.
- **Manual-mode validation documented:** added a "Manual-mode validation (v4.1)" subsection to
  design.md's Validation Logic (blocking code-validation + non-blocking rule-warning toast in
  `commitManualCell`), which previously only described the inline-popup edit path.
- **Build Standards block added to requirements.md:** rigour (Medium), stack (vanilla, no build),
  platforms (PWA desktop+mobile, GitHub Pages), data/privacy (local-first, no patient data), and
  **licensing = TBD** (flagged — no LICENSE chosen yet).

### Open item
- **License still undecided** — needs a call from Isaac before a LICENSE file is added
  (tracked in tasks.md and the requirements Build Standards block).

### Verification
- Doc-only edits; no code touched, so no rebuild needed. Reviewed edited sections for internal
  consistency. App behaviour and version (v4.1.0) unchanged.

### Files Modified
- `.kiro/specs/ShiftPlanner/design.md` — step-numbering note, off-spacing wording, Manual-mode validation subsection
- `.kiro/specs/ShiftPlanner/requirements.md` — Build Standards block, HK off-spacing parity
- `.kiro/specs/ShiftPlanner/tasks.md` — "Spec hygiene" completed items + open license task

---

## Session 9 — Aug 30, 2026
**Spec re-review + icon-docs refresh**
**AI Partner:** Forjé

### What Was Done
Re-ran the Spec Reviewer against the ShiftPlanner spec to confirm the Session 8 fixes.
All four verified landed and consistent (step-numbering note, off-spacing alignment,
Manual-mode validation subsection, Build Standards block). Verdict: **Ready to build**.

The re-review surfaced one new minor drift — the icon references still said "SVG icons" only,
even though Session 6 added PNGs. Fixed it:
- **design.md** — architecture tree now lists PNG icons (192/512/maskable-512) + SVG fallbacks and
  the `generate-png-icons.html` generator; PWA/Manifest section rewritten to say PNGs are listed
  first with SVG fallbacks, and notes the install-banner requirement is satisfied + the
  all-or-nothing SW precache caveat.
- **requirements.md** — PWA section now lists PNG icons (with SVG fallbacks) instead of SVG-only.

### Open item (unchanged)
- **License still undecided** — the one remaining item before the spec is fully complete.
  Needs Isaac's pick, then add a LICENSE file (tracked in tasks.md).

### Verification
- Doc-only edits; no app code touched, no rebuild needed. Re-read the edited sections — icon
  wording now consistent across design.md and requirements.md. App/version (v4.1.0) unchanged.

### Files Modified
- `.kiro/specs/ShiftPlanner/design.md` — icon wording (architecture tree + PWA/Manifest section)
- `.kiro/specs/ShiftPlanner/requirements.md` — PWA icons wording
- `.kiro/specs/ShiftPlanner/tasks.md` — icon-docs task ticked under Spec hygiene

### Addendum — License decided (MIT)
- Chose **MIT** for ShiftPlanner (endorsed over Apache-2.0 — patent grant is overkill for a small
  local-first tool). Created `LICENSE` at the app root: `Copyright (c) 2026 Isaac A. Gera`,
  matching the Bill Splitter app for family consistency.
- `requirements.md` Build Standards licensing line updated TBD -> MIT.
- `tasks.md` license task ticked. This closes the last open item from the Spec Reviewer pass —
  the ShiftPlanner spec is now complete with no outstanding flags.

### Files Modified (addendum)
- `LICENSE` — new, MIT
- `.kiro/specs/ShiftPlanner/requirements.md` — licensing line
- `.kiro/specs/ShiftPlanner/tasks.md` — license task ticked

---

## Session 10 — Aug 30, 2026
**Spec-hygiene pass (Spec Reviewer follow-up) — verified against disk**
**AI Partner:** Forjé

Actioned the four tidy-up items from the latest Spec Reviewer pass. Claims were verified against
the actual files before editing (not taken on trust).

1. **PNG-icon task ticked.** Confirmed all 3 PNGs exist on disk (`icons/icon-192.png`,
   `icon-512.png`, `icon-maskable-512.png`), listed first in `manifest.json`, and precached in
   `sw.js`. tasks.md changed `[~]` -> `[x]`; removed the misleading "manual step remaining" note.
2. **License resolved (trail note).** MIT is fully in place — `LICENSE` at app root
   (Copyright (c) 2026 Isaac A. Gera), requirements Build Standards states MIT, tasks ticked.
   The older Session 8/9 "TBD" lines are historical only; **licensing is resolved (MIT), no longer open.**
3. **Maskable SVG now actually used.** Rather than precache an unreferenced file, added
   `icon-maskable.svg` to `manifest.json` as a maskable SVG fallback, then added it to the `sw.js`
   precache. Bumped `CACHE_NAME` shiftplanner-v6 -> v7 (precache list changed).
4. **design.md architecture tree refreshed.** Added the now-present `LICENSE` file and
   `prototypes/` folder; clarified the icons line (PNG + SVG fallbacks).

**Reviewer accuracy note:** the review was right on items 1/2/4. Its item-3 suggestion ("cache the
maskable SVG") was based on treating an intentionally-unreferenced file as an omission — corrected
by making the file referenced (manifest + precache) instead of caching dead weight.

### Verification
- Verified icon files and LICENSE/prototypes exist via directory listing; confirmed manifest + sw.js
  wiring by reading both. design.md cache reference is generic (`shiftplanner-v<n>`), so no version
  edit needed there. Doc + small manifest/SW edits only; app logic and version (v4.1.0) unchanged.
- **Deploy note:** `CACHE_NAME` bumped to v7 — next deploy will refresh cached clients.

### Files Modified
- `.kiro/specs/ShiftPlanner/tasks.md` — PNG task [~] -> [x]
- `.kiro/specs/ShiftPlanner/design.md` — architecture tree (LICENSE, prototypes/, icons line)
- `manifest.json` — added maskable SVG fallback
- `sw.js` — precache maskable SVG; CACHE_NAME v6 -> v7

---

## Session 11 — Sep 1, 2026
**Spec Reviewer pass + spec-clarification edits (docs only, no functionality change)**
**AI Partner:** Forjé

### What Was Done
Ran the **Spec Reviewer** agent against the ShiftPlanner spec trilogy again (read-only). Verdict:
*Needs work (minor)* — buildable now, but with testability/consistency gaps the earlier passes
(Sessions 8–10) didn't dig into. Actioned the findings as **doc-only clarifications** — Isaac
confirmed edits were fine "provided the functionality is not affected." **No app code touched**
(`rules.js` / `app.js` / `ShiftPlanner.html` unchanged); the edits just make the docs describe the
existing shipped behaviour accurately. Ground truth was confirmed by reading `rules.js` and the
`app.js` N-block write loop before editing.

#### Findings actioned (all in `.kiro/specs/ShiftPlanner/`)
- **B1 — N-target contradiction resolved (requirements.md).** The doc simultaneously said target
  8–10, cap 9, and logged 10 as a bug. Clarified: configured target range **8–10**, **algorithm
  hard cap 9** (verified `nWritten < 9` guard in app.js Step 1), and **10 is a known tracked defect,
  not an allowed outcome**. Acceptance criterion pinned: no nurse exceeds 9 N. Cross-linked to the
  open N-distribution task (which now cites this criterion).
- **S1 — hard vs best-effort rules (requirements.md).** Added a "Rule strength" note and per-rule
  acceptance bars: **Fixed Night Weeks = hard guarantee** (must appear, else defect); **Night Week
  Preferences & Preferred Night Pairs = best-effort** (unmet is acceptable, honoured only via a
  safe swap that violates no hard rule).
- **S2 — supported staff counts (requirements.md).** Stated Nurses algorithm is tuned for **7**
  (hardcoded 7 blocks, +3 gap, 2+2+2+1+1 math) and HK for **3**; other counts untested/unsupported
  until validated.
- **S3 — off-spacing fallback (requirements.md).** Defined the ladder: prefer 5–8 → relax to ≥4 →
  place what you can; falling short of 4 offs is a **defect that must surface** (not silent).
- **S4 — generation failure handling (requirements.md + design.md).** Added a requirements section
  and a design "Generation failure modes" note: graceful degradation, surfaced (toast/banner)
  warnings, error boundary — flagged as target/open (backs the open error-boundary task).
- **S5 — HK block length vs month (requirements.md).** Reconciled "10–11 day blocks": month split
  into 3 phases as evenly as possible (~9–11 days by month length); M→A→N coverage guarantee holds
  at all month lengths.
- **S6 — accessibility honesty (requirements.md).** Added an "Accessibility (target vs current)"
  subsection: keyboard nav done in Manual mode; ARIA/tooltips/screen-reader still open (backs the
  a11y-audit task). Removes the requirement-vs-reality mismatch.
- **N2/N3/N4 (requirements.md).** Manual-mode undo shares the 20-level stack (can fill fast — bounded
  by design); 'maids'→'housekeeping' migration is idempotent and safe to keep indefinitely; PL is
  **additive** to the 4 auto-offs (not a replacement).

#### tasks.md
- Added a "Spec hygiene (Session 11)" block ticking B1/S1/S2/S3/S4/S5/S6/N2–N4 as doc clarifications.
- The open **N-distribution** task now carries the pinned acceptance criterion from B1.

### Reviewer accuracy note
The B1 contradiction and the testability gaps (S1/S3/S4) were accurate and worth pinning. S6 was a
fair callout against the standing accessibility baseline even though the spec text itself didn't
over-claim ARIA — added an honest status subsection so the requirement backs the open audit task.

### Verification
- Doc-only edits; no app code, so no rebuild needed. Confirmed the N-cap ground truth in `app.js`
  (`nWritten < 9`) and target range in `rules.js` (`night.targetPerNurse: [8,10]`) before writing.
- IDE diagnostics on the spec files show only the **pre-existing** spec-template heading warnings
  (the docs use Isaac's own `# ShiftPlanner — …` heading style, not Kiro's `# Requirements Document`
  template); my edits added no new errors. App/version (v4.1.0) unchanged.

### Files Modified
- `.kiro/specs/ShiftPlanner/requirements.md` — B1, S1, S2, S3, S4, S5, S6, N2–N4 clarifications
- `.kiro/specs/ShiftPlanner/design.md` — S4 "Generation failure modes" note in Validation Logic
- `.kiro/specs/ShiftPlanner/tasks.md` — Session 11 spec-hygiene block; N-distribution acceptance criterion

---

## Session 12 — Sep 1, 2026
**Spec Reviewer re-review + nice-to-have doc tidy (docs only, no functionality change)**
**AI Partner:** Forjé

### What Was Done
Re-ran the **Spec Reviewer** agent against the ShiftPlanner spec trilogy to confirm the Session 11
clarifications landed. Verdict: **Ready to build** — all Session 11 findings (B1, S1–S6, N2/N3/N4)
confirmed genuinely resolved, each doc claim verified against `rules.js` / `app.js`, no new
contradictions introduced. The reviewer raised three optional nice-to-haves; actioned all three as
**doc-only** edits (no app code touched).

- **NTH-1 (requirements.md Staff Structure tables):** the role tables said "7 (configurable)" /
  "3 (configurable)" while the "Supported nurse count" subsection says only 7/3 are validated.
  Tightened to **"7 (configurable; only 7 validated)"** and **"3 (configurable; only 3 validated)"**
  so the tables are self-consistent on their own.
- **NTH-2 (requirements.md Persistence):** the 'maids'→'housekeeping' migration was described as a
  "no-op once no 'maids' key remains." Tightened to cite the actual guard
  (`!d.housekeeping && d.maids && d.maids.length`) and describe it as a no-op "in the normal case"
  (i.e. whenever a `housekeeping` key exists OR no legacy `maids` data is present).
- **NTH-3 (verification, no edit needed):** confirmed the Manual-mode undo claim against code —
  `commitManualCell` calls `pushUndo()` exactly once per committed change (valid+changed code, or
  clearing a non-empty cell), and `pushUndo` caps the stack at 20
  (`if(undoStack.length>20)undoStack.shift()`). The spec's undo-depth wording is accurate as-is.

### Verification
- Doc-only edits; no app code, so no rebuild needed. NTH-3 verified by reading `commitManualCell`
  and `pushUndo` in `app.js`. Spec files still show only the pre-existing spec-template heading
  lint warnings (docs use Isaac's `# ShiftPlanner — …` style); no new errors. App/version (v4.1.0)
  unchanged.
- **Spec status:** complete with no outstanding flags — Ready to build.

### Files Modified
- `.kiro/specs/ShiftPlanner/requirements.md` — NTH-1 table wording, NTH-2 migration precision
- `.kiro/specs/ShiftPlanner/tasks.md` — Session 12 spec-hygiene block (NTH-1/2/3)

---

## Session 12 — Sep 1, 2026
**Spec Reviewer follow-up — closed all Should-fix + Nice-to-have findings (docs only)**
**AI Partner:** Forjé

### What Was Done
Re-ran the **Spec Reviewer** agent against the ShiftPlanner spec trilogy (read-only). Verdict this
time: **Ready to build** — no blockers, spec is mature and factually grounded (reviewer cross-checked
claims against `app.js`/`rules.js` and they held). Isaac asked to close the remaining findings.
Actioned as **doc-only clarifications** — **no app code touched** (`rules.js` / `app.js` /
`ShiftPlanner.html` unchanged, v4.1.0). Read `rules.js` in full before writing the RULES schema so
the table reflects shipped defaults, not guesses.

#### Should-fix findings actioned (all in `.kiro/specs/ShiftPlanner/`)
- **S-A — versioning ritual (design.md).** Added a "Versioning & Release Ritual" section: a table
  tying `APP_VERSION` (app.js, `4.1.0`) ↔ `CACHE_NAME` bump (sw.js) ↔ changelog, plus the rule of
  thumb (never bump version without bumping cache name, or the SW serves stale assets) and the
  `-proto` tag convention.
- **S-B — HouseKeeping rule scope (requirements.md).** Added a "Rule scope vs Nurses" subsection:
  Fixed Night Weeks, Preferred Night Pairs, and Incompatible Pairs are **Nurses-only by design**
  (confirmed no such keys in `RULES.housekeeping`; its `incompatiblePairs` is `[]`). HK's only
  preference mechanism is a best-effort phase swap on the staff `nightPref` field.
- **S-C — RULES config schema (design.md).** Added a "RULES Configuration Schema" section: two
  tables (Nurses top-level + `RULES.housekeeping.*`) cataloguing every referenced key with shipped
  default and meaning, cross-checked line-by-line against `rules.js`. Folded in the HK rule-scope
  note and the supported-staff-count caveat (7 nurses / 3 HK).

#### Nice-to-have findings actioned
- **N-a (requirements.md, Combo Shifts).** Generator only emits MA; **AN is effectively manual-only**
  (like PL) — has code/colour/summary column but no generation step produces it. "Max 1 AN" governs
  manual entry.
- **N-b (requirements.md, Editing).** Documented that **switching tabs clears the undo stack** (tabs
  independent; edits already saved, only undo history resets). Accepted behaviour.
- **N-c (requirements.md, Export).** PDF filename `ShiftPlanner <Tab> <Month> <Year>` is a
  **best-effort browser suggestion** via `document.title`, not a guaranteed output.
- **N-d (design.md, architecture tree).** Added a casing note: on-disk `UserGuide.html` /
  `session-log.md` differ from the family convention (`userguide.html` / `SESSION-LOG.md`) but match
  the shipped filenames referenced by the SW precache; left as-is on the deployed app, noted so the
  casing reads as intentional rather than an oversight.

#### tasks.md
- Added a "Spec hygiene (Session 12)" block ticking S-A/S-B/S-C and N-a/N-b/N-c/N-d as doc
  clarifications.

### Verification
- Doc-only edits; no app code, so no rebuild needed. Read `rules.js` in full before writing the
  RULES schema table; every key/default in the table matches the file. `APP_VERSION` (v4.1.0) and
  `CACHE_NAME` references carried over from the Session 11 code cross-check (not re-opened this
  round — noted honestly to Isaac).
- The N-d casing note describes disk accurately (confirmed via directory listing); no files renamed
  — a deliberate choice to avoid churning filenames referenced by the SW precache on a deployed app.

### Files Modified
- `.kiro/specs/ShiftPlanner/design.md` — RULES schema section (S-C), Versioning & Release Ritual (S-A), architecture-tree casing note (N-d)
- `.kiro/specs/ShiftPlanner/requirements.md` — HK rule scope (S-B), AN manual-only (N-a), tab-switch undo (N-b), PDF filename caveat (N-c)
- `.kiro/specs/ShiftPlanner/tasks.md` — Session 12 spec-hygiene block

---

## Session 13 — Sep 4, 2026
**v4.1.1 — PWA re-check + manifest `scope` fix (Bug Fix mode)**
**AI Partner:** Forjé

### Context
Isaac brought in a PWA-check findings list from a couple of days ago that flagged three fixes:
add a SW-registration snippet, bump `CACHE_NAME` v7→v8, and bump the version constant + changelog.
Re-ran the **PWA Readiness Checker** agent against the current on-disk state to align — and the
findings turned out to be **stale**. All three "fixes" were already in place from earlier sessions:

- SW registration snippet — **already present** in `ShiftPlanner.html` (bottom of `<body>`, feature-guarded).
- `CACHE_NAME` — **already at `shiftplanner-v7`** (Session 10 bump); the finding's "v7→v8" was a
  misread of v7 as pending rather than the shipped state.
- `APP_VERSION` — **already `4.1.0`** in `app.js` with a full changelog trail in this log.

(Note: the built-in grep tool returned "no matches" for these tokens in `ShiftPlanner.html`/`app.js`
despite them being present — confirmed by direct file reads, which are the source of truth here.)

### What the fresh audit actually found
**Verdict: PWA-ready, zero blockers.** One genuine Should-fix and a couple of optional nice-to-haves.

#### Fix applied (the one real gap)
- **`manifest.json` — added `"scope": "./"`.** Previously absent; the browser inferred scope from
  `start_url`, which works but leaves the installed app's navigation boundary implicit. Making it
  explicit pins the scope to the app's own subpath (important for the GitHub Pages `/ShiftPlanner/`
  deployment).
- **Manifest polish (nice-to-haves, done in the same pass):** added `"lang": "en-GB"` and
  `"dir": "ltr"` for manifest completeness. All three are one-liners and share the same cache bump.

#### Release chores
- `APP_VERSION` bumped **4.1.0 → 4.1.1** (patch: config-only, no behaviour change).
- SW `CACHE_NAME` bumped **shiftplanner-v7 → v8** so installed PWA users pull the manifest change.
- Ideas backlog row → **In Progress (v4.1.1)** at start of build; set back to **Built (v4.1.1)**
  once deployed and verified.

#### Deferred (optional, not done)
- In-app "new version available — reload" toast (SW already auto-activates via `skipWaiting()` +
  `clients.claim()`, so this is polish only).
- `categories` manifest field (store-listing polish, not needed for a private tool).

### Verification
- IDE diagnostics clean on `manifest.json`, `sw.js`, `app.js` (no errors). `manifest.json` confirmed
  valid JSON with the three new fields correctly placed after `start_url`.
- **Not browser-tested here** (Windows shell can't run a live server reliably) — manual checks below.

### Manual checks / deploy steps for Isaac (before this reaches users)
1. Serve over HTTP, not `file://` — e.g. `npx serve .` from the ShiftPlanner folder (or Live Server).
2. DevTools → Application → Manifest: confirm no errors, `scope` shows `./`, installability tick present.
3. DevTools → Application → Service Workers: confirm `sw.js` is **activated** and the cache is
   `shiftplanner-v8`.
4. Offline test: load once, toggle DevTools "Offline", reload — app shell should still render.
5. Run Lighthouse → Progressive Web App / installability — should come back clean.
6. Deploy: `git add -A && git commit -m "v4.1.1: add manifest scope + lang/dir, bump SW to v8"`
   then `git push origin main`. GitHub Pages serves within 1–2 min.
7. Once verified live, set the Ideas backlog row → **Built (v4.1.1)**.

### Files Modified
- `manifest.json` — added `scope`, `lang`, `dir`
- `sw.js` — `CACHE_NAME` v7 → v8
- `app.js` — `APP_VERSION` 4.1.0 → 4.1.1
- `session-log.md` — this entry
- `Ideas.md` (backlog) — row → In Progress (v4.1.1)

---

## Session 14 — Sep 4, 2026
**v4.1.2 — Accessibility fixes from Lighthouse (75% → target 100%) + v4.1.1 verified deployed**
**AI Partner:** Forjé

### Context
Isaac served v4.1.1 over Live Server and ran DevTools + Lighthouse. Confirmed the v4.1.1 work
landed correctly: **SW `#392` activated and running**, manifest `scope` resolving, and Lighthouse
**Performance / Best Practices / SEO all 100%**. Two categories to act on:
- **Accessibility 75%** — axe found real, fixable issues (below).
- Minor manifest/console warnings (screenshot for richer install UI = optional; a deprecated
  Apple meta tag; a transient SVG-icon "failed to load" that was a dev-server blip — the SVGs all
  exist on disk and are precached, confirmed via directory listing).

### Accessibility fixes (all in `ShiftPlanner.html` / `app.js`)
1. **Colour contrast (was serious/failing):**
   - `--primary` indigo `#6366f1` → **`#4f46e5`** (indigo-600) so white text on the Generate button
     and active tab clears WCAG AA 4.5:1 (was 4.46, right on the edge).
   - Manual button teal `#0d9488` → **`#0f766e`** (teal-700) — was 3.74, now passes.
   - `--text-light` `#64748b` → **`#5b6675`** so the empty-state paragraph on the cream bg clears
     4.5:1 (was 4.48).
   - Version superscript: was `--text-light` @ `opacity:.7` (computed `#939eae`, failing) → new
     **`--muted` `#6b7685`** token, no opacity, weight 600 — passes.
   - Org-name placeholder: was `--text-light` @ `opacity:0.5` (computed `#b2bac5`, badly failing) →
     `renderOrgName()` now styles the placeholder with the accessible `--muted` token + italic
     instead of faint opacity. Solid state clears the placeholder styling on reset.
   - `theme_color` (manifest) + `theme-color` meta aligned to the new `#4f46e5` for consistency.
2. **`<select>` had no accessible name (was critical):** added
   `aria-label="Select month and year for the rota"` to `#month-select`.
3. **No `<main>` landmark (was moderate):** changed `<div id="rota-content">` → `<main id="rota-content">`
   (id preserved; no CSS targeted `div#rota-content`, so styling unaffected).
4. **Empty `<h2>` heading (axe-linter, robustness):** the runtime-populated month title `#rota-month-title`
   now carries `aria-label="Rota month"` so it's never announced empty even before JS fills it.
5. **Deprecated `apple-mobile-web-app-capable` (console):** added modern
   `<meta name="mobile-web-app-capable" content="yes">` alongside the Apple one.

### Not changed (deliberately)
- The manifest SVG icons — they exist on disk, are precached, and resolve fine; the Lighthouse
  "failed to load" was a one-off dev-server artifact (SW installed successfully).
- Richer-install-UI screenshot — optional store polish, not needed for a private clinic tool.

### Release chores
- `APP_VERSION` **4.1.1 → 4.1.2** (patch: a11y/markup fixes, no functional change to rota logic).
  Rolled the undeployed v4.1.1 manifest work into this same release.
- SW `CACHE_NAME` **shiftplanner-v8 → v9**.
- Ideas backlog row → **In Progress (v4.1.2)**; set to **Built (v4.1.2)** once verified + deployed.

### Verification
- IDE diagnostics clean on `ShiftPlanner.html`, `app.js`, `sw.js`, `manifest.json` (the earlier
  axe-linter empty-heading error is resolved by the `aria-label`).
- Contrast targets checked against WCAG AA 4.5:1 for the specific pairs axe flagged; accent gold
  `#8B6914` on cream (~5.3:1) was already passing and left as-is.
- **Not re-run through Lighthouse here** (no live server in this environment) — Isaac to re-verify
  (steps below).

### Manual re-check for Isaac (before flipping backlog to Built)
1. Hard-refresh over Live Server (or bump-cached SW will update on next load — cache is now v9).
2. DevTools → Application → Service Workers: confirm the new worker activates and cache is
   `shiftplanner-v9`.
3. Re-run Lighthouse → **Accessibility should now be ~100%** (or close; any residual item will be
   a manual-only check axe can't auto-score). Performance/BP/SEO should stay 100%.
4. Eyeball the header: Generate (indigo) + Manual (teal) buttons, version superscript, and the
   org-name placeholder should all still look right — just very slightly deeper in colour.
5. Deploy: `git add -A && git commit -m "v4.1.2: accessibility fixes (contrast, select label, main landmark), bump SW to v9"` then `git push origin main`.
6. Once verified live, set the Ideas backlog row → **Built (v4.1.2)**.

### Files Modified
- `ShiftPlanner.html` — colour tokens, manual-button colour, version-text colour, `<main>` landmark,
  select `aria-label`, h2 `aria-label`, `mobile-web-app-capable` meta, theme-color
- `app.js` — `APP_VERSION` 4.1.1 → 4.1.2; org-name placeholder styling (muted+italic vs opacity)
- `manifest.json` — `theme_color` → `#4f46e5`
- `sw.js` — `CACHE_NAME` v8 → v9
- `session-log.md` — this entry
- `Ideas.md` (backlog) — row → In Progress (v4.1.2)

---

## Session 15 — Sep 4, 2026
**v4.1.3 — Clear manifest SVG-icon warnings (Option A)**
**AI Partner:** Forjé

### Context
Isaac re-ran Lighthouse on v4.1.2: **all four categories 100%** (accessibility fix confirmed).
DevTools → Application → Manifest still showed persistent warnings:
- 3× "Icon icons/icon-*.svg failed to load"
- 2× "Richer PWA Install UI won't be available… add a screenshot"

### Diagnosis
Read the actual SVG files — they are **valid** (well-formed, correct dimensions). The repeated
"failed to load" is Chrome's manifest icon loader being unreliable with SVG icon entries; it's a
known Chrome quirk, not a file problem. The **PNG icons already cover 192/512/maskable**, which is
all Chrome needs for installability — hence Lighthouse stayed 100% and the app installs fine. The
SVG manifest entries were therefore adding warnings with no benefit.

### Fix (Option A, Isaac's pick)
- **`manifest.json`:** removed the 3 SVG entries from the `icons` array — now lists only the 3 PNGs.
- **`sw.js`:** dropped the 3 SVGs from the `ASSETS` precache list (no longer referenced by the app).
- **SVG files kept on disk** (`icons/*.svg`) — not deleted; still available for any future use.
  Only their *manifest/precache references* were removed.
- **Screenshots (the other 2 warnings): deliberately skipped.** They only enrich the install
  dialog; for a private clinic tool that already installs cleanly it's low-value. Those two remain
  as informational notices and do not affect the 100 score.

### Release chores
- `APP_VERSION` **4.1.2 → 4.1.3** (patch: manifest/config only, no functional change).
- SW `CACHE_NAME` **shiftplanner-v9 → v10** (precache list changed).
- Ideas backlog row → **In Progress (v4.1.3)**; set to **Built (v4.1.3)** once verified + deployed.

### Verification
- IDE diagnostics clean on `manifest.json`, `sw.js`, `app.js`. Manifest is valid JSON with 3 PNG
  icons only.
- **Not re-checked in a live browser here** — Isaac to confirm (steps below).

### Manual re-check for Isaac
1. Hard-refresh over Live Server; DevTools → Application → Service Workers: new worker activates,
   cache is `shiftplanner-v10`.
2. Application → Manifest: the 3 SVG "failed to load" errors should be **gone**; only the 2
   optional screenshot notices remain (expected/acceptable).
3. Lighthouse should still be 100 across the board.
4. Deploy: `git add -A && git commit -m "v4.1.3: drop SVG manifest icons (Chrome load warnings), bump SW to v10"` then `git push origin main`.
5. Once verified live, set the Ideas backlog row → **Built (v4.1.3)**.

### Files Modified
- `manifest.json` — removed 3 SVG icon entries (PNGs only now)
- `sw.js` — removed 3 SVGs from precache; `CACHE_NAME` v9 → v10
- `app.js` — `APP_VERSION` 4.1.2 → 4.1.3
- `session-log.md` — this entry
- `Ideas.md` (backlog) — row → In Progress (v4.1.3)
