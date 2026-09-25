# Changelog — bugfix phases

## Phase 1 — Blockers
### B1 Fire module unwinnable
- **Files:** `TrainingCentre.js`, `FireSafety.js`, `main.js`, `City.js` (createFire)
- South wall has door gap; outdoor floor + assembly at z=14; door opens via `onVisual('exit')` (collider disabled)
- Fire VFX marked `noCollision`; LOS ignores target group descendants
- Assembly requires fire extinguished + exit first

### B2 PPE module
- **Files:** `TrainingCentre.js` (`buildPPEScenario`), `PPESafety.js`, `World.js`, `i18n/*`
- Dedicated room with helmet/shoes/gloves/goggles/vest + wrong sandals
- Distinct objective keys `ppeObj_*`

### B3 Machinery module
- **Files:** `TrainingCentre.js` (`buildMachineryScenario`), `World.js`
- Room with emergency_stop, lockout_tagout, ppe_station

## Phase 2 — Player / physics
### P1 Ground probe height
- **Files:** `PlayerController.js` — `probeGround(nx, proposedFeetY, nz)` (feet Y, not mid-body)

### P2 Sprint in air
- Keep sprint speed after jump if already near sprint speed

### P3 Pause on pointer unlock
- `pointerlockchange` → pause when lock lost during play; Space preventDefault

### P4 Solid registration
- Explicit `userData.solid` / `physics` / `noCollision`; hide disables collider; VFX never solid

### P8 Module bounds + floor
- Module floor probe at y=0.1; soft world bounds after clear()

### P9 Slope slide direction
- Downhill uses +normal.xz

## Phase 3 — Scoring
- Idempotent events (`once` Set) in Fire/Gas/PPE
- Hazard penalty only in scenario (not doubled in main.js)
- `ScenarioManager.complete()` state guard + `dispose()` timers
- `completeObjective` only when `completeById` returns true

## Phase 4 — UI / build
- Menu orbit camera driven from main loop (not one-shot rAF)
- `exitToMainMenu` aborts scenario, clears currentModuleId
- Progress list uses textContent (XSS)
- Certificate IDs use crypto.getRandomValues (48-bit)
- `vite.config.js` multi-page input: index, verify, admin; three vendor chunk
- `public/sw.js` placeholder for offline shell
- i18n: `moduleComplete` + PPE keys in en/hi/sat

## Found while working
- Extinguisher meshes were auto-solid → invisible walls when hidden; now noCollision
- Gas mist sphere was solid cube collision → noCollision
- Assessment module name was generic "Training" for PPE/machinery

## Phase 5 — Build blockers & regression fixes (current pass)
### B4 Project wouldn't build or run at all
- `src/i18n/en.js`, `hi.js`, `sat.js` each had a stray bare `,` line mid-object literal
  → syntax error, which is why `npm run dev` / `npm run build` failed with
  `Unexpected token ','` for every entry point (index/verify/admin). Removed the
  stray lines; all three locale files now parse and export 100 matching keys.
- (The `Cannot find package 'three'` / `'vite' is not recognized` errors seen
  earlier were just `npm install` not having been run yet — no code change needed.)

### B5 Score could silently exceed 100 ("hidden banked points")
- `ScoreManager.addCorrect / completeObjective / evacuationBonus / fastResponseBonus`
  added points with no upper clamp, so `score.score` (raw) could climb past 100 while
  `getPercentage()` stayed capped — internal and displayed score disagreed.
- Fixed: every point gain is now clamped to `Math.min(100, ...)`, matching the existing
  clamp on penalties.

### B6 Fire module emergency exit could trap the player
- The exit door was a solid collider that only opened through the `action === 'exit'`
  handler in `main.js`, which only fired from an explicit **E** press — there was no
  path from just walking up to the door. A `emergency_exit_zone` trigger volume already
  existed in `World.js` but had no `onEnter` wired up, so it did nothing.
- Also found: `BoxCollider.updateBounds()` re-armed `active = true` on every cached-bounds
  frame unless `isOpen` was also set, so any code that only touched `.active` (without
  `.isOpen`) had the door silently re-lock itself next frame.
- Fixed: `emergency_exit_zone` now auto-opens the door (`active = false`, `isOpen = true`)
  the moment the player enters it — the same way a real push-bar fire-exit works — and
  still calls into `ScenarioManager` for scoring consistency with the E-press path.
- Also shrank the outdoor "assembly yard" bounds in `TrainingCentre.js` (fire scenario)
  so the player naturally stops near the assembly marker instead of walking straight
  past it to a far wall.

