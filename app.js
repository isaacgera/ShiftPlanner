// ShiftPlanner - App Logic v4.0 (Aug 21, 2026)
(function(){'use strict';

var SHIFT_LABELS={M:'8AM-2PM',G:'10AM-6PM',A:'2PM-8PM',N:'8PM-8AM',O:'Day Off',PL:'Leave',MA:'M+A',AN:'A+N'};
var DAY_NAMES=['S','M','T','W','T','F','S'];
var MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];

var state={currentTab:'nurses',currentMonth:new Date().getMonth(),currentYear:new Date().getFullYear()};
var undoStack=[];
var hasUnsaved=false;

// --- Organisation Name ---
function loadOrgName(){return localStorage.getItem('sp_orgName')||''}
function saveOrgName(name){localStorage.setItem('sp_orgName',name)}
function renderOrgName(){
  var el=document.getElementById('org-name');
  var name=loadOrgName();
  if(el)el.textContent=name||'Click here to set organisation name';
  if(el&&!name)el.style.opacity='0.5';
  else if(el)el.style.opacity='1';
}
function editOrgName(){
  var current=loadOrgName();
  var newName=prompt('Organisation / Institution Name:',current);
  if(newName===null)return; // cancelled
  saveOrgName(newName.trim());
  renderOrgName();
  showToast('Organisation name updated');
}

function getDefaultStaff(){return{
  nurses:[
    {name:'SAROJA',role:'nurse',active:true,nightPref:[]},
    {name:'VASANTHA',role:'nurse',active:true,nightPref:[]},
    {name:'PUNNAMMA',role:'nurse',active:true,nightPref:[]},
    {name:'SUVARNA',role:'nurse',active:true,nightPref:[]},
    {name:'SANDHYA',role:'nurse',active:true,nightPref:[]},
    {name:'SHAILAJA',role:'nurse',active:true,nightPref:[]},
    {name:'VIJAYA',role:'nurse',active:true,nightPref:[1,3]},
    {name:'JAYA',role:'g-shift',active:true}
  ],
  housekeeping:[
    {name:'MANJULA',role:'housekeeping',active:true,nightPref:[]},
    {name:'ESHWARI',role:'housekeeping',active:true,nightPref:[]},
    {name:'MALLAMMA',role:'housekeeping',active:true,nightPref:[]},
    {name:'GITA',role:'g-shift',active:true}
  ],
  incompatiblePairs:[['SUVARNA','PUNNAMMA'],['VIJAYA','SHAILAJA']]
}}

function loadStaff(){
  var r=localStorage.getItem('sp_staff');
  if(r){
    var d=JSON.parse(r);
    // Migration: old 'maids' key → 'housekeeping'
    if(!d.housekeeping&&d.maids&&d.maids.length){d.housekeeping=d.maids;delete d.maids;saveStaff(d)}
    // Ensure housekeeping key exists (but never overwrite existing user data)
    if(!d.housekeeping)d.housekeeping=[];
    if(!d.nurses)d.nurses=[];
    if(!d.incompatiblePairs)d.incompatiblePairs=[];
    return d;
  }
  var d=getDefaultStaff();saveStaff(d);return d;
}
function saveStaff(d){localStorage.setItem('sp_staff',JSON.stringify(d))}
function loadRota(y,m,tab){return JSON.parse(localStorage.getItem('sp_rota_'+tab+'_'+y+'_'+m)||'null')}
function saveRota(y,m,tab,rota){localStorage.setItem('sp_rota_'+tab+'_'+y+'_'+m,JSON.stringify(rota))}
function loadEdits(y,m,tab){return JSON.parse(localStorage.getItem('sp_edits_'+tab+'_'+y+'_'+m)||'null')}
function saveEdits(y,m,tab,edits){localStorage.setItem('sp_edits_'+tab+'_'+y+'_'+m,JSON.stringify(edits))}
function markEdit(name,dayIdx){
  var edits=loadEdits(state.currentYear,state.currentMonth,state.currentTab)||{};
  if(!edits[name])edits[name]=[];
  if(edits[name].indexOf(dayIdx)===-1)edits[name].push(dayIdx);
  saveEdits(state.currentYear,state.currentMonth,state.currentTab,edits);
}
function getDays(y,m){return new Date(y,m+1,0).getDate()}
function getDow(y,m,d){return new Date(y,m,d).getDay()}

// ======= GENERATION - DETERMINISTIC SLOT-ROTATION TABLE =======
// 7 slots [N,N,M,M,A,A,O] rotate every ~4-5 days (one phase).
// Each nurse occupies a slot that advances by 1 each phase.
// GUARANTEES equal distribution. O-slot after A-slots = no off during N.

function generateRotaForMonth(y,m,tab,existingRota,edits){
  var staff=loadStaff(),team=staff[tab]||[];
  if(!team.length)return null;
  var days=getDays(y,m);
  var nurses=team.filter(function(s){return s.active&&(s.role==='nurse'||s.role==='housekeeping')});
  var gPerson=team.find(function(s){return s.role==='g-shift'&&s.active});
  var incomp=staff.incompatiblePairs||[];
  var nc=nurses.length;
  var rota={};
  team.forEach(function(s){if(s.active)rota[s.name]=new Array(days).fill('')});

  var locked={};
  if(existingRota && edits){
    team.forEach(function(s){
      if(!s.active)return;
      locked[s.name]=new Array(days).fill(false);
      var editedDays=edits[s.name]||[];
      if(existingRota[s.name]){
        for(var d=0;d<days;d++){
          if(editedDays.indexOf(d)!==-1){
            locked[s.name][d]=true;
            rota[s.name][d]=existingRota[s.name][d];
          }
        }
      }
    });
  }

  if(gPerson){for(var d=0;d<days;d++)rota[gPerson.name][d]=getDow(y,m,d+1)===0?'O':'G'}
  if(!nc)return rota;

  // --- HOUSEKEEPING: 3-staff rotation (1M+1A+1N per day, 10-11 day blocks) ---
  // Completely separate logic from nurses.
  // Pattern: each staff does ~10-11 days on same shift, then rotates M→A→N→M...
  // Offs: exactly 4 per staff, ONLY from M-shift days. When M-staff is off, A-staff does MA.
  if(tab==='housekeeping'&&nc<=3){
    var hkRules=RULES.housekeeping||{};
    var hkShifts=['M','A','N'];
    var hkBlockLen=hkRules.shifts&&hkRules.shifts.blockLength?hkRules.shifts.blockLength:[10,11];
    var hkTargetOffs=(hkRules.dayOff&&hkRules.dayOff.targetPerStaff)?hkRules.dayOff.targetPerStaff:4;
    var hkMaxOffPerDay=(hkRules.dayOff&&hkRules.dayOff.maxPerDay)?hkRules.dayOff.maxPerDay:1;
    var hkOffSpacing=(hkRules.dayOff&&hkRules.dayOff.spacing)?hkRules.dayOff.spacing:[5,8];

    // --- PHASE 1: Assign shifts in 10-11 day blocks ---
    // With 3 staff and 3 shifts, divide month into 3 phases of ~10-11 days each.
    // Staff 0: M(10-11) → A(10-11) → N(remaining)
    // Staff 1: A(10-11) → N(10-11) → M(remaining)
    // Staff 2: N(10-11) → A(10-11) → M(remaining) — staggered
    var numPhases=3; // 3 phases per month (each ~10-11 days)
    var basePLen=Math.floor(days/numPhases);
    var extraDays=days%numPhases;
    var phases=[];
    var pStart=0;
    for(var p=0;p<numPhases;p++){
      var pLen=basePLen+(p<extraDays?1:0);
      phases.push({start:pStart,len:pLen});
      pStart+=pLen;
    }

    // Assign: staff i gets shift (i+phase+monthOffset)%3 for each phase
    // monthOffset rotates each month so the same person doesn't always start on the same shift.
    // Over 3 months, each staff cycles through all starting positions.
    var monthOffset=m%nc; // m is 0-indexed month (Jan=0, Feb=1, etc.)

    // Apply night preferences: reorder nurses array so preferred staff get N in their preferred phase
    // For staff to get N in phase p: need (i+p+monthOffset)%3 === 2
    var hkNightPrefs=[];
    for(var i=0;i<nc;i++){
      var staffData=team.find(function(s){return s.name===nurses[i].name});
      hkNightPrefs.push((staffData&&staffData.nightPref)||[]);
    }
    // Try swapping staff positions to honor preferences
    for(var i=0;i<nc;i++){
      if(!hkNightPrefs[i].length)continue; // no preference
      var prefPhase=hkNightPrefs[i][0]-1; // convert 1-indexed to 0-indexed phase
      if(prefPhase<0||prefPhase>=numPhases)continue;
      // Check if nurse i already gets N in prefPhase
      var currentShiftInPref=(i+prefPhase+monthOffset)%3;
      if(currentShiftInPref===2)continue; // already on N in preferred phase ✓
      // Find which nurse index would get N in prefPhase: need (j+prefPhase+monthOffset)%3===2
      var targetIdx=(2-prefPhase-monthOffset%3+9)%3; // solve for j%3
      // Find a nurse at an index that gives N in prefPhase and swap with i (if they don't have a conflicting pref)
      for(var j=0;j<nc;j++){
        if(j===i)continue;
        if((j+prefPhase+monthOffset)%3!==2)continue; // j doesn't get N in prefPhase
        // Check j doesn't specifically prefer their current N-phase
        var jNPhase=-1;
        for(var p=0;p<numPhases;p++){if((j+p+monthOffset)%3===2){jNPhase=p+1;break}}
        if(hkNightPrefs[j].indexOf(jNPhase)>=0)continue; // j prefers their current phase, don't swap
        // Swap positions in nurses array
        var tmp=nurses[i];nurses[i]=nurses[j];nurses[j]=tmp;
        var tmpPref=hkNightPrefs[i];hkNightPrefs[i]=hkNightPrefs[j];hkNightPrefs[j]=tmpPref;
        break;
      }
    }

    for(var p=0;p<numPhases;p++){
      var ps=phases[p].start,pl=phases[p].len;
      for(var i=0;i<nc;i++){
        var shiftIdx=(i+p+monthOffset)%3;
        var shift=hkShifts[shiftIdx];
        for(var dd=0;dd<pl;dd++){
          var di=ps+dd;
          if(di>=days)break;
          if(locked[nurses[i].name]&&locked[nurses[i].name][di])continue;
          rota[nurses[i].name][di]=shift;
        }
      }
    }

    // --- PHASE 2: Place exactly 4 offs per staff, balanced so each staff covers exactly 4 MAs ---
    // Strategy: place offs such that MA burden is evenly distributed.
    // For each off, determine who would cover (get MA). Track counts and prefer days
    // where the under-burdened staff would cover.
    var numOffs=(typeof hkTargetOffs==='number')?hkTargetOffs:3;
    var maTracker=new Array(nc).fill(0); // how many MAs each staff will get

    for(var i=0;i<nc;i++){
      // Collect candidate off days with info about who would cover
      var candidates=[];
      for(var d=0;d<days;d++){
        if(locked[nurses[i].name]&&locked[nurses[i].name][d])continue;
        var s=rota[nurses[i].name][d];
        if(s!=='M'&&s!=='A')continue; // can only take off from M or A
        // Check no one else already off on this day
        var dayHasOff=false;
        for(var j=0;j<nc;j++){if(j!==i&&(rota[nurses[j].name][d]==='O'||rota[nurses[j].name][d]==='PL'))dayHasOff=true}
        if(dayHasOff)continue;
        // Determine who would cover (get MA) if this person takes off
        var coverIdx=-1;
        for(var j=0;j<nc;j++){
          if(j===i)continue;
          var js=rota[nurses[j].name][d];
          if(js==='M'||js==='A'){coverIdx=j;break} // M-person preferred, else A-person
        }
        candidates.push({day:d,coverIdx:coverIdx});
      }

      // Place offs evenly spaced, preferring days where the least-burdened staff covers
      var placedOffs=[];
      var spacing=Math.floor(candidates.length/numOffs);
      for(var slot=0;slot<numOffs;slot++){
        var idealIdx=Math.min(Math.floor(spacing*slot+spacing/2),candidates.length-1);
        var bestDay=-1,bestCand=-1;
        // Search outward from ideal position, prefer candidate where coverIdx has fewest MAs
        for(var offset=0;offset<=candidates.length;offset++){
          var tries=[idealIdx+offset,idealIdx-offset];
          for(var ti=0;ti<tries.length;ti++){
            var tryIdx=tries[ti];
            if(tryIdx<0||tryIdx>=candidates.length)continue;
            var cand=candidates[tryIdx];
            if(cand.used)continue;
            // Check spacing
            var tooClose=false;
            for(var oi=0;oi<placedOffs.length;oi++){if(Math.abs(cand.day-placedOffs[oi])<hkOffSpacing[0])tooClose=true}
            if(tooClose)continue;
            // Prefer candidate where cover person has fewer MAs
            if(bestDay<0||(cand.coverIdx>=0&&maTracker[cand.coverIdx]<maTracker[candidates[bestCand].coverIdx])){
              bestDay=cand.day;bestCand=tryIdx;
            }
            if(bestDay>=0&&offset>2)break; // found something close enough
          }
          if(bestDay>=0&&offset>2)break;
        }
        if(bestDay>=0&&bestCand>=0){
          candidates[bestCand].used=true;
          rota[nurses[i].name][bestDay]='O';
          placedOffs.push(bestDay);
          if(candidates[bestCand].coverIdx>=0)maTracker[candidates[bestCand].coverIdx]++;
        }
      }
      // Fallback: if fewer than numOffs placed, relax spacing to guarantee exactly 4
      if(placedOffs.length<numOffs){
        for(var ci=0;ci<candidates.length&&placedOffs.length<numOffs;ci++){
          var cand=candidates[ci];
          if(cand.used)continue;
          var d=cand.day;
          if(rota[nurses[i].name][d]==='O')continue;
          var tooClose=false;
          for(var oi=0;oi<placedOffs.length;oi++){if(Math.abs(d-placedOffs[oi])<4)tooClose=true}
          if(tooClose)continue;
          var dayHasOff2=false;
          for(var j=0;j<nc;j++){if(j!==i&&(rota[nurses[j].name][d]==='O'||rota[nurses[j].name][d]==='PL'))dayHasOff2=true}
          if(dayHasOff2)continue;
          cand.used=true;
          rota[nurses[i].name][d]='O';
          placedOffs.push(d);
          if(cand.coverIdx>=0)maTracker[cand.coverIdx]++;
        }
      }
    }

    // --- PHASE 3: Coverage fix — when someone is off, M-person covers MA ---
    // On any day where someone is off (from M or A), the M-shift person
    // covers both Morning and Afternoon as MA. If the M-person is the one off,
    // then the A-person covers MA instead.
    for(var d=0;d<days;d++){
      var offPerson=-1,mPerson=-1,aPerson=-1;
      for(var i=0;i<nc;i++){
        var s=rota[nurses[i].name][d];
        if(s==='O'||s==='PL')offPerson=i;
        else if(s==='M')mPerson=i;
        else if(s==='A')aPerson=i;
      }
      if(offPerson<0)continue; // no one off, all 3 shifts covered
      // Someone is off — upgrade M-person to MA (or A-person if M-person is off)
      if(mPerson>=0){
        if(!(locked[nurses[mPerson].name]&&locked[nurses[mPerson].name][d])){
          rota[nurses[mPerson].name][d]='MA';
        }
      } else if(aPerson>=0){
        if(!(locked[nurses[aPerson].name]&&locked[nurses[aPerson].name][d])){
          rota[nurses[aPerson].name][d]='MA';
        }
      }
    }

    // --- PHASE 4: Balance MA count — ensure each staff has exactly 4 MAs ---
    // Count current MA per staff. If uneven, swap offs between days to rebalance.
    var targetMA=(typeof hkTargetOffs==='number')?hkTargetOffs:4;
    var maCounts=new Array(nc).fill(0);
    for(var i=0;i<nc;i++){for(var d=0;d<days;d++){if(rota[nurses[i].name][d]==='MA')maCounts[i]++}}

    // Try to rebalance: move offs from days where over-MA'd staff covers to days where under-MA'd staff covers
    for(var attempts=0;attempts<20;attempts++){
      // Find who has too many and too few MAs
      var overIdx=-1,underIdx=-1;
      for(var i=0;i<nc;i++){
        if(maCounts[i]>targetMA&&overIdx<0)overIdx=i;
        if(maCounts[i]<targetMA&&underIdx<0)underIdx=i;
      }
      if(overIdx<0||underIdx<0)break; // balanced

      // Find an off-day where overIdx is covering (has MA) and try to move that off
      // to a day where underIdx would cover instead
      var swapped=false;
      for(var d=0;d<days&&!swapped;d++){
        if(rota[nurses[overIdx].name][d]!=='MA')continue; // overIdx must be the one doing MA on this day
        // Find who is off on this day
        var offPersonIdx=-1;
        for(var i=0;i<nc;i++){if(i!==overIdx&&(rota[nurses[i].name][d]==='O'))offPersonIdx=i}
        if(offPersonIdx<0)continue;
        if(locked[nurses[offPersonIdx].name]&&locked[nurses[offPersonIdx].name][d])continue;

        // Find a candidate day to move this off to, where underIdx is on M or A (would get the MA)
        for(var d2=0;d2<days&&!swapped;d2++){
          if(d2===d)continue;
          if(locked[nurses[offPersonIdx].name]&&locked[nurses[offPersonIdx].name][d2])continue;
          var offPersonShift=rota[nurses[offPersonIdx].name][d2];
          if(offPersonShift!=='M'&&offPersonShift!=='A')continue; // can only take off from M/A
          if(offPersonShift==='O'||offPersonShift==='PL')continue;
          // Check underIdx is on M or A on d2 (would cover MA)
          var underShift=rota[nurses[underIdx].name][d2];
          if(underShift!=='M'&&underShift!=='A')continue;
          // Check no one else is already off on d2
          var d2HasOff=false;
          for(var j=0;j<nc;j++){if(rota[nurses[j].name][d2]==='O'||rota[nurses[j].name][d2]==='PL')d2HasOff=true}
          if(d2HasOff)continue;
          // Check spacing with other offs for offPerson
          var offPersonOffs=[];
          for(var dd=0;dd<days;dd++){if(dd!==d&&rota[nurses[offPersonIdx].name][dd]==='O')offPersonOffs.push(dd)}
          var tooClose=false;
          for(var oi=0;oi<offPersonOffs.length;oi++){if(Math.abs(d2-offPersonOffs[oi])<6)tooClose=true}
          if(tooClose)continue;

          // Do the swap: restore day d, set off on day d2
          rota[nurses[offPersonIdx].name][d]=rota[nurses[overIdx].name][d]==='MA'?
            (offPersonShift):'M'; // restore to what phase says (M or A)
          // Actually we need to figure out what offPerson's shift was on day d before it became O
          // Since phases assigned it, recalculate: find which phase day d is in
          var phaseShift='M';
          for(var pp=0;pp<numPhases;pp++){
            if(d>=phases[pp].start&&d<phases[pp].start+phases[pp].len){
              phaseShift=hkShifts[(offPersonIdx+pp+monthOffset)%3];break;
            }
          }
          rota[nurses[offPersonIdx].name][d]=phaseShift;
          // Remove MA from overIdx on day d — restore to phase shift
          var overPhaseShift='M';
          for(var pp=0;pp<numPhases;pp++){
            if(d>=phases[pp].start&&d<phases[pp].start+phases[pp].len){
              overPhaseShift=hkShifts[(overIdx+pp+monthOffset)%3];break;
            }
          }
          rota[nurses[overIdx].name][d]=overPhaseShift;

          // Set new off on d2
          rota[nurses[offPersonIdx].name][d2]='O';
          // Set MA on underIdx on d2
          rota[nurses[underIdx].name][d2]='MA';

          maCounts[overIdx]--;
          maCounts[underIdx]++;
          swapped=true;
        }
      }
      if(!swapped)break; // can't improve further
    }

    // Housekeeping: set G-shift person
    if(gPerson){for(var d=0;d<days;d++)rota[gPerson.name][d]=getDow(y,m,d+1)===0?'O':'G'}

    return rota;
  }
  // --- END HOUSEKEEPING ---

  // Slot pattern: designed for 7 nurses. Positions: N,M,A,N,M,A,O
  // =====================================================================
  // NURSES ALGORITHM — Clean rewrite v2
  // Requirements:
  //   - Daily coverage: 2N + 2M + 2A (7 nurses: 6 working + 1 off, or 7 working)
  //   - Each nurse: ~9N + 9M + 9A + 4O = 31 (proportionate)
  //   - N-blocks: 4-5 consecutive days, NEVER broken by O
  //   - Offs: exactly 4 per nurse, spaced ~7 days apart, only from M/A days
  //   - MA/AN: only if absolutely needed for coverage (avoid)
  //   - Max 2 nurses off per day
  // =====================================================================

  // --- STEP 1: Assign N-shifts — Pre-planned block schedule ---
  // Math: 7 blocks of 4-5 days cover 31 days. Each block has 2 nurses.
  // 7 blocks × 2 = 14 slots. 7 nurses × 2 appearances each = 14. Perfect fit.
  // Each nurse gets exactly 2 N-blocks of 4-5 days = 8-10 N-days total.

  var monthOffset=m%nc;

  // Get night preferences from staff data
  var nightPrefs=[];
  for(var i=0;i<nc;i++){
    var staffData=team.find(function(s){return s.name===nurses[i].name});
    nightPrefs.push((staffData&&staffData.nightPref)||[]);
  }

  function dayToWeek(day){if(day<7)return 1;if(day<14)return 2;if(day<21)return 3;return 4}

  // Build 7 blocks to cover the month (mix of 4 and 5 day blocks)
  var nBlocks=[];
  var remaining=days;
  var numBlocks=7;
  var d=0;
  for(var b=0;b<numBlocks;b++){
    var blocksLeft=numBlocks-b;
    var blockLen=Math.round(remaining/blocksLeft);
    if(blockLen<4)blockLen=4;
    if(blockLen>5)blockLen=5;
    // Ensure we don't overshoot
    if(d+blockLen>days)blockLen=days-d;
    nBlocks.push({start:d,len:blockLen});
    d+=blockLen;
    remaining=days-d;
  }
  // If any days remain (shouldn't with 7 blocks of 4-5 for 31 days), extend last block
  if(d<days)nBlocks[nBlocks.length-1].len+=days-d;

  // Assign 2 nurses to each block — each nurse appears exactly twice
  // Build a schedule of 14 slots (7 blocks × 2) ensuring each nurse index appears exactly 2 times
  // Use a round-robin pairing that rotates by monthOffset for monthly fairness
  var schedule=new Array(numBlocks);

  // Generate pairs — use a verified non-adjacent pattern.
  // For 7 blocks with 7 nurses, each nurse appears exactly 2 times,
  // and no nurse appears in consecutive blocks.
  // Pre-computed valid patterns (rotated by monthOffset for variety):
  // Pattern: slot1=[0,1,2,3,4,5,6], slot2=[3,4,5,6,0,1,2] — gap of 3 blocks between appearances
  // Nurse 0: blocks 0,4 (gap=4) ✓ | Nurse 1: blocks 1,5 (gap=4) ✓ | etc.
  for(var b=0;b<numBlocks;b++){
    var n1=(b+monthOffset)%nc;
    var n2=(b+3+monthOffset)%nc; // +3 offset ensures nurse's two blocks are 4 apart
    schedule[b]=[n1,n2];
  }

  // Verify no consecutive block conflicts (should be clean by construction, but safety check)
  // Note: the +3 pairing offset prevents a nurse landing in adjacent blocks.
  // Any residual over/under-allocation is corrected by the appearances-fix loop below.

  // Verify each nurse appears exactly 2 times (and fix if not)
  var appearances=new Array(nc).fill(0);
  for(var b=0;b<numBlocks;b++){appearances[schedule[b][0]]++;appearances[schedule[b][1]]++}

  // If any nurse has >2 or <2, swap to fix (rare edge case with certain nc/offset combos)
  for(var fix=0;fix<10;fix++){
    var overIdx=-1,underIdx=-1;
    for(var i=0;i<nc;i++){if(appearances[i]>2&&overIdx<0)overIdx=i;if(appearances[i]<2&&underIdx<0)underIdx=i}
    if(overIdx<0||underIdx<0)break;
    // Find a block where overIdx appears and swap with underIdx
    for(var b=0;b<numBlocks;b++){
      if(schedule[b][0]===overIdx&&schedule[b][1]!==underIdx){schedule[b][0]=underIdx;appearances[overIdx]--;appearances[underIdx]++;break}
      else if(schedule[b][1]===overIdx&&schedule[b][0]!==underIdx){schedule[b][1]=underIdx;appearances[overIdx]--;appearances[underIdx]++;break}
    }
  }

  // (Incompatible pairs for N-blocks are accepted — they're handled for M/A in Step 5)

  // Apply night week preferences: try to swap block positions so preferred nurses land in their preferred weeks
  // Only swap if it doesn't create adjacent-block conflicts
  for(var b=0;b<numBlocks;b++){
    var blockWeek=dayToWeek(nBlocks[b].start);
    var n1=schedule[b][0],n2=schedule[b][1];
    var n1Pref=nightPrefs[n1].indexOf(blockWeek)>=0;
    var n2Pref=nightPrefs[n2].indexOf(blockWeek)>=0;
    if(n1Pref||n2Pref)continue;

    for(var b2=b+1;b2<numBlocks;b2++){
      var b2Week=dayToWeek(nBlocks[b2].start);
      var m1=schedule[b2][0],m2=schedule[b2][1];
      var currentScore=(n1Pref?1:0)+(n2Pref?1:0)+(nightPrefs[m1].indexOf(b2Week)>=0?1:0)+(nightPrefs[m2].indexOf(b2Week)>=0?1:0);
      var swapScore=(nightPrefs[n1].indexOf(b2Week)>=0?1:0)+(nightPrefs[n2].indexOf(b2Week)>=0?1:0)+(nightPrefs[m1].indexOf(blockWeek)>=0?1:0)+(nightPrefs[m2].indexOf(blockWeek)>=0?1:0);
      if(swapScore>currentScore){
        // Check adjacency: would this swap put any nurse in consecutive blocks?
        var wouldConflict=false;
        var testSchedule=[];for(var tb=0;tb<numBlocks;tb++)testSchedule.push(schedule[tb].slice());
        testSchedule[b]=[m1,m2];testSchedule[b2]=[n1,n2];
        for(var tb=0;tb<numBlocks-1&&!wouldConflict;tb++){
          for(var ts=0;ts<2;ts++){if(testSchedule[tb+1].indexOf(testSchedule[tb][ts])>=0)wouldConflict=true}
        }
        if(!wouldConflict){
          schedule[b]=[m1,m2];schedule[b2]=[n1,n2];break;
        }
      }
    }
  }

  // Write N-blocks to rota (cap at 9N per nurse)
  var nWritten=new Array(nc).fill(0);
  for(var b=0;b<numBlocks;b++){
    var n1=schedule[b][0],n2=schedule[b][1];
    for(var dd=0;dd<nBlocks[b].len;dd++){
      var di=nBlocks[b].start+dd;
      if(di>=days)break;
      if(nWritten[n1]<9&&!(locked[nurses[n1].name]&&locked[nurses[n1].name][di])){rota[nurses[n1].name][di]='N';nWritten[n1]++}
      if(nWritten[n2]<9&&!(locked[nurses[n2].name]&&locked[nurses[n2].name][di])){rota[nurses[n2].name][di]='N';nWritten[n2]++}
    }
  }

  // Enforce max 5 consecutive N per nurse — split any longer streaks
  for(var i=0;i<nc;i++){
    var streak=0;
    for(var d=0;d<days;d++){
      if(rota[nurses[i].name][d]==='N'){
        streak++;
        if(streak>5&&!(locked[nurses[i].name]&&locked[nurses[i].name][d])){
          rota[nurses[i].name][d]=''; // clear — will be filled by Step 2 (M/A assignment)
        }
      } else {streak=0}
    }
  }

  // --- STEP 2: Assign M and A to remaining nurses (balanced) ---
  var mCount=new Array(nc).fill(0);
  var aCount=new Array(nc).fill(0);

  for(var d=0;d<days;d++){
    var available=[];
    for(var i=0;i<nc;i++){
      if(rota[nurses[i].name][d]==='N')continue;
      if(locked[nurses[i].name]&&locked[nurses[i].name][d]&&rota[nurses[i].name][d])continue;
      available.push(i);
    }
    // Sort: prioritize nurses who need M (fewest M relative to A)
    available.sort(function(a,b){return(mCount[a]-aCount[a])-(mCount[b]-aCount[b])});

    // Assign M and A: each available nurse gets whichever shift they personally need more.
    // Cap: no nurse should exceed 9 of either M or A.
    // Then enforce minimum 2M and 2A coverage.
    var totalM=0,totalA=0;
    for(var i=0;i<nc;i++){totalM+=mCount[i];totalA+=aCount[i]}

    // First pass: assign each nurse their preferred shift (the one they have fewer of), respecting cap of 9
    var dayAssign=[];
    for(var ai=0;ai<available.length;ai++){
      var idx=available[ai];
      if(mCount[idx]>=9){dayAssign.push({idx:idx,shift:'A'})}
      else if(aCount[idx]>=9){dayAssign.push({idx:idx,shift:'M'})}
      else if(mCount[idx]<=aCount[idx]){dayAssign.push({idx:idx,shift:'M'})}
      else{dayAssign.push({idx:idx,shift:'A'})}
    }

    // Check coverage: count M and A in this tentative assignment
    var tentM=0,tentA=0;
    for(var ai=0;ai<dayAssign.length;ai++){if(dayAssign[ai].shift==='M')tentM++;else tentA++}

    // Fix: if M<2, flip some A→M (pick nurses with most A already)
    while(tentM<2&&tentA>2){
      var bestFlip=-1,bestDiff=-999;
      for(var ai=0;ai<dayAssign.length;ai++){
        if(dayAssign[ai].shift==='A'){
          var idx=dayAssign[ai].idx;
          var diff=aCount[idx]-mCount[idx]; // higher = more A-heavy = better to flip
          if(diff>bestDiff){bestDiff=diff;bestFlip=ai}
        }
      }
      if(bestFlip<0)break;
      dayAssign[bestFlip].shift='M';tentM++;tentA--;
    }
    // Fix: if A<2, flip some M→A (pick nurses with most M already)
    while(tentA<2&&tentM>2){
      var bestFlip=-1,bestDiff=-999;
      for(var ai=0;ai<dayAssign.length;ai++){
        if(dayAssign[ai].shift==='M'){
          var idx=dayAssign[ai].idx;
          var diff=mCount[idx]-aCount[idx];
          if(diff>bestDiff){bestDiff=diff;bestFlip=ai}
        }
      }
      if(bestFlip<0)break;
      dayAssign[bestFlip].shift='A';tentA++;tentM--;
    }

    // Apply assignments
    for(var ai=0;ai<dayAssign.length;ai++){
      var idx=dayAssign[ai].idx;
      rota[nurses[idx].name][d]=dayAssign[ai].shift;
      if(dayAssign[ai].shift==='M')mCount[idx]++;else aCount[idx]++;
    }
  }

  // --- STEP 3: Place exactly 4 offs per nurse (only from M/A, never N) ---
  var targetOffs=4;
  var offSpacingMin=5;

  for(var i=0;i<nc;i++){
    var candidates=[];
    for(var d=0;d<days;d++){
      if(locked[nurses[i].name]&&locked[nurses[i].name][d])continue;
      var s=rota[nurses[i].name][d];
      if(s==='M'||s==='A')candidates.push(d);
    }

    var placedOffs=[];
    var candSpacing=Math.floor(candidates.length/targetOffs);
    for(var slot=0;slot<targetOffs;slot++){
      var idealIdx=Math.min(Math.floor(candSpacing*slot+candSpacing/2),candidates.length-1);
      var bestDay=-1;
      for(var offset=0;offset<=candidates.length;offset++){
        var tries=[idealIdx+offset,idealIdx-offset];
        for(var ti=0;ti<tries.length;ti++){
          var tryIdx=tries[ti];
          if(tryIdx<0||tryIdx>=candidates.length)continue;
          var d=candidates[tryIdx];
          var dayOffCt=0;
          for(var j=0;j<nc;j++){if(rota[nurses[j].name][d]==='O'||rota[nurses[j].name][d]==='PL')dayOffCt++}
          if(dayOffCt>=(RULES.dayOff.maxPerDay||2))continue;
          var tooClose=false;
          for(var oi=0;oi<placedOffs.length;oi++){if(Math.abs(d-placedOffs[oi])<offSpacingMin)tooClose=true}
          if(tooClose)continue;
          bestDay=d;break;
        }
        if(bestDay>=0)break;
      }
      if(bestDay>=0){rota[nurses[i].name][bestDay]='O';placedOffs.push(bestDay)}
    }
    // Fallback with relaxed spacing
    if(placedOffs.length<targetOffs){
      for(var ci=0;ci<candidates.length&&placedOffs.length<targetOffs;ci++){
        var d=candidates[ci];
        if(rota[nurses[i].name][d]==='O')continue;
        var dayOffCt=0;
        for(var j=0;j<nc;j++){if(rota[nurses[j].name][d]==='O'||rota[nurses[j].name][d]==='PL')dayOffCt++}
        if(dayOffCt>=(RULES.dayOff.maxPerDay||2))continue;
        var tooClose=false;
        for(var oi=0;oi<placedOffs.length;oi++){if(Math.abs(d-placedOffs[oi])<4)tooClose=true}
        if(tooClose)continue;
        rota[nurses[i].name][d]='O';placedOffs.push(d);
      }
    }
  }

  // --- STEP 3B: (moved to end — see STEP 7) ---

  // --- STEP 4: Coverage check (swap shifts first, MA only as absolute last resort) ---
  for(var d=0;d<days;d++){
    var cov={M:0,A:0,N:0};
    for(var i=0;i<nc;i++){
      var s=rota[nurses[i].name][d];
      if(s==='M')cov.M++;else if(s==='A')cov.A++;else if(s==='N')cov.N++;
    }
    // Fix by swapping excess shifts
    while(cov.M<2&&cov.A>2){
      var done=false;
      for(var i=0;i<nc&&!done;i++){if(locked[nurses[i].name]&&locked[nurses[i].name][d])continue;if(rota[nurses[i].name][d]==='A'){rota[nurses[i].name][d]='M';cov.M++;cov.A--;done=true}}
      if(!done)break;
    }
    while(cov.A<2&&cov.M>2){
      var done=false;
      for(var i=0;i<nc&&!done;i++){if(locked[nurses[i].name]&&locked[nurses[i].name][d])continue;if(rota[nurses[i].name][d]==='M'){rota[nurses[i].name][d]='A';cov.M--;cov.A++;done=true}}
      if(!done)break;
    }
    // Last resort: MA only if swaps couldn't fix
    if(cov.M<2){for(var i=0;i<nc;i++){if(locked[nurses[i].name]&&locked[nurses[i].name][d])continue;if(rota[nurses[i].name][d]==='A'){rota[nurses[i].name][d]='MA';cov.M++;break}}}
    if(cov.A<2){for(var i=0;i<nc;i++){if(locked[nurses[i].name]&&locked[nurses[i].name][d])continue;if(rota[nurses[i].name][d]==='M'){rota[nurses[i].name][d]='MA';cov.A++;break}}}
  }

  // --- STEP 5: Incompatible pairs (M/A only — never break N-blocks) ---
  incomp.forEach(function(pair){
    for(var d=0;d<days;d++){
      if(!rota[pair[0]]||!rota[pair[1]])return;
      var s1=rota[pair[0]][d],s2=rota[pair[1]][d];
      if(s1===s2&&(s1==='M'||s1==='A')){
        // Only swap for M/A conflicts — N conflicts are accepted (N-blocks are sacred)
        for(var i=0;i<nc;i++){
          var other=nurses[i].name;
          if(other===pair[0]||other===pair[1])continue;
          var os=rota[other][d];
          if(os===s1||os==='O'||os==='PL'||os==='G'||os==='N')continue;
          rota[pair[1]][d]=os;rota[other][d]=s2;break;
        }
      }
    }
  });

  // (Step 6 removed — N-blocks are pre-planned as max 5 days with gaps between, so streak never exceeds 5)

  // --- STEP 7: Final cap — no nurse exceeds 9 of M or A (convert overflow to MA) ---
  // Spread MA conversions across the month (not just at the end)
  for(var i=0;i<nc;i++){
    var myM=0,myA=0;
    for(var d=0;d<days;d++){var s=rota[nurses[i].name][d];if(s==='M')myM++;else if(s==='A')myA++}
    // If M>9, convert evenly spaced M days to MA
    if(myM>9){
      var excess=myM-9;
      var mDays=[];
      for(var d=0;d<days;d++){if(rota[nurses[i].name][d]==='M'&&!(locked[nurses[i].name]&&locked[nurses[i].name][d]))mDays.push(d)}
      var spacing=Math.floor(mDays.length/excess);
      for(var e=0;e<excess&&mDays.length>0;e++){
        var idx=Math.min(Math.floor(spacing*e+spacing/2),mDays.length-1);
        rota[nurses[i].name][mDays[idx]]='MA';
      }
    }
    // If A>9, convert evenly spaced A days to MA
    myA=0;for(var d=0;d<days;d++){if(rota[nurses[i].name][d]==='A')myA++}
    if(myA>9){
      var excess=myA-9;
      var aDays=[];
      for(var d=0;d<days;d++){if(rota[nurses[i].name][d]==='A'&&!(locked[nurses[i].name]&&locked[nurses[i].name][d]))aDays.push(d)}
      var spacing=Math.floor(aDays.length/excess);
      for(var e=0;e<excess&&aDays.length>0;e++){
        var idx=Math.min(Math.floor(spacing*e+spacing/2),aDays.length-1);
        rota[nurses[i].name][aDays[idx]]='MA';
      }
    }
  }

  // (Step 8 removed — N-blocks are pre-planned as 4-5 days and should not need cleanup)

  return rota;
}

// ======= VALIDATION =======
function validate(rota,name,dayIdx,shift,staff,tab){
  var team=(staff[tab]||[]).filter(function(s){return s.active&&(s.role==='nurse'||s.role==='housekeeping')});
  var errors=[],dayNum=dayIdx+1;
  var test=JSON.parse(JSON.stringify(rota));test[name][dayIdx]=shift;
  var cov={M:0,A:0,N:0};
  team.forEach(function(n){var s=test[n.name]?test[n.name][dayIdx]:'';
    if(s==='M')cov.M++;else if(s==='A')cov.A++;else if(s==='N')cov.N++;
    else if(s==='MA'){cov.M++;cov.A++}else if(s==='AN'){cov.A++;cov.N++}
  });
  var covTarget=(tab==='housekeeping')?1:2;
  if(cov.M<covTarget)errors.push('Day '+dayNum+': Morning has '+cov.M+' staff (need '+covTarget+')');
  if(cov.A<covTarget)errors.push('Day '+dayNum+': Afternoon has '+cov.A+' staff (need '+covTarget+')');
  if(cov.N<covTarget)errors.push('Day '+dayNum+': Night has '+cov.N+' staff (need '+covTarget+')');
  if(cov.N>covTarget)errors.push('Day '+dayNum+': Night has '+cov.N+' staff (max '+covTarget+' allowed)');
  if(shift==='O'||shift==='PL'){
    var offCt=0;team.forEach(function(n){var s=test[n.name]?test[n.name][dayIdx]:'';if(s==='O'||s==='PL')offCt++});
    if(offCt>(RULES.dayOff.maxPerDay||1))errors.push('Day '+dayNum+': '+offCt+' on Off/PL (max '+(RULES.dayOff.maxPerDay||1)+' allowed)');
  }
  var pairs=staff.incompatiblePairs||[];
  if(shift!=='O'&&shift!=='PL'){pairs.forEach(function(p){
    var partner=p[0]===name?p[1]:p[1]===name?p[0]:null;
    if(!partner||!test[partner])return;
    var ps=test[partner][dayIdx];
    var sBase=shift==='MA'?['M','A']:shift==='AN'?['A','N']:[shift];
    var pBase=ps==='MA'?['M','A']:ps==='AN'?['A','N']:[ps];
    if(sBase.some(function(b){return pBase.indexOf(b)!==-1}))errors.push('Day '+dayNum+': '+name+' & '+partner+' incompatible on same shift');
  })}
  return errors;
}

// ======= SAVE & UNDO =======
function pushUndo(){
  var rota=loadRota(state.currentYear,state.currentMonth,state.currentTab);
  if(rota){undoStack.push(JSON.stringify(rota));if(undoStack.length>20)undoStack.shift()}
  updateButtons();
}
function saveManual(){hasUnsaved=false;updateButtons();showToast('Changes saved')}
function undoLast(){
  if(!undoStack.length)return;
  var prev=JSON.parse(undoStack.pop());
  saveRota(state.currentYear,state.currentMonth,state.currentTab,prev);
  hasUnsaved=undoStack.length>0;updateButtons();render();showToast('Undone');
}
function updateButtons(){
  document.getElementById('btn-save').style.display=hasUnsaved?'':'none';
  document.getElementById('btn-undo').style.display=undoStack.length?'':'none';
  var btn=document.getElementById('btn-generate');
  var rota=loadRota(state.currentYear,state.currentMonth,state.currentTab);
  if(rota&&hasUnsaved){btn.textContent='Re-generate';btn.className='btn btn-warn'}
  else if(rota){btn.textContent='Re-generate';btn.className='btn btn-primary'}
  else{btn.textContent='Generate';btn.className='btn btn-primary'}
}
function showToast(msg){
  var el=document.createElement('div');el.textContent=msg;
  el.style.cssText='position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:.5rem 1.2rem;border-radius:6px;font-size:.85rem;z-index:3000;opacity:1;transition:opacity .5s';
  document.body.appendChild(el);setTimeout(function(){el.style.opacity='0'},1500);setTimeout(function(){el.remove()},2000);
}

// ======= RENDERING =======
function render(){
  var y=state.currentYear,m=state.currentMonth,tab=state.currentTab;
  var days=getDays(y,m),rota=loadRota(y,m,tab),staff=loadStaff();
  var team=(staff[tab]||[]).filter(function(s){return s.active});
  // Update month title in header
  var titleEl=document.getElementById('rota-month-title');
  if(titleEl)titleEl.textContent='ROTA FOR THE MONTH OF '+MONTH_NAMES[m].toUpperCase()+' '+y;
  var html='';
  if(!team.length){
    html+='<div style="text-align:center;padding:3rem;color:var(--text-light)"><p style="font-size:1.1rem;margin-bottom:.5rem">No staff configured</p><p>Click <b>Staff Setup</b> to add your team, then click <b>Generate</b>.</p><button class="btn btn-primary" style="margin-top:1rem" onclick="SP.showSetup()">Open Staff Setup</button></div>';
    document.getElementById('rota-content').innerHTML=html;updateTabs();updateButtons();return;
  }
  if(!rota){
    html+='<div style="text-align:center;padding:3rem;color:var(--text-light)"><p style="font-size:1.1rem;margin-bottom:.5rem">No rota generated yet</p><p>Click <b>Generate</b> to create a balanced schedule.</p></div>';
    document.getElementById('rota-content').innerHTML=html;updateTabs();updateButtons();return;
  }
  html+='<div class="rota-container"><table class="rota-table"><thead><tr><th class="corner-cell"><div class="corner-cell-inner"><span class="corner-label-date">Date</span><span class="corner-label-name">Name</span></div></th>';
  var nur=team.filter(function(s){return s.role==='nurse'||s.role==='housekeeping'});
  for(var d=1;d<=days;d++){
    var dow=getDow(y,m,d);
    var cov={M:0,A:0,N:0};
    nur.forEach(function(n){var s=rota[n.name]?rota[n.name][d-1]:'';if(s==='M')cov.M++;else if(s==='A')cov.A++;else if(s==='N')cov.N++;else if(s==='MA'){cov.M++;cov.A++}else if(s==='AN'){cov.A++;cov.N++}});
    var minCov=Math.min(cov.M,cov.A,cov.N);
    var covTarget=(tab==='housekeeping')?1:2;
    var covStyle='';
    if(minCov>=covTarget)covStyle='background:#dcfce7;';else if(minCov>=1)covStyle='background:#fef3c7;';else covStyle='background:#fee2e2;';
    // Check if day has no one off (fully staffed)
    var hasOff=false;
    nur.forEach(function(n){var s=rota[n.name]?rota[n.name][d-1]:'';if(s==='O'||s==='PL')hasOff=true});
    var fullyStaffed=(!hasOff && minCov>=covTarget);
    var dotHtml=fullyStaffed?'<span style="position:absolute;top:1px;right:2px;font-size:1rem;color:#166534;line-height:1;cursor:pointer" onclick="SP.showAddOff('+d+')" title="Fully staffed - click to add off">*</span>':'';
    html+='<th class="day-header'+(dow===0?' sun':'')+'" style="'+covStyle+'position:relative;" title="Day '+d+': M='+cov.M+' A='+cov.A+' N='+cov.N+(fullyStaffed?' | Fully staffed - click * to add off':'')+'">'+dotHtml+'<span class="day-name">'+DAY_NAMES[dow]+'</span>'+d+'</th>';
  }
  html+='</tr></thead><tbody>';
  team.forEach(function(p){
    html+='<tr data-nurse="'+p.name+'"><td class="name-cell">'+p.name+'</td>';
    for(var d=0;d<days;d++){var s=rota[p.name]?rota[p.name][d]||'-':'-';html+='<td class="shift-cell shift-'+s+'" data-nurse="'+p.name+'" data-shift="'+s+'" onclick="SP.editShift(\''+p.name+'\','+d+')" title="'+p.name+' Day '+(d+1)+'">'+s+'</td>'}
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  html+='<h3 style="font-size:.85rem;margin-bottom:.5rem;color:var(--accent)">Shift Count</h3><table class="summary-table" id="summary-tbl"><thead><tr><th class="count-cell" onclick="SP.hlAllNames()">Name</th><th class="sh-G count-cell" onclick="SP.hlAllShift(\'G\')">G</th><th class="sh-M count-cell" onclick="SP.hlAllShift(\'M\')">M</th><th class="sh-MA count-cell" onclick="SP.hlAllShift(\'MA\')">MA</th><th class="sh-A count-cell" onclick="SP.hlAllShift(\'A\')">A</th><th class="sh-AN count-cell" onclick="SP.hlAllShift(\'AN\')">AN</th><th class="sh-N count-cell" onclick="SP.hlAllShift(\'N\')">N</th><th class="sh-O count-cell" onclick="SP.hlAllShift(\'O\')">O</th><th class="sh-PL count-cell" onclick="SP.hlAllShift(\'PL\')">PL</th><th class="count-cell" onclick="SP.hlAllNames()">Total</th></tr></thead><tbody>';
  team.forEach(function(p){
    var c={M:0,G:0,A:0,N:0,MA:0,AN:0,O:0,PL:0};(rota[p.name]||[]).forEach(function(s){if(s==='MA'){c.MA++}else if(s==='AN'){c.AN++}else if(c.hasOwnProperty(s))c[s]++});
    html+='<tr><td class="name-cell" onclick="SP.hlName(\''+p.name+'\')">'+p.name+'</td>';
    html+='<td class="count-cell" onclick="SP.hlShift(\''+p.name+'\',\'G\')">'+c.G+'</td>';
    html+='<td class="count-cell" onclick="SP.hlShift(\''+p.name+'\',\'M\')">'+c.M+'</td>';
    html+='<td class="count-cell" onclick="SP.hlShift(\''+p.name+'\',\'MA\')">'+c.MA+'</td>';
    html+='<td class="count-cell" onclick="SP.hlShift(\''+p.name+'\',\'A\')">'+c.A+'</td>';
    html+='<td class="count-cell" onclick="SP.hlShift(\''+p.name+'\',\'AN\')">'+c.AN+'</td>';
    html+='<td class="count-cell" onclick="SP.hlShift(\''+p.name+'\',\'N\')">'+c.N+'</td>';
    html+='<td class="count-cell" onclick="SP.hlShift(\''+p.name+'\',\'O\')">'+c.O+'</td>';
    html+='<td class="count-cell" onclick="SP.hlShift(\''+p.name+'\',\'PL\')">'+c.PL+'</td>';
    html+='<td class="total-col count-cell" onclick="SP.hlName(\''+p.name+'\')">'+days+'</td></tr>';
  });
  html+='</tbody></table>';
  html+='<p style="font-size:.7rem;color:var(--text-light);margin-top:1rem;font-style:italic">NOTE: Shifts may change for coverage. Mutual swaps must be informed to the incharge.</p>';
  document.getElementById('rota-content').innerHTML=html;updateTabs();updateButtons();
}
function updateTabs(){
  document.getElementById('tab-nurses').classList.toggle('active',state.currentTab==='nurses');
  document.getElementById('tab-housekeeping').classList.toggle('active',state.currentTab==='housekeeping');
}

// ======= INTERACTIONS =======
function changeMonth(v){var p=v.split('-');state.currentYear=+p[0];state.currentMonth=+p[1];undoStack=[];hasUnsaved=false;render()}
function switchTab(t){state.currentTab=t;undoStack=[];hasUnsaved=false;render()}
function generateRota(){
  var existingRota=loadRota(state.currentYear,state.currentMonth,state.currentTab);
  var edits=loadEdits(state.currentYear,state.currentMonth,state.currentTab);
  if(!existingRota)edits=null;
  var r=generateRotaForMonth(state.currentYear,state.currentMonth,state.currentTab,existingRota,edits);
  if(r){
    undoStack=[];hasUnsaved=false;
    saveRota(state.currentYear,state.currentMonth,state.currentTab,r);
    render();
    showToast('Rota generated');
  } else {
    showToast('No staff configured — open Staff Setup first');
    updateButtons();
  }
}

function showAddOff(dayNum){
  // dayNum is 1-indexed. Show eligible nurses who can take off on this fully-staffed day.
  var di=dayNum-1;
  var rota=loadRota(state.currentYear,state.currentMonth,state.currentTab);if(!rota)return;
  var staff=loadStaff(),team=(staff[state.currentTab]||[]).filter(function(s){return s.active&&(s.role==='nurse'||s.role==='housekeeping')});
  var days=getDays(state.currentYear,state.currentMonth);
  var targetOffs=(state.currentTab==='housekeeping'&&RULES.housekeeping&&RULES.housekeeping.dayOff)?(typeof RULES.housekeeping.dayOff.targetPerStaff==='number'?RULES.housekeeping.dayOff.targetPerStaff:RULES.housekeeping.dayOff.targetPerStaff[1]||4):RULES.dayOff.targetPerNurse[1]||5;

  // Find eligible staff: on M or A (not N), preferably below off target
  // For housekeeping: only M-shift staff can take off
  var eligible=[];
  team.forEach(function(n){
    var s=rota[n.name]?rota[n.name][di]:'';
    if(state.currentTab==='housekeeping'){
      if(s!=='M')return; // housekeeping: off only from M shift
    } else {
      if(s!=='M'&&s!=='A')return; // nurses: off from M or A
    }
    var offCt=0;
    for(var d=0;d<days;d++){if(rota[n.name][d]==='O')offCt++}
    eligible.push({name:n.name,shift:s,offs:offCt,belowTarget:offCt<targetOffs});
  });

  // Sort: nurses below target first, then by fewest offs
  eligible.sort(function(a,b){if(a.belowTarget!==b.belowTarget)return a.belowTarget?-1:1;return a.offs-b.offs});

  var html='<h3>Add Off - Day '+dayNum+'</h3>';
  html+='<p style="font-size:.8rem;color:var(--text-light);margin-bottom:1rem">This day is fully staffed. Select a nurse to give an off:</p>';
  if(!eligible.length){
    html+='<p style="color:#dc2626">No eligible nurses (all on Night shift today)</p>';
  } else {
    html+='<div style="display:flex;flex-direction:column;gap:.4rem">';
    eligible.forEach(function(n){
      var badge=n.belowTarget?'<span style="background:#fef3c7;color:#92400e;font-size:.65rem;padding:1px 4px;border-radius:3px;margin-left:.3rem">needs off</span>':'';
      html+='<button class="btn" style="text-align:left;padding:.5rem .8rem" onclick="SP.applyAddOff(\''+n.name+'\','+di+')"><b>'+n.name+'</b> (currently '+n.shift+') — '+n.offs+' offs so far'+badge+'</button>';
    });
    html+='</div>';
  }
  html+='<div style="margin-top:1rem;text-align:right"><button class="btn" onclick="SP.closeModal()">Cancel</button></div>';
  showModal(html);
}

function applyAddOff(name,di){
  var rota=loadRota(state.currentYear,state.currentMonth,state.currentTab);if(!rota||!rota[name])return;
  pushUndo();
  rota[name][di]='O';
  saveRota(state.currentYear,state.currentMonth,state.currentTab,rota);
  markEdit(name,di);
  hasUnsaved=true;
  closeModal();
  render();
  showToast(name+' given off on Day '+(di+1));
}

function editShift(name,di){
  var rota=loadRota(state.currentYear,state.currentMonth,state.currentTab);if(!rota)return;
  var cur=(rota[name]&&rota[name][di])||'';
  // Remove any existing inline popup
  var old=document.getElementById('inline-popup');if(old)old.remove();
  // Find the clicked cell and position popup near it
  var table=document.querySelector('.rota-table');
  var rows=table.querySelectorAll('tbody tr');
  var targetCell=null;
  for(var r=0;r<rows.length;r++){
    if(rows[r].getAttribute('data-nurse')===name){
      targetCell=rows[r].children[di+1]; // +1 for name cell
      break;
    }
  }
  if(!targetCell)return;
  var rect=targetCell.getBoundingClientRect();
  var popup=document.createElement('div');
  popup.id='inline-popup';
  popup.className='inline-popup';
  // Position near the cell
  var top=rect.bottom+window.scrollY+2;
  var left=rect.left+window.scrollX-40;
  if(left+180>window.innerWidth)left=window.innerWidth-190;
  if(left<0)left=4;
  popup.style.top=top+'px';
  popup.style.left=left+'px';
  ['M','G','A','N','O','PL','MA','AN'].forEach(function(s){
    var btn=document.createElement('button');
    btn.className='ip-btn'+(s===cur?' sel':'');
    btn.textContent=s;
    btn.onclick=function(e){e.stopPropagation();SP.applyShift(name,di,s)};
    popup.appendChild(btn);
  });
  document.body.appendChild(popup);
  // Close popup on outside click
  setTimeout(function(){
    document.addEventListener('click',function handler(e){
      if(!popup.contains(e.target)){popup.remove();document.removeEventListener('click',handler)}
    });
  },10);
}

function applyShift(name,di,shift){
  var rota=loadRota(state.currentYear,state.currentMonth,state.currentTab);if(!rota||!rota[name])return;
  var staff=loadStaff();var errors=validate(rota,name,di,shift,staff,state.currentTab);
  if(errors.length>0){
    closeModal();window._pending={name:name,di:di,shift:shift};
    document.getElementById('alert-box').innerHTML='<h4 style="color:#d97706;margin-bottom:.5rem">Warning</h4><div style="text-align:left;font-size:.8rem;color:#555;margin-bottom:1rem;white-space:pre-line;line-height:1.6">'+errors.join('\n')+'</div><div style="display:flex;gap:.5rem;justify-content:center"><button class="btn" style="background:#dc2626;color:#fff;border-color:#dc2626" onclick="SP.confirmShift()">Apply Anyway</button><button class="btn" onclick="SP.closeAlert()">Cancel</button></div>';
    document.getElementById('alert-overlay').classList.add('show');return;
  }
  pushUndo();rota[name][di]=shift;saveRota(state.currentYear,state.currentMonth,state.currentTab,rota);markEdit(name,di);hasUnsaved=true;
  var popup=document.getElementById('inline-popup');if(popup)popup.remove();
  closeModal();render();
}

function confirmShift(){
  if(!window._pending)return;var p=window._pending;
  pushUndo();var rota=loadRota(state.currentYear,state.currentMonth,state.currentTab);
  if(rota&&rota[p.name]){rota[p.name][p.di]=p.shift;saveRota(state.currentYear,state.currentMonth,state.currentTab,rota);markEdit(p.name,p.di)}
  window._pending=null;hasUnsaved=true;closeAlert();render();
}

// ======= SETUP =======
function showSetup(){
  var staff=loadStaff(),tab=state.currentTab,team=staff[tab]||[];
  var html='<h3>Staff Setup - '+(tab==='nurses'?'Nurses':'HouseKeeping')+'</h3><div style="margin-bottom:1rem">';
  team.forEach(function(s,i){
    html+='<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem;padding:.4rem;border-radius:6px;background:'+(s.active?'#f0fdf4':'#fef2f2')+';border:1px solid '+(s.active?'#86efac':'#fca5a5')+'">';
    html+='<input type="checkbox" '+(s.active?'checked':'')+' onchange="SP.toggleStaff('+i+',this.checked)">';
    html+='<span id="staff-name-'+i+'" style="flex:1;font-weight:600;font-size:.85rem;cursor:pointer" onclick="SP.editName('+i+')" title="Click to rename">'+s.name+'</span>';
    // Night preference checkboxes (nurses: W1-W4, housekeeping: W1-W3 for 3 phases)
    if((tab==='nurses'&&s.role==='nurse')||(tab==='housekeeping'&&s.role==='housekeeping')){
      var np=s.nightPref||[];
      var maxWeeks=(tab==='housekeeping')?3:4;
      html+='<span style="font-size:.65rem;color:var(--text-light);margin-right:2px">N:</span>';
      for(var w=1;w<=maxWeeks;w++){
        var checked=np.indexOf(w)>=0?'checked':'';
        var label=(tab==='housekeeping')?'P'+w:'W'+w; // P for Phase in HK
        html+='<label style="font-size:.6rem;display:flex;align-items:center;gap:1px;cursor:pointer" title="Prefer Night in '+(tab==='housekeeping'?'Phase ':'Week ')+w+'"><input type="checkbox" '+checked+' onchange="SP.setNightPref('+i+','+w+',this.checked)" style="width:12px;height:12px">'+label+'</label>';
      }
    }
    html+='<select style="font-size:.75rem" onchange="SP.changeRole('+i+',this.value)"><option value="nurse"'+(s.role==='nurse'?' selected':'')+'>Nurse</option><option value="housekeeping"'+(s.role==='housekeeping'?' selected':'')+'>HouseKeeping</option><option value="g-shift"'+(s.role==='g-shift'?' selected':'')+'>G-Shift</option></select>';
    html+='<button class="btn" style="font-size:.65rem;padding:2px 5px" onclick="SP.editName('+i+')" title="Rename">✏️</button>';
    html+='<button class="btn" style="font-size:.7rem;padding:2px 6px" onclick="SP.removeStaff('+i+')">x</button></div>';
  });
  html+='</div><div style="display:flex;gap:.4rem;margin-bottom:1.5rem"><input type="text" id="new-name" placeholder="New staff name" style="flex:1;padding:.4rem;border:1px solid var(--border);border-radius:6px;font-size:.85rem"><button class="btn btn-primary" onclick="SP.addStaff()">Add</button></div>';
  html+='<h4 style="font-size:.85rem;color:#dc2626;margin-bottom:.3rem">Incompatible Pairs</h4><p style="font-size:.7rem;color:var(--text-light);margin-bottom:.5rem">Cannot be on same shift.</p>';
  (staff.incompatiblePairs||[]).forEach(function(p,i){html+='<div style="font-size:.8rem;margin-bottom:.3rem"><span style="background:#fee2e2;padding:2px 6px;border-radius:4px">'+p[0]+' & '+p[1]+'</span> <button class="btn" style="font-size:.6rem;padding:1px 4px" onclick="SP.removePair('+i+')">x</button></div>'});
  var names=team.filter(function(s){return s.role==='nurse'||s.role==='maid'}).map(function(s){return s.name});
  html+='<div style="display:flex;gap:.3rem;margin-top:.4rem"><select id="pa" style="font-size:.75rem"><option value="">Select</option>';
  names.forEach(function(n){html+='<option>'+n+'</option>'});
  html+='</select> & <select id="pb" style="font-size:.75rem"><option value="">Select</option>';
  names.forEach(function(n){html+='<option>'+n+'</option>'});
  html+='</select><button class="btn" style="font-size:.75rem" onclick="SP.addPair()">Add</button></div>';
  html+='<div style="margin-top:1.5rem;border-top:1px solid var(--border);padding-top:1rem"><h4 style="font-size:.85rem;color:var(--primary);margin-bottom:.5rem">Backup / Restore Staff Data</h4>';
  html+='<div style="display:flex;gap:.5rem;flex-wrap:wrap">';
  html+='<button class="btn" onclick="SP.exportStaff(\'json\')">Export JSON</button>';
  html+='<button class="btn" onclick="SP.exportStaff(\'csv\')">Export CSV</button>';
  html+='<button class="btn" onclick="document.getElementById(\'import-file\').click()">Import</button>';
  html+='<input type="file" id="import-file" accept=".json,.csv" style="display:none" onchange="SP.importStaff(this)">';
  html+='</div><p style="font-size:.65rem;color:var(--text-light);margin-top:.3rem">Export to backup staff list. Import to restore after cache clear.</p></div>';
  html+='<div style="margin-top:1rem;text-align:right"><button class="btn" onclick="SP.closeModal()">Close</button></div>';
  showModal(html);
}
function toggleStaff(i,v){var s=loadStaff();s[state.currentTab][i].active=v;saveStaff(s);showSetup()}
function changeRole(i,v){var s=loadStaff();s[state.currentTab][i].role=v;saveStaff(s);showSetup()}
function removeStaff(i){var s=loadStaff();s[state.currentTab].splice(i,1);saveStaff(s);showSetup()}
function setNightPref(i,week,checked){
  var s=loadStaff();
  var nurse=s[state.currentTab][i];
  if(!nurse.nightPref)nurse.nightPref=[];
  if(checked&&nurse.nightPref.indexOf(week)<0)nurse.nightPref.push(week);
  if(!checked){nurse.nightPref=nurse.nightPref.filter(function(w){return w!==week})}
  nurse.nightPref.sort();
  saveStaff(s);
}
function editName(i){
  var s=loadStaff();var old=s[state.currentTab][i].name;
  var newName=prompt('Rename staff member:',old);
  if(!newName||!newName.trim())return;
  newName=newName.trim().toUpperCase();
  if(newName===old)return;
  // Update staff list
  s[state.currentTab][i].name=newName;
  saveStaff(s);
  // Update existing rota data — rename the key
  var rota=loadRota(state.currentYear,state.currentMonth,state.currentTab);
  if(rota&&rota[old]){rota[newName]=rota[old];delete rota[old];saveRota(state.currentYear,state.currentMonth,state.currentTab,rota)}
  // Update edits
  var edits=loadEdits(state.currentYear,state.currentMonth,state.currentTab);
  if(edits&&edits[old]){edits[newName]=edits[old];delete edits[old];saveEdits(state.currentYear,state.currentMonth,state.currentTab,edits)}
  // Update incompatible pairs
  if(s.incompatiblePairs){s.incompatiblePairs.forEach(function(p){if(p[0]===old)p[0]=newName;if(p[1]===old)p[1]=newName});saveStaff(s)}
  showSetup();render();showToast(old+' renamed to '+newName);
}
function addStaff(){
  var el=document.getElementById('new-name');var n=el.value.trim().toUpperCase();
  if(!n)return;
  var s=loadStaff();
  // Check for duplicate name
  if(s[state.currentTab].some(function(st){return st.name===n})){showToast(n+' already exists');return}
  var defaultRole=state.currentTab==='housekeeping'?'housekeeping':'nurse';
  s[state.currentTab].push({name:n,role:defaultRole,active:true});
  saveStaff(s);
  // Auto-add to existing rota table (empty row so they appear in the grid)
  var rota=loadRota(state.currentYear,state.currentMonth,state.currentTab);
  if(rota){
    var days=getDays(state.currentYear,state.currentMonth);
    rota[n]=new Array(days).fill('');
    saveRota(state.currentYear,state.currentMonth,state.currentTab,rota);
  }
  el.value='';showSetup();render();showToast(n+' added — click Generate to include in rota');
}
function addPair(){var a=document.getElementById('pa').value,b=document.getElementById('pb').value;if(!a||!b||a===b)return;var s=loadStaff();if(!s.incompatiblePairs)s.incompatiblePairs=[];if(!s.incompatiblePairs.some(function(p){return(p[0]===a&&p[1]===b)||(p[0]===b&&p[1]===a)})){s.incompatiblePairs.push([a,b]);saveStaff(s)}showSetup()}
function removePair(i){var s=loadStaff();s.incompatiblePairs.splice(i,1);saveStaff(s);showSetup()}

// ======= MODAL/ALERT =======
function showModal(h){document.getElementById('modal-content').innerHTML=h;document.getElementById('modal-overlay').classList.add('show')}
function closeModal(){document.getElementById('modal-overlay').classList.remove('show')}
function closeAlert(){document.getElementById('alert-overlay').classList.remove('show');window._pending=null}
document.getElementById('modal-overlay').addEventListener('click',function(e){if(e.target===this)closeModal()});
document.getElementById('alert-overlay').addEventListener('click',function(e){if(e.target===this)closeAlert()});

// ======= INIT =======
var sel=document.getElementById('month-select'),now=new Date();
for(var i=-6;i<=5;i++){var d=new Date(now.getFullYear(),now.getMonth()+i,1);var o=document.createElement('option');o.value=d.getFullYear()+'-'+d.getMonth();o.textContent=MONTH_NAMES[d.getMonth()]+' '+d.getFullYear();if(i===0)o.selected=true;sel.appendChild(o)}
renderOrgName();
render();

// ======= HIGHLIGHT SYSTEM =======
var hlState={names:[],shifts:[]}; // multi-select: names=['SAROJA'], shifts=[{name:'SAROJA',shift:'M'}]

function hlName(name){
  var idx=hlState.names.indexOf(name);
  if(idx>=0){hlState.names.splice(idx,1)}else{hlState.names.push(name)}
  applyHighlight();
}
function hlShift(name,shift){
  var found=-1;
  for(var i=0;i<hlState.shifts.length;i++){
    if(hlState.shifts[i].name===name&&hlState.shifts[i].shift===shift){found=i;break}
  }
  if(found>=0){hlState.shifts.splice(found,1)}else{hlState.shifts.push({name:name,shift:shift})}
  applyHighlight();
}
function clearHighlight(){hlState.names=[];hlState.shifts=[];applyHighlight()}

function hlAllNames(){
  // Toggle: if all staff already selected, clear. Otherwise select all.
  var staff=loadStaff(),team=(staff[state.currentTab]||[]).filter(function(s){return s.active});
  var allNames=team.map(function(s){return s.name});
  if(hlState.names.length===allNames.length){
    hlState.names=[];
  } else {
    hlState.names=allNames.slice();
  }
  applyHighlight();
}

function hlAllShift(shift){
  // Toggle: highlight all staff's cells of this shift type
  var staff=loadStaff(),team=(staff[state.currentTab]||[]).filter(function(s){return s.active});
  var allNames=team.map(function(s){return s.name});
  // Check if all are already selected for this shift
  var allSelected=allNames.every(function(name){
    return hlState.shifts.some(function(s){return s.name===name&&s.shift===shift});
  });
  if(allSelected){
    // Deselect all of this shift
    hlState.shifts=hlState.shifts.filter(function(s){return s.shift!==shift});
  } else {
    // Select all nurses for this shift
    allNames.forEach(function(name){
      if(!hlState.shifts.some(function(s){return s.name===name&&s.shift===shift})){
        hlState.shifts.push({name:name,shift:shift});
      }
    });
  }
  applyHighlight();
}

function applyHighlight(){
  var table=document.querySelector('.rota-table');if(!table)return;
  var summary=document.getElementById('summary-tbl');
  var hasAny=hlState.names.length>0||hlState.shifts.length>0;
  table.classList.toggle('has-highlight',hasAny);

  // Clear main table highlight classes
  var rows=table.querySelectorAll('tbody tr');
  rows.forEach(function(row){
    row.classList.remove('hl-row','hl-partial');
    row.querySelectorAll('td.shift-cell').forEach(function(c){c.classList.remove('hl-cell')});
  });

  // Clear summary table active states
  if(summary){
    summary.querySelectorAll('td,th').forEach(function(el){el.classList.remove('active')});
  }

  if(!hasAny)return;

  // Highlight name rows in main table + mark summary name cells active
  hlState.names.forEach(function(name){
    var row=table.querySelector('tr[data-nurse="'+name+'"]');
    if(row)row.classList.add('hl-row');
    // Mark the summary name cell as active
    if(summary){
      summary.querySelectorAll('td.name-cell').forEach(function(td){
        if(td.textContent===name)td.classList.add('active');
      });
    }
  });

  // Highlight specific shift cells in main table + mark summary count cells active
  hlState.shifts.forEach(function(item){
    var row=table.querySelector('tr[data-nurse="'+item.name+'"]');
    if(!row)return;
    row.classList.add('hl-partial');
    row.querySelectorAll('td[data-shift="'+item.shift+'"]').forEach(function(c){c.classList.add('hl-cell')});
    // Also highlight MA cells when filtering M or A
    if(item.shift==='M'||item.shift==='A'){
      row.querySelectorAll('td[data-shift="MA"]').forEach(function(c){c.classList.add('hl-cell')});
    }
    if(item.shift==='A'||item.shift==='N'){
      row.querySelectorAll('td[data-shift="AN"]').forEach(function(c){c.classList.add('hl-cell')});
    }
    // Mark the corresponding summary count cell as active
    if(summary){
      var shiftCols={G:1,M:2,MA:3,A:4,AN:5,N:6,O:7,PL:8};
      var colIdx=shiftCols[item.shift];
      if(colIdx!==undefined){
        summary.querySelectorAll('tbody tr').forEach(function(tr){
          var nameCell=tr.querySelector('td.name-cell');
          if(nameCell&&nameCell.textContent===item.name){
            var cells=tr.querySelectorAll('td');
            if(cells[colIdx])cells[colIdx].classList.add('active');
          }
        });
      }
    }
  });

  // Mark header th as active if all nurses are selected for a shift type or all names selected
  if(summary){
    var staff=loadStaff(),team=(staff[state.currentTab]||[]).filter(function(s){return s.active});
    var allNames=team.map(function(s){return s.name});
    var headers=summary.querySelectorAll('thead th');
    // Name/Total headers active if all names selected
    if(hlState.names.length===allNames.length&&allNames.length>0){
      if(headers[0])headers[0].classList.add('active');
      if(headers[9])headers[9].classList.add('active');
    }
    // Shift headers active if all nurses selected for that shift
    var shiftCols={G:1,M:2,MA:3,A:4,AN:5,N:6,O:7,PL:8};
    Object.keys(shiftCols).forEach(function(shift){
      var col=shiftCols[shift];
      var allSelected=allNames.every(function(name){
        return hlState.shifts.some(function(s){return s.name===name&&s.shift===shift});
      });
      if(allSelected&&allNames.length>0&&headers[col])headers[col].classList.add('active');
    });
  }
}

// Clear highlight when clicking outside summary table
document.addEventListener('click',function(e){
  var summary=document.getElementById('summary-tbl');
  if(summary&&!summary.contains(e.target)&&(hlState.names.length>0||hlState.shifts.length>0)){
    clearHighlight();
  }
});

// ======= EXPORT PDF =======
function exportPDF(){
  var tab=state.currentTab;
  var tabLabel=tab==='nurses'?'Nurses':'HouseKeeping';
  var monthName=MONTH_NAMES[state.currentMonth];
  var year=state.currentYear;
  // Set document title (becomes default filename in Save As PDF)
  var origTitle=document.title;
  document.title='ShiftPlanner '+tabLabel+' '+monthName+' '+year;
  window.print();
  // Restore original title after print dialog closes
  setTimeout(function(){document.title=origTitle},1000);
}

// ======= STAFF EXPORT / IMPORT =======
function exportStaff(format){
  var staff=loadStaff();
  var orgName=loadOrgName();
  var filename='ShiftPlanner-Staff';
  if(format==='json'){
    var exportData={orgName:orgName,nurses:staff.nurses,housekeeping:staff.housekeeping,incompatiblePairs:staff.incompatiblePairs};
    var blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
    downloadBlob(blob,filename+'.json');
  } else if(format==='csv'){
    // Build CSV: OrgName on first line, then Tab,Name,Role,Active,NightPref
    var lines=['OrgName,'+orgName,'','Tab,Name,Role,Active,NightPref'];
    ['nurses','housekeeping'].forEach(function(tab){
      (staff[tab]||[]).forEach(function(s){
        var np=(s.nightPref&&s.nightPref.length)?s.nightPref.join(';'):'';
        lines.push(tab+','+s.name+','+s.role+','+(s.active?'yes':'no')+','+np);
      });
    });
    if(staff.incompatiblePairs&&staff.incompatiblePairs.length){
      lines.push('');lines.push('IncompatiblePairs');
      staff.incompatiblePairs.forEach(function(p){lines.push('pair,'+p[0]+','+p[1])});
    }
    var blob=new Blob([lines.join('\n')],{type:'text/csv'});
    downloadBlob(blob,filename+'.csv');
  }
  showToast('Staff data exported as '+format.toUpperCase());
}

function downloadBlob(blob,filename){
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();
  setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url)},100);
}

