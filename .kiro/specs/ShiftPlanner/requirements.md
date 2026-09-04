# ShiftPlanner — Requirements

## Overview

ShiftPlanner is a shift rota generator for healthcare institutions (default: Sanctum Natural Birth Centre). It produces monthly shift schedules for two staff groups — **Nurses** and **HouseKeeping** — ensuring fair distribution, continuous shift blocks, and adequate daily coverage.

The app is a single-folder, zero-dependency vanilla JS web application designed for non-technical users. It runs entirely in the browser with localStorage persistence and offline PWA support.

---

## Build Standards (agreed)

- **Rigour level:** Medium — proper module separation (`rules.js` / `app.js` / `ShiftPlanner.html`),
  localStorage persistence patterns, single `APP_VERSION` constant. No automated test suite yet
  (tracked as tech debt).
- **UI/UX stack:** Vanilla HTML/CSS/JS, no framework and **no build step** — chosen so the app runs
  on a non-technical user's device with zero tooling and works offline.
- **Target platforms:** Installable PWA — desktop and mobile web, responsive, offline-capable;
  hosted on GitHub Pages.
- **Data & privacy:** Local-first. All data stays on the device (localStorage + JSON/CSV export);
  no server, no tracking. Staff names are the only personal data; no patient data.
- **Licensing:** **MIT** — `LICENSE` file at the app root, `Copyright (c) 2026 Isaac A. Gera`
  (matches the Bill Splitter app for family consistency).

---

## Staff Structure

### Nurses Tab
| Role | Count | Behaviour |
|------|-------|-----------|
| Nurse | 7 (configurable; only 7 validated) | Rotates through M, A, N shifts with offs |
| G-Shift | 1 (JAYA) | Fixed G-shift every day, off on Sundays |

### HouseKeeping Tab
| Role | Count | Behaviour |
|------|-------|-----------|
| HouseKeeping | 3 (configurable; only 3 validated) | Rotates through M, A, N in long blocks |
| G-Shift | 1 (GITA) | Fixed G-shift every day, off on Sundays |

### Supported nurse count

- The Nurses algorithm is **designed and tuned for 7 rotating nurses** (plus the fixed G-shift
  nurse). The pipeline hardcodes 7 N-blocks and a `+3` pairing gap (see design.md Step 1), and the
  daily coverage math (2M + 2A + 2N + 1O + 1G) assumes 7 rotating nurses.
- Counts **other than 7 are untested** and are not guaranteed to satisfy coverage or fairness.
  In particular, fewer than ~7 nurses cannot sustain 2M + 2A + 2N plus a daily off, so coverage
  targets may not be met. Treat non-7 configurations as unsupported until validated (tracked as
  a future algorithm task).
- HouseKeeping is likewise tuned for **3 rotating staff** (plus the fixed G-shift person); other
  counts are untested.

### Staff Management
- Add / remove / rename staff via Staff Setup modal
- Toggle active/inactive per staff member
- Night week preferences (W1/W2/W3/W4 checkboxes per nurse)
- Incompatible pairs configurable in Staff Setup
- Export/Import staff as JSON or CSV (includes org name, nightPref)
- Organisation name editable (click in header), stored in localStorage

---

## Shift Types

| Code | Name | Hours | Colour |
|------|------|-------|--------|
| M | Morning | 8AM–2PM | Blue |
| G | General | 10AM–6PM | Green |
| A | Afternoon | 2PM–8PM | Orange |
| N | Night | 8PM–8AM | Grey/Black |
| O | Day Off | — | Red (bold) |
| PL | Planned Leave | — | Lavender (bold) |
| MA | Morning+Afternoon | 8AM–8PM | Blue/Brown |
| AN | Afternoon+Night | 2PM–8AM | Grey/Slate |

---

## Nurses — Shift Rules