### B7 Machinery Safety module was a stub, not a finished module
- Was marked "Prototype" in the UI and reused Fire/Gas i18n text; two of its six
  objectives (`identify_hazard`, `danger_zone`) could never be completed because no
  hazard sign or danger-zone trigger existed for the machinery room.
- Added a `hazard_sign` interactable and a `machinery_zone` HAZARD volume
  (`World.js`, `TrainingCentre.js`), rewrote `MachinerySafety.js` with idempotent
  `once()`-guarded event handling matching the Fire/Gas modules, and added dedicated
  `machObj1`–`machObj6` keys to `en.js` / `hi.js` / `sat.js`. Module card and README
  updated from "Prototype" to "Ready".

## Phase 6 — Practical Lab entrance + certificate storage/security fixes (current pass)
### F1 Practical Lab building had no door, no prompt, and its own module was dead code
- `src/world/PracticalLab.js` built a lab/PPE building with a working export
  (`buildPracticalLab`) but was **never imported anywhere**. `City.js` instead
  had its own inline duplicate of the same building with no door mesh and no
  `userData.isEntrance` — so unlike the Training Centre, this side of the city
  was pure decoration you could never actually interact with.
- Also found: `PracticalLab.js`'s own local `box()` helper never set
  `userData.solid`, so had the module ever been wired in, the building would
  have had zero collision (walk-through walls).
- Fixed: `PracticalLab.js` now marks solid meshes correctly and adds an
  entrance door + sign (`practical_lab_door`, `userData.entranceTarget =
  'machinery'`). `City.js` now calls `buildPracticalLab()` instead of
  duplicating it. `main.js`'s `enterCity()` traversal now branches on
  `entranceTarget` so this door shows its own **"ENTER PRACTICAL LAB"**
  interaction prompt and launches the Machinery module directly, the same way
  the Training Centre's door opens the module-select menu.

### F2 Certificates could silently disappear (StorageManager race condition)
- `StorageManager`'s IndexedDB init (`_initDB()`) is async but was never
  awaited before `saveCertificate()` / `getCertificates()` checked `this.db`.
  A certificate saved before IndexedDB finished opening went to the
  `localStorage` fallback; a later read (once `this.db` *was* ready) only
  looked in IndexedDB and would silently miss it — a real, earned certificate
  could vanish from Progress / Certificates.
- Fixed: the init promise is now stored (`this.dbReady`) and awaited by every
  call. Certificates are also always mirrored to `localStorage` in addition
  to IndexedDB (when available), and `getCertificates()` merges both sources.
  This also fixes `admin.html`, which only ever reads `localStorage` directly
  (it's a standalone page, not a module) — previously it showed almost
  exclusively the seeded demo rows because most real certificates went to
  IndexedDB instead.

### F3 Stored XSS via trainee name
- The free-text name typed on the "Enter your name" screen becomes
  `cert.traineeName` and is saved with each certificate. Three places
  interpolated it straight into `innerHTML` with no escaping — inconsistent
  with the rest of the app, which deliberately uses `textContent` for the
  same data (see Phase 4's XSS fix note) — meaning a name like
  `<img src=x onerror=...>` would execute wherever certificates are listed:
  - `src/main.js` → `showCertificates()`
  - `admin.html` → trainee table
  - `verify.html` → certificate detail panel
- Fixed: `showCertificates()` now builds the DOM with `textContent` /
  `createElement`, matching `showProgress()`. `admin.html` and `verify.html`
  now HTML-escape every certificate field before interpolating it.
- `verify.html` also had a related correctness bug: its localStorage fallback
  only ran if `openDB()` *threw*, not if IndexedDB opened fine but simply
  didn't have that record yet (the F2 race condition above). A certificate
  saved to `localStorage`-only could come back "NOT FOUND / INVALID" even
  though it was perfectly valid. It now always checks `localStorage` as a
  second source, not just on IndexedDB failure.

## Verification (Phase 6)
- Run: `npm install && node tests/regression.mjs` → 23/23 checks passing
- Run: `npm run build` → builds `dist/index.html`, `verify.html`, `admin.html`
  cleanly (117 modules, up from 116 — `PracticalLab.js` is now actually used)
- Manual/scripted: both `training_door` and `practical_lab_door` exist in the
  city, are correctly flagged (`isEntrance`, `entranceTarget`, `solid`), and
  don't overlap any other geometry in their building

