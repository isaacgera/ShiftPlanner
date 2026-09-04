# ShiftPlanner — Design

## Architecture

```
ShiftPlanner/
├── ShiftPlanner.html    ← Single-page UI (HTML + embedded CSS)
├── rules.js             ← Configurable shift rules (RULES object)
├── app.js               ← All application logic (IIFE, exposes SP namespace)
├── sw.js                ← Service worker (cache-first, offline)
├── manifest.json        ← PWA manifest
├── icons/               ← PNG app icons (192, 512, maskable-512) + SVG (192, 512, maskable) fallbacks; `generate-png-icons.html` generator
├── LICENSE              ← MIT (Copyright (c) 2026 Isaac A. Gera)
├── UserGuide.html       ← User documentation
├── session-log.md       ← Development history
├── prototypes/          ← Sandbox copies for iterating (e.g. ShiftPlanner-prototype.html); not shipped
└── ShiftPlanner-Staff.json/csv  ← Staff backup files
```

> **File-name casing note:** the on-disk doc files are `UserGuide.html` and `session-log.md` (as
> listed above), which differ from the wider app-family convention of `userguide.html` /
> `SESSION-LOG.md`. The names here are the actual shipped filenames — referenced by the SW precache
> and in-app links — so the tree matches disk deliberately. Left as-is on this deployed app to avoid
> churning referenced filenames; noted here so the casing reads as known, not an oversight.

### Design Principles
- **Single IIFE** — all logic in one `(function(){'use strict'; ... })()` block, exposed via `window.SP`
- **No build step** — files loaded via `<script>` tags directly
- **Separation of concerns** — rules in `rules.js`, logic in `app.js`, presentation in `ShiftPlanner.html`
- **Stateless rendering** — `render()` reads from localStorage each time, no in-memory state except `currentTab/Month/Year`

---

## Theme System (Light / Dark) — v4.2.0

**Token-based theming.** All themeable colours are CSS custom properties defined on `:root`
(light values = the original palette, so light mode is visually unchanged). A single
`[data-theme="dark"]` block overrides those tokens with dark, contrast-checked values. Structure
and layout are identical between themes — only token *values* change.

- **Token groups:** core (`--primary`, `--primary-accent`, `--accent`, `--bg`, `--surface`,
  `--surface-alt`, `--total-bg`, `--text`, `--text-light`, `--muted`, `--border`); shift cells
  (`--sh-{M,G,A,N,O,PL,MA,AN}-bg`/`-fg`); coverage (`--cov-ok`/`-warn`/`-danger`/`-ok-fg`);
  selection (`--sel-bg`); manual hint bar (`--hint-bg`/`-border`/`-fg`); Staff-Setup
  (`--staff-active-bg`/`-border`, `--staff-inactive-bg`/`-border`, `--pair-chip-bg`,
  `--danger-heading`).
- **`--primary` split:** `--primary` is the interactive *fill* (white text on it), `--primary-accent`
  is primary-as-*text/border* on surfaces — split so both pass AA in dark (fill stays `#4f46e5`;
  accent lightens to `#a5b4fc`).
- **JS-set colours tokenised:** coverage backgrounds + the fully-staffed asterisk (written inline by
  `render()` and `refreshSummaryAndCoverage()`) use `var(--cov-*)` / `var(--cov-ok-fg)` so they
  recolour with the theme.

**Control flow.**
- `data-theme` lives on `<html>` (`documentElement`).
- **Inline `<head>` script (flash-of-light guard):** before the body paints, reads `sp_theme`
  (else `prefers-color-scheme`) and sets `data-theme` + the `theme-color` meta.