### Night Shift (N)
- Exactly **2 nurses per day** on Night
- Continuous blocks of **4–5 days** (never broken by O)
- Hard max: **5 consecutive nights** per nurse
- **N count per nurse per month:**
  - Configured target range (`RULES.night.targetPerNurse`): **8–10**
  - **Algorithm hard cap: 9** — the generator writes at most 9 N per nurse
    (enforced inline in Step 1 via an `nWritten < 9` guard). 9 is the effective ceiling
    for a generated rota; the 8–10 range is the acceptable spread, not a licence to reach 10.
  - **10 N is not an allowed outcome.** An occasional 10 can still escape when both of a
    nurse's blocks are 5-day blocks; this is a **known, tracked defect** (see tasks.md
    "Nurses N-distribution edge case"), not intended behaviour. Acceptance criterion for a
    generated rota: **no nurse exceeds 9 N.**
- N or AN must be part of a 4–5 day block (no standalone N)
- After a night block, nurse gets M (recovery shift)

### Morning Shift (M)
- Minimum **2 nurses per day** (can be 3 if no one is off)
- Blocks of **4–5 days** (offs CAN break M-blocks)
- Target: **8–10 M per nurse per month** (capped at 9 in algorithm)

### Afternoon Shift (A)
- Minimum **2 nurses per day** (can be 3 if no one is off)
- Blocks of **4–5 days** (offs CAN break A-blocks)
- Target: **8–10 A per nurse per month** (capped at 9 in algorithm)

### Combo Shifts (MA / AN)
- Used **only for coverage gaps** when no other option exists
- Prefer MA over AN
- Target: max **2–3 MA** per nurse per month
- Max **1 AN** per nurse per month (preferably 0)
- **Generation vs manual:** in practice the generator only ever produces **MA** (in the coverage
  and final-cap steps — see design.md Steps 4 and 7); **AN is effectively manual-only**, like PL.
  It has a shift code, a colour, and a summary-table column so it can be typed in Manual mode or via
  the inline editor, but no generation step emits AN. The "max 1 AN" target therefore governs manual
  entry, not an auto-generated outcome.

### G-Shift
- Fixed nurse (JAYA) every day
- Off on Sundays (day 0)

### Day Off (O)
- Exactly **4 offs per nurse per month** (hard target)
- Max **1 nurse off per day** (configurable, currently 1)
- Spacing: **5–8 days apart** preferred
- Offs can interrupt M or A blocks but **NEVER N blocks**
- **Spacing fallback (defined behaviour):**
  1. First attempt: place all 4 offs within the preferred **5–8 day** window.
  2. If the 5–8 window can't place all 4 (the arithmetic is tight — 4 offs across 28–31 days
     with only M/A days eligible), relax to **≥ 4 days apart** and retry. A rota that used the
     ≥ 4 fallback is **acceptable, not a defect** — placing all 4 offs takes priority over
     ideal spacing.
  3. **Placing all 4 offs is the hard requirement.** If even the relaxed ≥ 4 spacing cannot fit
     all 4 (extreme edge, e.g. an over-constrained short month), the generator places as many as
     it can on eligible M/A days rather than violating a hard rule (no off on an N day, max 1
     off/day). Falling short of 4 offs is a defect and should surface as a generation warning
     (see Generation failure handling below), not fail silently.

### Planned Leave (PL)
- Manual assignment only (never auto-generated)
- Counts toward off/coverage limits (`RULES.plannedLeave.countsAsOff`)
- Preserved on Re-generate (locked)
- **Interaction with the "exactly 4 offs" rule:** a PL day is treated as an off for coverage
  purposes, but it is **additive to** the 4 auto-generated offs, not a replacement for one — the
  algorithm still targets 4 O offs and does not subtract a PL day from that count. So a nurse with
  1 PL day effectively has 4 O + 1 PL = 5 non-working days that month. (If future behaviour should
  instead have PL reduce the 4 auto-offs, that is a rule change to decide deliberately, not the
  current behaviour.)

### Incompatible Pairs
- Configured pairs cannot be on the **same M or A shift** on the same day
- N-block conflicts are accepted (N-blocks are not broken for incompatibility)
- Default pairs: SUVARNA & PUNNAMMA, VIJAYA & SHAILAJA

### Rule strength: hard guarantees vs best-effort

