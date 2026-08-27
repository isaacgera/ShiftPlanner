# ShiftPlanner — Requirements

## Overview

ShiftPlanner is a shift rota generator for healthcare institutions (default: Sanctum Natural Birth Centre). It produces monthly shift schedules for two staff groups — **Nurses** and **HouseKeeping** — ensuring fair distribution, continuous shift blocks, and adequate daily coverage.

The app is a single-folder, zero-dependency vanilla JS web application designed for non-technical users. It runs entirely in the browser with localStorage persistence and offline PWA support.

---

## Staff Structure

### Nurses Tab
| Role | Count | Behaviour |
|------|-------|-----------|
| Nurse | 7 (configurable) | Rotates through M, A, N shifts with offs |
| G-Shift | 1 (JAYA) | Fixed G-shift every day, off on Sundays |

### HouseKeeping Tab
| Role | Count | Behaviour |
|------|-------|-----------|
| HouseKeeping | 3 (configurable) | Rotates through M, A, N in long blocks |
| G-Shift | 1 (GITA) | Fixed G-shift every day, off on Sundays |

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
- Target: **8–10 N per nurse per month** (capped at 9 in algorithm)
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

### G-Shift
- Fixed nurse (JAYA) every day
- Off on Sundays (day 0)

### Day Off (O)
- Exactly **4 offs per nurse per month**
- Max **1 nurse off per day** (configurable, currently 1)
- Spacing: **5–8 days apart** (with fallback to 4 if needed)
- Offs can interrupt M or A blocks but **NEVER N blocks**

### Planned Leave (PL)
- Manual assignment only (never auto-generated)
- Counts toward off/coverage limits
- Preserved on Re-generate (locked)

### Incompatible Pairs
- Configured pairs cannot be on the **same M or A shift** on the same day
- N-block conflicts are accepted (N-blocks are not broken for incompatibility)
- Default pairs: SUVARNA & PUNNAMMA, VIJAYA & SHAILAJA

### Night Week Preferences
- Each nurse can prefer specific weeks (W1–W4) for their N-blocks
- Algorithm attempts to honour preferences via block swapping (best-effort)

### Fixed Night Weeks
- Specific nurses can be assigned mandatory N-blocks in specific weeks
- Example: VIJAYA must have N in weeks 1 & 3

### Preferred Night Pairs
- When 2 nurses are on N together, prefer configured pairings (best-effort)

---

## HouseKeeping — Shift Rules

### Shift Coverage
- **1 staff per shift per day** (M, A, N)
- 3 staff rotate through shifts in **10–11 day blocks**
- Rotation order: M → A → N → M (cycles)

### Day Off (O)
- Exactly **4 offs per staff per month**
- Max **1 staff off per day**
- Spacing: **5–8 days apart**
- Offs only from **M or A shift days** (NEVER from N)

### Coverage When Off
- When someone is off, the **M-person (or A-person)** covers both as **MA**
- MA target: **~4 per staff** (balanced evenly)
- Priority: Night always covered first, then Afternoon, then Morning

### Monthly Rotation Fairness
- `monthOffset = month % 3` ensures over 3 months each staff cycles through all starting positions

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
- Manual edits preserved on Re-generate (stored separately)

### Generate / Re-generate
- "Generate" on first use, "Re-generate" after (changes button text/colour)
- Re-generate preserves all manually edited cells
- Empty state shows "No staff configured" with button to Staff Setup

### Export
- **PDF:** via browser print, A4 Landscape, 0.8cm margins
  - Filename: `ShiftPlanner <Tab> <Month> <Year>`
  - Print shows: header, org name, active tab, legend, rota + summary
  - Hidden: Generate/Save/Undo/Staff Setup/Export PDF buttons, inactive tab
  - Uniform 1.5px borders, 3px outer border
- **Staff Export:** JSON and CSV from Staff Setup modal

### Persistence
- All data in localStorage (survives refresh)
- Keys: `sp_orgName`, `sp_staff`, `sp_rota_<tab>_<year>_<month>`, `sp_edits_<tab>_<year>_<month>`
- Migration support: old 'maids' key → 'housekeeping'

### PWA
- `manifest.json` with standalone display, indigo theme
- `sw.js` with cache-first strategy for offline support
- SVG icons (192, 512, maskable)
- Service worker registration in HTML

---

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
