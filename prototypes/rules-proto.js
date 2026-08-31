// ============================================================
// ShiftPlanner — RULES CONFIGURATION
// Modify these rules to change how the shift rota is generated.
// After changing, refresh the page and click "Generate".
// ============================================================

var RULES = {

  // --- NIGHT SHIFT (N) ---
  night: {
    nursesPerDay: 2,        // Exactly 2 nurses on night every day
    blockLength: 5,         // Target continuous nights in a block (4-5)
    maxConsecutive: 5,      // HARD MAX: No nurse can have more than 5 nights in a row
    targetPerNurse: [8,10], // Each nurse gets 8-10 nights per month
    recoveryShift: 'M',     // After a night block, nurse gets M (recovery)
    noOffDuringBlock: true, // NO off day allowed during a night block
    noStandalone: true,     // N or AN cannot be standalone — must be part of a 4-5 day N-block
  },

  // --- MORNING SHIFT (M) ---
  morning: {
    minPerDay: 2,           // At least 2 nurses on morning
    maxPerDay: 3,           // Can be 3 if no one is off that day
    blockLength: [4,5],     // Continuous mornings in a block
    targetPerNurse: [8,10], // Each nurse gets 8-10 mornings per month
    offCanBreakBlock: true, // An off day CAN interrupt an M block
  },

  // --- AFTERNOON SHIFT (A) ---
  afternoon: {
    minPerDay: 2,           // At least 2 nurses on afternoon
    maxPerDay: 3,           // Can be 3 if no one is off that day
    blockLength: [4,5],     // Continuous afternoons in a block
    targetPerNurse: [8,10], // Each nurse gets 8-10 afternoons per month
    offCanBreakBlock: true, // An off day CAN interrupt an A block
  },

  // --- COMBO SHIFTS (MA / AN) ---
  combo: {
    maMax: 3,               // Preferably 2-3 MA shifts per nurse per month
    anMax: 1,               // Preferably avoid AN entirely
    useForCoverageOnly: true, // Only assign when no other option to cover shifts
    preferMA: true,         // Prefer MA over AN when filling coverage gaps
  },

  // --- G-SHIFT (General/10AM-6PM) ---
  gShift: {
    fixedNurse: 'JAYA',    // Name of the nurse assigned to G-shift
    offDay: 0,             // 0=Sunday. G-shift nurse is off on this day
  },

  // --- DAY OFF (O) ---
  dayOff: {
    targetPerNurse: [4,4],  // Each nurse MUST get exactly 4 offs per month
    maxPerDay: 1,           // Max 1 nurse off on any single day (avoids MA/AN combos)
    spacing: [5,8],         // Offs MUST be spread ~5-8 days apart
    canBreakMA: true,       // Off can interrupt M or A blocks (not N blocks)
  },

  // --- PLANNED LEAVE (PL) ---
  plannedLeave: {
    manualOnly: true,       // PL is only assigned manually (not auto-generated)
    countsAsOff: true,      // PL counts toward the off/coverage limits
    lockedOnRegenerate: true, // PL cells are preserved when Re-generating
  },

  // --- INCOMPATIBLE PAIRS ---
  // These pairs should NOT be on the SAME shift (M, A, or N) on the same day.
  incompatiblePairs: [
    ['SUVARNA', 'PUNNAMMA'],
    ['VIJAYA', 'SHAILAJA']
  ],

  // --- PREFERRED NIGHT PAIRS ---
  // When 2 nurses are on N together, prefer these pairings.
  preferredNightPairs: [
    ['VIJAYA', 'SUVARNA'],
    ['VIJAYA', 'SANDHYA'],
    ['VASANTHA', 'SHAILAJA'],
    ['SAROJA', 'SANDHYA'],
    ['SAROJA', 'SUVARNA']
  ],

  // --- FIXED NIGHT SCHEDULES ---
  // Nurses with fixed N-block placement (week numbers, 1-indexed).
  fixedNightWeeks: {
    'VIJAYA': [1, 3]  // Vijaya MUST have N during week 1 (days 1-7) and week 3 (days 15-21)
  },

  // --- GENERAL ---
  general: {
    allDaysMustBeCovered: true,  // Every day must have all shifts covered (2M+2A+2N minimum)
    equalDistribution: true,     // All nurses must get approximately equal shift counts (max ±1-2 variance)
    manualEditsLocked: true,     // Manually edited cells are preserved on Re-generate
  },

  // ============================================================
  // HOUSEKEEPING RULES CONFIGURATION
  // Separate rules from Nurses — different coverage logic.
  // 3 staff rotate through M, A, N in long blocks (~10-11 days).
  // All 3 shifts must be covered every day. Off only from M/A shift.
  // When someone is off, M-person covers MA (Morning + Afternoon).
  // Staff names are configured via Staff Setup (not hardcoded here).
  // ============================================================
  housekeeping: {
    gShift: {
      offDay: 0              // 0=Sunday. G-shift person is off on Sundays.
    },
    shifts: {
      perDay: { M: 1, A: 1, N: 1 },  // 1 staff per shift per day
      blockLength: [10, 11],          // Each staff stays on the same shift for 10-11 consecutive days
      rotationOrder: ['M', 'A', 'N'], // After M block → A block → N block → M block...
      targetPerStaff: [9, 11]         // Each staff gets ~9-11 of each shift type per month
    },
    dayOff: {
      targetPerStaff: 4,       // Each staff MUST get exactly 4 offs per month
      maxPerDay: 1,            // Max 1 staff off per day (only 3 staff)
      spacing: [5, 8],         // Offs spaced 5-8 days apart
      allowedFrom: ['M','A'],  // Offs can be taken from M or A shift days (NEVER from N)
      noOffDuringN: true       // HARD RULE: No off during Night block
    },
    coverage: {
      onOff: 'MA',             // When someone is off, M-person does MA (covers Morning + Afternoon)
      priority: ['N', 'A', 'M'] // Coverage priority: Night always covered, then Afternoon, then Morning
    },
    incompatiblePairs: []      // No incompatible pairs for housekeeping
  }
};