The N-placement preferences below fall into two distinct classes. A generated rota must be
judged against the correct bar for each:

- **Hard guarantee (must hold, or the rota is wrong):** Fixed Night Weeks.
- **Best-effort (honoured when it can be without violating a hard rule; not a failure if missed):**
  Night Week Preferences, Preferred Night Pairs.

Best-effort rules are always subordinate to the hard rules (2 N/day coverage, 4–5 day blocks,
max 5 consecutive N, ≤ 9 N/nurse, incompatible-pair separation on M/A). They are never honoured
at the expense of a hard rule.

### Night Week Preferences (best-effort)
- Each nurse can prefer specific weeks (W1–W4) for their N-blocks
- Algorithm attempts to honour preferences via block swapping, applied **only when the swap is
  adjacency-safe** and violates no hard rule
- **Acceptance bar:** best-effort — an unmet preference is acceptable and not a defect. Success is
  measured as "preference honoured whenever a safe swap existed," not "every preference met."

### Fixed Night Weeks (hard guarantee)
- Specific nurses are assigned **mandatory** N-blocks in specific weeks (`RULES.fixedNightWeeks`)
- Example: VIJAYA must have N in weeks 1 & 3
- **Acceptance bar:** hard — every configured fixed-week assignment **must** appear in the generated
  rota. A missing fixed-week N-block is a defect, not an acceptable best-effort miss.

### Preferred Night Pairs (best-effort)
- When 2 nurses are on N together, prefer configured pairings (`RULES.preferredNightPairs`)
- **Acceptance bar:** best-effort — pairing is honoured only when it doesn't conflict with block
  structure or fixed-week guarantees. An unmet preferred pair is acceptable and not a defect.

---

## HouseKeeping — Shift Rules

### Shift Coverage
- **1 staff per shift per day** (M, A, N)
- 3 staff rotate through shifts in **long blocks** — the month is split into **3 phases**, one
  shift each (M, then A, then N)
- **Block length vs month length:** the month is divided into 3 phases as evenly as possible, so
  each phase is **~9–11 days** depending on month length (28 → ~9–10, 31 → ~10–11). The nominal
  "10–11 day" figure describes a 31-day month; shorter months have proportionally shorter phases.
  Any remainder days are absorbed into the phases (the last phase takes the leftover), and the
  M → A → N rotation guarantee holds regardless of month length — every day still has exactly
  one M, one A, and one N staffed.
- Rotation order: M → A → N → M (cycles)

### Day Off (O)
- Exactly **4 offs per staff per month**
- Max **1 staff off per day**
- Spacing: **5–8 days apart** (with fallback to 4 if needed)
- Offs only from **M or A shift days** (NEVER from N)

### Coverage When Off
- When someone is off, the **M-person (or A-person)** covers both as **MA**
- MA target: **~4 per staff** (balanced evenly)
- Priority: Night always covered first, then Afternoon, then Morning

### Monthly Rotation Fairness
- `monthOffset = month % 3` ensures over 3 months each staff cycles through all starting positions

### Rule scope vs Nurses (intentional differences)

HouseKeeping deliberately has a **narrower rule set** than Nurses. The following Nurses rules do
**not** apply to HouseKeeping, by design (there are no corresponding `RULES.housekeeping` keys):

- **Fixed Night Weeks** — Nurses-only. HK has no mandatory-week guarantee.
- **Preferred Night Pairs** — Nurses-only. HK rotates one staff per shift, so N-pairing is N/A.
- **Incompatible Pairs** — Nurses-only; `RULES.housekeeping.incompatiblePairs` is intentionally
  empty. With only 3 staff each on a different shift per phase, same-shift conflicts don't arise.

**Night preferences:** HouseKeeping staff records do carry a `nightPref` field, and Phase 1 makes a
**best-effort** attempt to honour it by swapping staff phase positions before assignment (subordinate
to the M → A → N rotation guarantee). This is the only preference mechanism HK supports; an unmet
HK night preference is acceptable, not a defect.

---

## Daily Coverage Targets

