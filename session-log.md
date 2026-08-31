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
