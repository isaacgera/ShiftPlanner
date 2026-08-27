# ShiftPlanner — Design

## Architecture

```
ShiftPlanner/
├── ShiftPlanner.html    ← Single-page UI (HTML + embedded CSS)
├── rules.js             ← Configurable shift rules (RULES object)
├── app.js               ← All application logic (IIFE, exposes SP namespace)
├── sw.js                ← Service worker (cache-first, offline)
├── manifest.json        ← PWA manifest
├── icons/               ← SVG app icons (192, 512, maskable)
├── UserGuide.html       ← User documentation
├── session-log.md       ← Development history
└── ShiftPlanner-Staff.json/csv  ← Staff backup files
```

### Design Principles
- **Single IIFE** — all logic in one `(function(){'use strict'; ... })()` block, exposed via `window.SP`
- **No build step** — files loaded via `<script>` tags directly
- **Separation of concerns** — rules in `rules.js`, logic in `app.js`, presentation in `ShiftPlanner.html`
- **Stateless rendering** — `render()` reads from localStorage each time, no in-memory state except `currentTab/Month/Year`

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

## Algorithm Design

### Nurses — `generateRotaForMonth()` (7-step pipeline)

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

For each nurse, collect candidate days (M or A, not locked). Place 4 offs evenly spaced (spacing ≥ 5 days). Constraints:
- Max 1 nurse off per day (configurable via `RULES.dayOff.maxPerDay`)
- Never from N days
- Fallback: relaxed spacing (≥ 4) if ideal spacing can't place all 4

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

### Event Flow (Shift Edit)
```
click cell → editShift(name, dayIdx)
          → show inline popup at cell position
          → select shift → applyShift(name, dayIdx, shift)
                        → validate() → show warnings if any
                        → pushUndo() → save to localStorage → render()
```

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
- Icons: SVG (192, 512, maskable)
- Note: Chrome requires PNG for install banner — SVG works for manifest but limits installability

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