### Nurses (typical day with 1 off)
| Shift | Count |
|-------|-------|
| M | 2 |
| A | 2 |
| N | 2 |
| O | 1 |
| G | 1 (JAYA) |
| **Total** | **8** |

If no one is off (all 7 working): extra nurse assigned to M or A (making it 3M+2A+2N or 2M+3A+2N).

### HouseKeeping (typical day with 1 off)
| Shift | Count |
|-------|-------|
| MA | 1 (covers M+A) |
| N | 1 |
| O | 1 |
| G | 1 (GITA) |

---

## UI/UX Requirements

### Layout
- Single-page app, max-width 1400px, responsive
- Header: app title + org name (editable) + month title + controls
- Second row: Tabs (Nurses/HouseKeeping) left, Legend centre, Staff Setup + Export PDF right
- Main content: rota table + shift count summary table

### Rota Table
- Rows = staff, Columns = days of month
- Diagonal corner cell (Date top-right, Name bottom-left)
- Colour-coded shift cells (see Shift Types table above)
- Sunday columns: bold red date/day headers
- Click any cell to edit via inline floating popup (not a modal)
- Coverage indicators in day headers (green/yellow/red)
- Fully-staffed day: green asterisk (*) clickable to add off

### Shift Count Summary Table
- Columns: G | M | MA | A | AN | N | O | PL | Total
- Header cells clickable: highlights all cells of that shift type in rota
- Name cells clickable: highlights that nurse's full row
- Count cells clickable: highlights specific shift cells for that nurse
- Multi-select supported (accumulates highlights)
- Click same item or outside to clear

### Editing
- Click cell → inline popup at cell location with shift options
- Validation alerts on manual edit (coverage, incompatible pairs, max off)
- Save button appears on unsaved changes
- Undo stack (20 levels)
  - **Manual mode:** the same 20-level stack applies — `commitManualCell` pushes one undo entry
    per committed cell. Because spreadsheet-style entry can commit cells rapidly, the 20-level
    window can be consumed quickly during a bulk manual fill; only the most recent 20 cell commits
    are recoverable. This is accepted behaviour (bounded to prevent memory bloat), not a defect.
  - **Switching tabs clears the undo stack.** `switchTab` (Nurses ↔ HouseKeeping) resets undo
    history, because the two tabs are independent data sets — undo does not span tabs. Edits made
    before switching are already saved to their tab's localStorage; only the *undo* history is
    cleared. Accepted behaviour, not a defect.
- Manual edits preserved on Re-generate (stored separately)

### Generate / Re-generate
- "Generate" on first use, "Re-generate" after (changes button text/colour)
- Re-generate preserves all manually edited cells
- Empty state shows "No staff configured" with button to Staff Setup
- Empty (staff present, no rota) state prompts to click **Generate** or **Manual**

### Manual mode (v4.1)
- **Manual** button (beside Generate) builds a blank, hand-editable rota for both tabs
- Confirms before clearing an existing rota (destructive)
- Cells are **spreadsheet-style** `contenteditable` — type the shift code directly (no popup/dropdown)
  - Accepts only valid codes (M, G, A, N, O, PL, MA, AN), **case-insensitive**; invalid entries
    flash red and revert; empty cells allowed
  - **G-shift row** is auto-prefilled but editable in Manual mode (fixed in auto mode)
  - Keyboard nav: Enter/Tab commit + advance (Shift = reverse); arrow keys move between cells
    (←/→ across days, ↑/↓ across staff); Escape reverts; focus stays put at grid edges
  - Validation warnings (coverage / incompatible pairs) are **non-blocking** (toast only)
- Shift Count table and day-header coverage/asterisk update **live** as cells are entered
- **Total** column = live sum of G+M+MA+A+AN+N+O+PL (equals days-in-month when a row is complete)

### Month/year picker (v4.1)
- Quick list = current month + next 6 months only; defaults to current month
- Last dropdown entry **"Custom date…"** opens a month/year dialog for any past/future month
- A custom selection appears in the dropdown tagged "(custom)"