- **`app.js` theme functions:** `systemPrefersDark()`, `loadTheme()` (reads `sp_theme`, falls back to
  OS pref), `applyTheme(theme)` (sets `data-theme`, updates `theme-color` meta `#0f141b`/`#4f46e5`,
  syncs the toggle button's icon + `aria-pressed`/label), `setTheme(theme)` (persist + apply),
  `toggleTheme()` (flip + toast). `applyTheme(loadTheme())` runs at script load. Exposed as
  `SP.toggleTheme` / `SP.setTheme`.
- **Print:** `@media print` resets both `:root` and `[data-theme="dark"]` tokens to light values —
  print/PDF is always light. Motion transitions gated behind `prefers-reduced-motion`.

---

## Data Model

### State Object (in-memory)
```javascript
var state = {
  currentTab: 'nurses',        // 'nurses' | 'housekeeping'
  currentMonth: 7,             // 0-indexed (0=Jan, 7=Aug)
  currentYear: 2026
};
```

### Staff Data Structure
```javascript
{
  nurses: [
    { name: 'SAROJA', role: 'nurse', active: true, nightPref: [] },
    { name: 'VIJAYA', role: 'nurse', active: true, nightPref: [1, 3] },
    { name: 'JAYA', role: 'g-shift', active: true }
  ],
  housekeeping: [
    { name: 'MANJULA', role: 'housekeeping', active: true, nightPref: [] },
    { name: 'GITA', role: 'g-shift', active: true }
  ],
  incompatiblePairs: [['SUVARNA', 'PUNNAMMA'], ['VIJAYA', 'SHAILAJA']]
}
```

### Rota Data Structure
```javascript
// Object keyed by staff name, value is array of shift codes (index = day-1)
{
  'SAROJA': ['N','N','N','N','N','M','M','A','A','M','M','O','A','A','M',...],
  'VASANTHA': ['M','M','A','A','O','N','N','N','N','A','M','M','A','A','M',...],
  // ... one entry per active staff member, array length = days in month
}
```

### Edits Data Structure
```javascript
// Object keyed by staff name, value is array of day indices that were manually edited
{
  'SAROJA': [4, 15],    // days 5 and 16 were manually edited
  'VASANTHA': [0, 22]
}
```

---

## localStorage Schema

| Key | Type | Description |
|-----|------|-------------|
| `sp_orgName` | string | Organisation/institution name |
| `sp_staff` | JSON | Staff data (nurses, housekeeping, incompatiblePairs) |
| `sp_rota_nurses_<year>_<month>` | JSON | Generated rota for nurses tab |
| `sp_rota_housekeeping_<year>_<month>` | JSON | Generated rota for housekeeping tab |
| `sp_edits_nurses_<year>_<month>` | JSON | Manual edit tracking for nurses |
| `sp_edits_housekeeping_<year>_<month>` | JSON | Manual edit tracking for housekeeping |

Month is 0-indexed (January = 0). Year is full 4-digit year.

---

## RULES Configuration Schema (`rules.js`)

All generation constraints live in a single `RULES` object in `rules.js`, kept separate from
`app.js` so a non-developer can tune the rota without touching application logic (a stated design
goal). The table below catalogues the keys the spec and algorithm reference, with their shipped
defaults. Nurses config is top-level; HouseKeeping config is namespaced under `RULES.housekeeping`.

### Nurses (top-level `RULES.*`)

| Key | Default | Meaning |
|-----|---------|---------|
| `night.nursesPerDay` | `2` | Nurses on Night every day (hard coverage target) |
| `night.blockLength` | `5` | Target continuous nights per block (4–5) |
| `night.maxConsecutive` | `5` | Hard max consecutive nights per nurse |
| `night.targetPerNurse` | `[8,10]` | Acceptable N spread per nurse/month (algorithm hard-caps writes at 9 — see requirements B1) |
| `night.recoveryShift` | `'M'` | Shift assigned immediately after a night block |
| `night.noOffDuringBlock` | `true` | No off day may fall inside a night block |
| `night.noStandalone` | `true` | N / AN must be part of a 4–5 day block |
| `morning.minPerDay` / `maxPerDay` | `2` / `3` | Min/max nurses on Morning per day |
| `morning.blockLength` | `[4,5]` | Continuous mornings per block |
| `morning.targetPerNurse` | `[8,10]` | Target M per nurse/month (capped at 9 in algorithm) |
| `morning.offCanBreakBlock` | `true` | An off may interrupt an M block |
| `afternoon.*` | same as morning | Afternoon mirrors the Morning keys |
| `combo.maMax` / `anMax` | `3` / `1` | Max MA / AN per nurse/month |
| `combo.useForCoverageOnly` | `true` | Combos only assigned to fill coverage gaps |
| `combo.preferMA` | `true` | Prefer MA over AN when filling gaps |
| `gShift.fixedNurse` | `'JAYA'` | Nurse permanently on G-shift |
| `gShift.offDay` | `0` | Day index the G-shift nurse is off (0 = Sunday) |
| `dayOff.targetPerNurse` | `[4,4]` | Exactly 4 offs per nurse/month (hard) |
| `dayOff.maxPerDay` | `1` | Max nurses off on any single day |
| `dayOff.spacing` | `[5,8]` | Preferred off spacing in days (fallback ≥4 — see requirements) |
| `dayOff.canBreakMA` | `true` | Off may interrupt M/A blocks (never N) |
| `plannedLeave.manualOnly` | `true` | PL is never auto-generated |
| `plannedLeave.countsAsOff` | `true` | PL counts toward off/coverage limits (additive to the 4 auto-offs) |
| `plannedLeave.lockedOnRegenerate` | `true` | PL cells preserved on Re-generate |
| `incompatiblePairs` | `[[SUVARNA,PUNNAMMA],[VIJAYA,SHAILAJA]]` | Pairs that cannot share the same M/A/N shift on a day (M/A enforced; N conflicts accepted) |
| `preferredNightPairs` | 5 configured pairs | Best-effort N pairings |
| `fixedNightWeeks` | `{VIJAYA:[1,3]}` | Hard-guarantee mandatory N weeks (1-indexed) |
| `general.allDaysMustBeCovered` | `true` | Every day must meet minimum coverage |
| `general.equalDistribution` | `true` | Aim for ±1–2 variance across nurses |
| `general.manualEditsLocked` | `true` | Manual edits preserved on Re-generate |

### HouseKeeping (`RULES.housekeeping.*`)

| Key | Default | Meaning |
|-----|---------|---------|
| `gShift.offDay` | `0` | Day the HK G-shift person is off (0 = Sunday) |
| `shifts.perDay` | `{M:1,A:1,N:1}` | One staff per shift per day |
| `shifts.blockLength` | `[10,11]` | Nominal block length (31-day month; shorter months scale down — see requirements) |
| `shifts.rotationOrder` | `['M','A','N']` | Phase rotation M → A → N → M |
| `shifts.targetPerStaff` | `[9,11]` | Target count of each shift type per staff/month |
| `dayOff.targetPerStaff` | `4` | Exactly 4 offs per staff/month |
| `dayOff.maxPerDay` | `1` | Max staff off per day |
| `dayOff.spacing` | `[5,8]` | Preferred off spacing (fallback ≥4) |
| `dayOff.allowedFrom` | `['M','A']` | Offs only from M/A days |
| `dayOff.noOffDuringN` | `true` | No off during a Night block |
| `coverage.onOff` | `'MA'` | Off-day cover: M-person does MA |
| `coverage.priority` | `['N','A','M']` | Coverage priority order |
| `incompatiblePairs` | `[]` | **Empty by design** — HK has no incompatible-pair rule |

> **Note — HouseKeeping rule scope:** `RULES.housekeeping` has **no** `fixedNightWeeks` and **no**
> `preferredNightPairs` keys, and its `incompatiblePairs` is intentionally empty. Those three rule
> types are **Nurses-only by design** (see requirements.md HouseKeeping section). HK night handling
> is limited to best-effort phase swaps for the `nightPref` field on staff records.

> **Supported staff counts:** The Nurses config assumes **7 rotating nurses** (7 N-blocks + `+3`
> pairing gap in Step 1) and HouseKeeping assumes **3 rotating staff** (3 phases). Other counts are
> untested — see requirements.md "Supported nurse count".

---

## Algorithm Design

### Nurses — `generateRotaForMonth()` (pipeline)

> **Note on step numbering:** the original design had 8 steps. **Step 6** (a standalone
> "max 5 consecutive nights" enforcement pass) and the old Step 8 (standalone-N cleanup) were
> removed in Session 5 because they destroyed valid pre-planned N-blocks — the max-5 cap is now
> enforced inline during Step 1 post-processing. The remaining step numbers (1–5, 7) are kept as-is
> so they still match the numbered references in `app.js` and the session log. There is
> intentionally no Step 6.

#### Step 1: N-Block Assignment (Pre-planned Schedule)

**Strategy:** Divide the month into 7 blocks of 4–5 days. Assign exactly 2 nurses to each block using a deterministic pairing formula.

```
Block count: 7
Block lengths: mix of 4 and 5 to cover 28–31 days
Pairing formula:
  n1 = (block + monthOffset) % numNurses
  n2 = (block + 3 + monthOffset) % numNurses
```

**Properties:**
- Each nurse appears exactly **2 times** in the schedule (2 blocks × 4–5 days = 8–10 N)
- Gap of 3 between a nurse's two appearances prevents adjacent-block conflicts
- `monthOffset = month % numNurses` rotates pairings monthly for fairness

**Night week preferences:** Block positions are swapped (if safe) to place preferred nurses in their preferred weeks. Adjacency validated before applying.

**Post-processing:** Cap at 9N per nurse. Enforce max 5 consecutive N (clear excess, filled by Step 2).

#### Step 2: M/A Assignment (Day-by-day balanced fill)

For each day, collect available nurses (not on N, not locked). Sort by deficit (`mCount - aCount`). Assign each nurse whichever shift they personally have fewer of, then enforce minimum 2M + 2A coverage by flipping the most imbalanced nurses.

Caps: no nurse exceeds 9M or 9A.

#### Step 3: Off Placement (Exactly 4 per nurse)

For each nurse, collect candidate days (M or A, not locked). Place 4 offs evenly spaced (target window **5–8 days apart**). Constraints:
- Max 1 nurse off per day (configurable via `RULES.dayOff.maxPerDay`)
- Never from N days
- Fallback: relaxed spacing (≥ 4 days) if the 5–8 window can't place all 4

#### Step 4: Coverage Check (Swap-first, MA last resort)

Scan each day. If M < 2, flip excess A nurses to M. If A < 2, flip excess M nurses to A. Only if swaps can't fix: assign MA to an existing M or A nurse.

#### Step 5: Incompatible Pair Separation

For each pair, scan each day. If both on same M or A shift, swap one with a nurse on a different (non-N, non-O, non-G) shift. N-block conflicts are accepted (never break N-blocks).

#### Step 7: Final Cap (M/A ≤ 9, overflow → MA)

Any nurse with >9 M or >9 A: convert evenly-spaced surplus days to MA.

---

### HouseKeeping — `generateRotaForMonth()` (4-phase pipeline)

#### Phase 1: Block Rotation Assignment

Divide month into 3 phases of ~10–11 days. Each staff gets a different shift per phase:
```
staff_i gets shift: hkShifts[(i + phase + monthOffset) % 3]
where hkShifts = ['M', 'A', 'N']
      monthOffset = month % 3
```

Night preferences honoured by swapping staff positions before assignment.

#### Phase 2: Off Placement (Exactly 4 per staff)

Collect M/A candidate days. Place offs evenly spaced (5–8 days apart). Track which staff would cover (get MA) for each potential off day. Prefer placing offs on days where the least-MA'd staff would cover — this balances MA burden.

Fallback: relaxed spacing (≥ 4) to guarantee all 4 offs placed.

#### Phase 3: Coverage Fix (MA assignment)

On any day where someone is off: M-person becomes MA (covers both M+A). If M-person is the one off, A-person becomes MA instead.

#### Phase 4: MA Rebalancing

Target: each staff gets exactly 4 MAs. If uneven, move offs between days to redistribute — find an off-day where over-MA'd staff covers, relocate it to a day where under-MA'd staff would cover. Spacing constraints respected.

---

## UI Architecture

### Rendering Pipeline
```
state change → render() → buildRotaTable() + buildSummaryTable()
                        → applyHighlight() if highlight active
                        → updateButtons()
```

### Event Flow (Shift Edit — auto mode)
```
click cell → editShift(name, dayIdx)
          → show inline popup at cell position
          → select shift → applyShift(name, dayIdx, shift)
                        → validate() → show warnings if any
                        → pushUndo() → save to localStorage → render()
```

### Manual Mode (v4.1)
```
Manual button → manualRota()
  → (confirm if a rota exists) → buildBlankRota() [G-shift auto-prefilled]
  → save + clear edits → manualMode=true → render()
render() [manualMode] → wireManualCells()
  → each shift cell: contenteditable, no onclick; G-row included; navigation handlers
Event flow (per cell):
  focus → select text
  type + Enter/Tab/Arrow/blur → commitManualCell(name, dayIdx, cell)
    → normalise (uppercase; '-' → blank) → validate code
        · empty → clear cell
        · invalid → flash red + revert + toast
        · valid → pushUndo + save + markEdit + paintCell
    → refreshSummaryAndCoverage()   // live counts + coverage, no full re-render
    → non-blocking validate() warning toast
  Enter/Tab/Arrows → focusManualCell(neighbour) via manualNeighbour(); edge = stay put
```

`refreshSummaryAndCoverage()` patches the day-header backgrounds + fully-staffed asterisk and the
Shift Count cells (including the **Total = live sum** column) in place, so the cursor is preserved
during entry. It is the mechanism behind live summary/coverage updates.

**Highlight persistence (v4.1 fix):** `render()` re-applies the active highlight after rebuilding,
and the document-level outside-click handler skips clearing when the click is inside `.rota-table`
or `#inline-popup` — so a Shift Count selection survives editing a cell.

**Month picker (v4.1):** `buildMonthSelect()` lists current + next 6 months and appends a
`__custom__` option; `changeMonth('__custom__')` opens `showCustomDate()` (month/year dialog →
`applyCustomDate()`). Out-of-list selections are shown tagged "(custom)".

### Highlight System
```javascript
var hlState = {
  names: [],    // array of highlighted staff names
  shifts: []   // array of highlighted shift types
};
```
- `hlName(name)` — toggle name in hlState.names
- `hlShift(name, shift)` — toggle specific shift for a nurse
- `hlAllShift(shift)` — toggle all cells of a shift type
- `applyHighlight()` — applies CSS classes: `.has-highlight`, `.hl-row`, `.hl-cell`, `.hl-partial`

### Tab System
- `switchTab(t)` — changes `state.currentTab`, clears undo stack, re-renders
- Tab data completely independent (separate localStorage keys, separate generation)

---

## Validation Logic

`validate(rota, name, dayIdx, shift, staff, tab)` returns array of error strings:
- Coverage check: M, A, N must meet target (2 for nurses, 1 for HK)
- N over-coverage: cannot exceed target on Night
- Off limit: max per day enforced
- Incompatible pairs: checks if edited shift creates a conflict

Validation runs on **manual edits only** (not during generation — algorithm enforces rules internally).

### Generation failure modes (design intent)

Because `validate()` only guards manual edits, generation needs its own failure story (see
requirements.md "Generation failure handling"). Design intent:

- **Graceful degradation:** each generation step aims to satisfy its hard rule; where it cannot
  (e.g. off-placement can't fit all 4 within any spacing, or coverage can't reach 2M/2A/2N for a
  given staff count), the step places the best it can and **flags** the shortfall rather than
  throwing or leaving the rota blank.
- **Surfaced, not silent:** shortfalls should reach the user as a toast/banner naming the
  unsatisfied rule. A rendered-but-imperfect rota is preferable to a silent gap.
- **Error boundary:** `generateRotaForMonth()` should be wrapped in try/catch so an unexpected
  exception yields a friendly message, not a silent no-op.
- **Status:** the error boundary and generation warnings are **open tasks** (tasks.md Technical
  Debt); this section records the intended behaviour so the code has a spec to build to.

### Manual-mode validation (v4.1)

Manual (spreadsheet) mode has its own two-layer validation in `commitManualCell`, separate from
the inline-popup edit path above:

1. **Code validation (blocking, per cell):** the typed value is normalised (uppercased; `-` → blank)
   and checked against the valid set (M, G, A, N, O, PL, MA, AN). Empty clears the cell; an invalid
   code **flashes the cell red, reverts it, and toasts** — it is never committed.
2. **Rule validation (non-blocking):** once a valid code is committed, `validate()` runs for
   coverage / incompatible-pair checks and surfaces any warnings as a **toast only** — it does not
   block the entry. This lets the user build a rota freely and see warnings without being stopped.

---

## PWA Design

### Service Worker (`sw.js`)
- Cache name with version for busting: `CACHE_NAME = 'shiftplanner-v<n>'`
- Cache-first strategy: serve from cache, fall back to network
- On install: pre-cache all app files
- On activate: delete old caches

### Manifest (`manifest.json`)
- `display: standalone`
- Theme: indigo (#6366f1)
- Icons: **PNG (192, 512, maskable-512) listed first, with SVG (192, 512, maskable) kept as scalable fallbacks** (Session 6)
- Chrome requires PNG for the install banner; the PNGs satisfy that. They are produced by
  `icons/generate-png-icons.html` (a zero-dependency canvas generator) since no raster tooling
  is available on this machine — run it and save the 3 PNGs into `icons/` before deploying, as the
  SW precache is all-or-nothing.

---

## Versioning & Release Ritual

The app carries a single source-of-truth version constant `APP_VERSION` in `app.js` (currently
`'4.1.0'`), following semantic versioning (major.minor.patch). Because ShiftPlanner is a shipped
PWA served from GitHub Pages, a version change must be propagated to the offline cache or returning
users keep the stale cached build. The three move together on every release:

| Artefact | Location | On release |
|----------|----------|------------|
| `APP_VERSION` | `app.js` | Bump per semver (patch/minor/major) |
| `CACHE_NAME` | `sw.js` (`shiftplanner-v<n>`) | Bump the `<n>` so the SW `activate` step purges old caches and re-precaches |
| Changelog | session-log.md (and in-app "What's New", planned) | Record what changed for the new version |

**Rule of thumb:** never ship an `APP_VERSION` bump without also bumping `CACHE_NAME` — otherwise
the service worker serves the previous cached assets and the update never reaches installed users.
Prototype iterations use an in-progress tag (e.g. `4.1.0-proto`) and do **not** bump the shipped
`APP_VERSION` or `CACHE_NAME` until the finalized work is ported back (see the prototype workflow).
The in-app "What's New" modal is currently an open task (tasks.md Deployment & Distribution).

---

## Print/PDF Design

- Triggered via `window.print()` (browser's native print dialog)
- CSS `@media print` rules handle layout:
  - A4 Landscape, 0.8cm margins
  - Hide interactive elements (buttons, inactive tab)
  - Uniform 1.5px borders on tables, 3px outer border
  - `print-color-adjust: exact` for shift cell backgrounds
  - Sticky positioning disabled (fixes border alignment)
- Filename suggestion set via document title manipulation

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Vanilla JS, no framework | Non-technical user's device, no build pipeline needed, works offline |
| Separate `rules.js` | Easy modification by non-dev users; doesn't require understanding app.js |
| localStorage (not server) | Offline-first, zero infrastructure, privacy (medical staff data) |
| IIFE with `window.SP` | Avoids global pollution while allowing `onclick` handlers in HTML |
| Pre-planned N-blocks | Guarantees equal N distribution without fragile day-by-day balancing |
| N-blocks never broken | Prevents the "short N-streak" problems that plagued earlier algorithms |
| Incompatible pairs only for M/A | Breaking N-blocks for incompatibility creates worse problems than allowing rare N-conflicts |
| 20-level undo stack | Sufficient for a month of edits; prevents memory bloat |

---

## References

- Rules configuration: #[[file:rules.js]]
- App logic: #[[file:app.js]]
- UI/CSS: #[[file:ShiftPlanner.html]]