function importStaff(input){
  if(!input.files||!input.files[0])return;
  var file=input.files[0];
  var reader=new FileReader();
  reader.onload=function(e){
    var content=e.target.result;
    try{
      if(file.name.endsWith('.json')){
        var data=JSON.parse(content);
        // Validate structure
        if(!data.nurses&&!data.housekeeping){showToast('Invalid JSON — missing nurses/housekeeping keys');return}
        if(!data.nurses)data.nurses=[];
        if(!data.housekeeping)data.housekeeping=[];
        if(!data.incompatiblePairs)data.incompatiblePairs=[];
        if(data.orgName){saveOrgName(data.orgName);renderOrgName()}
        saveStaff(data);
        showToast('Staff imported from JSON');
      } else if(file.name.endsWith('.csv')){
        var lines=content.split('\n').map(function(l){return l.trim()}).filter(function(l){return l});
        var data={nurses:[],housekeeping:[],incompatiblePairs:[]};
        var inPairs=false;
        for(var i=0;i<lines.length;i++){
          var line=lines[i];
          if(line==='IncompatiblePairs'){inPairs=true;continue}
          if(line.toLowerCase().indexOf('tab,name')===0)continue; // header
          if(line.indexOf('OrgName,')===0){saveOrgName(line.substring(8).trim());renderOrgName();continue}
          var parts=line.split(',');
          if(inPairs&&parts[0]==='pair'&&parts.length>=3){
            data.incompatiblePairs.push([parts[1].trim(),parts[2].trim()]);
          } else if(parts.length>=4){
            var tab=parts[0].trim().toLowerCase();
            var name=parts[1].trim().toUpperCase();
            var role=parts[2].trim().toLowerCase();
            var active=parts[3].trim().toLowerCase()!=='no';
            var nightPref=[];
            if(parts[4]&&parts[4].trim()){nightPref=parts[4].trim().split(';').map(function(w){return parseInt(w)}).filter(function(w){return w>=1&&w<=4})}
            if(tab==='nurses'||tab==='housekeeping'){
              var entry={name:name,role:role,active:active};
              if(nightPref.length)entry.nightPref=nightPref;
              data[tab].push(entry);
            }
          }
        }
        saveStaff(data);
        showToast('Staff imported from CSV');
      } else {
        showToast('Unsupported file type — use .json or .csv');return;
      }
      closeModal();render();
      // Re-open setup to show updated list
      setTimeout(function(){showSetup()},300);
    }catch(err){
      showToast('Import failed: '+err.message);
    }
  };
  reader.readAsText(file);
  input.value=''; // reset so same file can be re-imported
}

// ======= PUBLIC API =======
window.SP={changeMonth:changeMonth,switchTab:switchTab,generateRota:generateRota,showAddOff:showAddOff,applyAddOff:applyAddOff,editShift:editShift,applyShift:applyShift,confirmShift:confirmShift,saveManual:saveManual,undoLast:undoLast,showSetup:showSetup,toggleStaff:toggleStaff,changeRole:changeRole,removeStaff:removeStaff,addStaff:addStaff,editName:editName,editOrgName:editOrgName,setNightPref:setNightPref,addPair:addPair,removePair:removePair,closeModal:closeModal,closeAlert:closeAlert,hlName:hlName,hlShift:hlShift,hlAllNames:hlAllNames,hlAllShift:hlAllShift,clearHighlight:clearHighlight,exportPDF:exportPDF,exportStaff:exportStaff,importStaff:importStaff};
})();