### Export
- **PDF:** via browser print, A4 Landscape, 0.8cm margins
  - Filename: `ShiftPlanner <Tab> <Month> <Year>` — set via `document.title` manipulation before
    `window.print()`. This is a **best-effort suggestion only**: browsers use the document title as
    the default save-as name, but the actual filename is browser-dependent and the user can override
    it in the print/save dialog. Not a guaranteed output.
  - Print shows: header, org name, active tab, legend, rota + summary
  - Hidden: Generate/Save/Undo/Staff Setup/Export PDF buttons, inactive tab
  - Uniform 1.5px borders, 3px outer border
- **Staff Export:** JSON and CSV from Staff Setup modal

### Persistence
- All data in localStorage (survives refresh)
- Keys: `sp_orgName`, `sp_staff`, `sp_rota_<tab>_<year>_<month>`, `sp_edits_<tab>_<year>_<month>`
- Migration support: old 'maids' key → 'housekeeping'
  - This is a **one-directional, idempotent** migration that runs on load (guard:
    `if(!d.housekeeping && d.maids && d.maids.length)`), so it does nothing once a `housekeeping`
    key exists or no legacy `maids` data is present — i.e. a no-op in the normal case. It is safe
    to keep indefinitely. It may be retired only once we are confident no installed device still
    holds a pre-migration 'maids' key (low urgency; documented so it isn't removed prematurely and
    so its indefinite presence is intentional, not an oversight).

### PWA
- `manifest.json` with standalone display, indigo theme
- `sw.js` with cache-first strategy for offline support
- PNG icons (192, 512, maskable-512) for install-banner support, with SVG icons as fallbacks
- Service worker registration in HTML

### Accessibility (target vs current state)

Accessibility is part of the standing build-quality baseline, but on this app it is only
**partially delivered** — stated honestly here so the requirement matches reality and backs the
open audit task:

- **Done:** keyboard navigation through rota cells in **Manual mode** (arrow keys, Tab/Enter to
  commit and advance, Escape to revert).
- **Target / not yet complete:** ARIA labels/roles/states on interactive controls (buttons, tabs,
  editable cells), tooltips for icon-only buttons and shift cells (shift times), full keyboard
  operability in auto (click-to-edit) mode, colour not relied on alone to convey shift meaning,
  and a screen-reader pass. These are tracked by the **"Accessibility audit"** task in tasks.md
  (currently open, low priority).
- Treat the above as the accessibility acceptance list; the app should not be described as fully
  accessible until that audit task is complete.

---

## Generation failure handling

Validation alerts (coverage, incompatible pairs, max off) currently cover **manual edits only**;
generation is trusted to enforce rules internally. That leaves generation failure undefined, which
is a foreseeable path for a tool a non-technical user relies on monthly. Intended behaviour:

- **Don't fail silently.** If `generateRotaForMonth()` cannot satisfy a hard rule (e.g. can't place
  all 4 offs, can't meet 2M/2A/2N coverage, can't honour a Fixed Night Week), the app should still
  render the best rota it produced and **surface a clear, non-technical warning** (toast/banner)
  naming what couldn't be satisfied, rather than showing a blank or partial rota with no explanation.
- **No uncaught errors reach the user.** Generation should be wrapped so an unexpected exception
  shows a friendly message ("Couldn't generate a rota — please check staff setup") instead of a
  silent no-op. (Tracked as the "Error boundary" task in tasks.md — currently open.)
- **Current state:** this is a target, not yet fully implemented — the error boundary and generation
  warnings are open tasks. Documented here so the requirement backs the task.

## Non-Functional Requirements

- **No external dependencies** — pure vanilla JS, no build tools
- **Single-folder deployment** — all files in one directory
- **Offline-capable** — works without internet after first load
- **Non-technical user friendly** — simple UI, no configuration files exposed
- **Print-friendly** — landscape PDF matches screen layout
- **GitHub Pages hosted** — static file deployment
- **Configurable rules** — all constraints in separate `rules.js` for easy modification

---

## References

- Rules configuration: #[[file:rules.js]]
- App logic: #[[file:app.js]]
- UI/CSS: #[[file:ShiftPlanner.html]]
