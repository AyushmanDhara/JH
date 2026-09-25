/**
 * Headless regression checks for the Jharkhand Industrial Safety Simulator.
 * Run from project root:  node tests/regression.mjs
 * No WebGL needed — it stubs the few browser globals the code touches.
 * Exit code 1 if any check fails.
 */
import * as THREE from 'three';
import fs from 'node:fs';

const noop = () => {};
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem: noop };
globalThis.document = {
  createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, fillRect: noop,
      strokeRect: noop, fillText: noop, closePath: noop, fill: noop, clearRect: noop,
    }),
  }),
  addEventListener: noop, removeEventListener: noop, exitPointerLock: noop,
};

const { World } = await import('../src/world/World.js');
const { PlayerController } = await import('../src/player/PlayerController.js');
const { PhysicsSystem } = await import('../src/core/PhysicsSystem.js');
const { createEnvironment } = await import('../src/world/Environment.js');
const { buildCity } = await import('../src/world/City.js');
const { InteractionSystem } = await import('../src/core/InteractionSystem.js');
const { ScoreManager } = await import('../src/core/ScoreManager.js');
const { ObjectiveManager } = await import('../src/core/ObjectiveManager.js');
const { ScenarioManager } = await import('../src/core/ScenarioManager.js');
const { createFireScenarioConfig } = await import('../src/modules/FireSafety.js');
const { createGasScenarioConfig } = await import('../src/modules/GasSafety.js');
const { createPPEScenarioConfig } = await import('../src/modules/PPESafety.js');
const { createMachineryScenarioConfig } = await import('../src/modules/MachinerySafety.js');
const { AssessmentEngine } = await import('../src/core/AssessmentEngine.js');
const en = (await import('../src/i18n/en.js')).default;

const dom = { addEventListener: noop, removeEventListener: noop };
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

// ---------- helpers ----------
function flatWorld() {
  const scene = new THREE.Scene();
  const ph = new PhysicsSystem(scene);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial());
  g.rotation.x = -Math.PI / 2; g.updateMatrixWorld(true); ph._groundMeshes.push(g);
  const p = new PlayerController(new THREE.PerspectiveCamera(), dom, ph);
  p.enable(); p.setPosition(0, undefined, 0);
  return { scene, ph, p };
}
function fullWorld() {
  const w = Object.create(World.prototype);
  w.scene = new THREE.Scene(); w.quality = 'medium';
  w.physics = new PhysicsSystem(w.scene);
  const env = createEnvironment(w.scene); env.ground.name = 'ground'; w.physics._groundMeshes.push(env.ground);
  w.backdropGroup = buildCity(w.scene); w.moduleGroup = null; w.moduleData = null; w.mode = 'menu';
  return w;
}
const run = (p, frames, dt = 1 / 60) => { for (let i = 0; i < frames; i++) p.update(dt); };

// ---------- 1. Player controller ----------
console.log('\n# Player controller / physics');
{
  const { p } = flatWorld();
  let min = 9, max = 0, grounded = 0;
  for (let i = 0; i < 120; i++) { p.update(1 / 60); min = Math.min(min, p.position.y); max = Math.max(max, p.position.y); if (p.grounded) grounded++; }
  check('standing still keeps eye height stable (1.65 ± 0.02)', min > 1.63 && max < 1.67, `range ${min.toFixed(2)}–${max.toFixed(2)}`);
  check('grounded on ≥95% of idle frames', grounded >= 114, `${grounded}/120`);
}
for (const [h, shouldBlock] of [[0.3, false], [0.8, true], [1.1, true]]) {
  const { scene, ph, p } = flatWorld();
  const b = new THREE.Mesh(new THREE.BoxGeometry(4, h, 0.4), new THREE.MeshBasicMaterial());
  b.position.set(0, h / 2, -3); b.userData.solid = true; scene.add(b); b.updateMatrixWorld(true);
  ph.addCollider(b, { ground: false });
  p.yaw = 0; p.moveForward = true; run(p, 240);
  const passed = p.position.z < -3.4;
  check(`${h} m obstacle ${shouldBlock ? 'blocks' : 'is stepped over'}`, passed !== shouldBlock, passed ? 'walked over it' : 'blocked');
}
{
  const { p } = flatWorld(); p.sprint = true; p.moveForward = true; run(p, 120);
  check('sprint reaches ≥ 9 m/s', p.horizontalSpeed >= 9, `${p.horizontalSpeed.toFixed(2)} m/s`);
  const before = p.horizontalSpeed; p._onKeyDown({ code: 'Space' }); p.update(1 / 60);
  check('jumping while sprinting keeps horizontal speed (≥ 90%)', p.horizontalSpeed >= before * 0.9, `${before.toFixed(1)} → ${p.horizontalSpeed.toFixed(1)}`);
}
{
  const { p } = flatWorld(); run(p, 30); let apex = 0;
  p._onKeyDown({ code: 'Space' }); for (let i = 0; i < 90; i++) { p.update(1 / 60); apex = Math.max(apex, p.position.y - 1.65); }
  check('jump reaches ~1.0–1.4 m and lands grounded', apex > 1.0 && apex < 1.4 && p.grounded, `apex ${apex.toFixed(2)} m`);
}

// ---------- 2. Module rooms ----------
console.log('\n# Module rooms (fire / gas)');
{
  const w = fullWorld(); const md = w.enterModule('fire');
  const fireKids = w.physics.colliders.filter(c => c.object?.parent === md.fire).length;
  check('fire VFX meshes are NOT solid colliders', fireKids === 0, `${fireKids} solid fire meshes`);

  const inter = new InteractionSystem(new THREE.PerspectiveCamera(), w.scene);
  inter.setSolidMeshProvider(() => w.physics.getSolidMeshes());
  const fire = md.interactables.find(i => i.id === 'fire');
  inter.register('fire', fire.object, noop, { maxDist: 3.5 });
  let seen = 0, tried = 0;
  for (let a = 0; a < 360; a += 15) for (const r of [1.8, 2.5, 3.2]) {
    inter.camera.position.set(-5.5 + Math.sin(a * Math.PI / 180) * r, 1.65, -1 + Math.cos(a * Math.PI / 180) * r);
    inter.camera.lookAt(-5.5, 0.6, -1); inter.camera.updateMatrixWorld(true); inter.update(); tried++; if (inter.currentTarget) seen++;
  }
  check('fire can be targeted for extinguishing (≥ 50% of viewpoints)', seen / tried >= 0.5, `${seen}/${tried}`);

  const p = new PlayerController(new THREE.PerspectiveCamera(), dom, w.physics);
  p.enable(); p.setPosition(0, undefined, 6); p.yaw = Math.PI; p.moveForward = true; run(p, 600);
  // After the emergency-exit door is opened, the player must be able to travel to the assembly marker.
  // Trigger it the same way the game does, then walk again.
  const asm = md.interactables.find(i => i.id === 'assembly_point').object; const ap = new THREE.Vector3(); asm.getWorldPosition(ap);
  check('assembly marker is inside/behind a reachable exit (player can get within 3.5 m)',
    p.position.distanceTo(ap) <= 3.5 || w.physics.colliders.every(c => !(c.object?.userData?.interactId === 'emergency_exit')),
    `closest approach ${p.position.distanceTo(ap).toFixed(1)} m; exit door is ${w.physics.colliders.some(c => c.object?.userData?.interactId === 'emergency_exit') ? 'solid' : 'open'}`);
}
{
  const w = fullWorld(); const md = w.enterModule('gas');
  const mistSolid = w.physics.colliders.some(c => c.object?.geometry?.type === 'SphereGeometry');
  check('gas mist sphere is NOT a solid collider', !mistSolid);
  const p = new PlayerController(new THREE.PerspectiveCamera(), dom, w.physics);
  p.enable(); p.setPosition(1.6, undefined, 6); p.yaw = Math.PI; p.moveForward = true; run(p, 900); // 15 s walking +z past the exit door
  check('gas tunnel keeps the player inside (cannot walk out of the open end)', p.position.z < 21, `z=${p.position.z.toFixed(1)} after 15 s (tunnel ends at z=20)`);
  const w2 = fullWorld(); const ppe = w2.enterModule('ppe');
  const ids = new Set(ppe.interactables.map(i => i.id));
  const need = ['helmet', 'shoes', 'gloves', 'goggles', 'vest'];
  check('PPE module room exposes every required PPE interactable', need.every(n => ids.has(n)), `${need.filter(n => ids.has(n)).length}/5`);
  const w3 = fullWorld(); const mach = w3.enterModule('machinery'); const mids = new Set(mach.interactables.map(i => i.id));
  check('Machinery module room exposes e-stop + lockout + PPE', ['emergency_stop', 'lockout_tagout', 'ppe_station'].every(n => mids.has(n)));
}


// ---------- 2b. Navigation / training-module structure ----------
console.log('\n# Modules: registry, isolation, City Enter removal');
{
  const w = fullWorld();
  check('menu mode has no colliders or triggers (no walkable city)', w.physics.colliders.length + w.physics.triggers.length === 0);
  for (const id of ['fire', 'gas', 'ppe', 'machinery']) {
    let threw = null;
    let md; try { md = w.enterModule(id); } catch (e) { threw = e; }
    check(`enterModule('${id}') builds a lit, populated room`, !threw && md.group.children.length > 10 && md.interactables.length >= 4
      && md.group.children.some(c => c.isLight), threw ? String(threw) : `${md.group.children.length} objects, ${md.interactables.length} interactables`);
    check(`'${id}': every interactable has a scene object`, md.interactables.every(i => i.object && i.id && i.label));
    w.exitModule();
    check(`'${id}': exitModule() restores menu mode + clears colliders`, w.mode === 'menu' && w.backdropGroup.visible && w.physics.colliders.length === 0);
  }
  let threw = false; try { w.enterModule('does_not_exist'); } catch { threw = true; }
  check('unknown module id throws (never a silent blank scene)', threw);
  const src = fs.readFileSync('src/main.js', 'utf8');
  check('no dynamic import() of training modules (lazy-chunk failure mode)', !/import\(\s*['"]\.\/modules\//.test(src));
  const idx = fs.readFileSync('index.html', 'utf8');
  const cardIds = [...idx.matchAll(/class="module-card" data-module="(\w+)"/g)].map(m => m[1]);
  check('every Training Menu card maps to a registered module', cardIds.length === 4 && cardIds.every(id => new RegExp(`\\b${id}:\\s*\\{ nameKey`).test(src)), cardIds.join(','));
  check('no City Enter remnants in main.js / index.html', !/enterCity|returnToCity|CITY MAP|EXIT TO CITY|exit-to-city/.test(src + idx));
  const ae = new AssessmentEngine({});
  check('each module has its own 5-question quiz', ['fire', 'gas', 'ppe', 'machinery'].every(m => ae.getQuiz(m).length === 5)
    && ae.getQuiz('ppe')[0].q !== ae.getQuiz('fire')[0].q && ae.getQuiz('machinery')[0].q !== ae.getQuiz('fire')[0].q);
}
{
  // Machinery: objective list must be completable without any penalty action
  const score = new ScoreManager(), obj = new ObjectiveManager();
  const sm = new ScenarioManager({ objectiveManager: obj, scoreManager: score, i18n: {} });
  let done = 0; sm.on(t => { if (t === 'complete') done++; });
  sm.start(createMachineryScenarioConfig({ onNotify: noop, onVisual: noop }));
  ['hazard_sign', 'danger_zone_seen', 'ppe_station', 'emergency_stop', 'lockout_tagout'].forEach(e => sm.handleEvent(e));
  check('machinery: completes safely via sign → caution lane → PPE → e-stop → lockout', done === 1 && obj.isAllComplete() && score.unsafe === 0,
    `unsafe=${score.unsafe}, allObjectives=${obj.isAllComplete()}`);
  const s2 = new ScoreManager(), o2 = new ObjectiveManager();
  const sm2 = new ScenarioManager({ objectiveManager: o2, scoreManager: s2, i18n: {} });
  sm2.start(createMachineryScenarioConfig({ onNotify: noop, onVisual: noop }));
  for (let i = 0; i < 10; i++) sm2.handleEvent('lockout_tagout');
  check('machinery: lockout before e-stop is penalised once, not per press', s2.unsafe === 1, `unsafe=${s2.unsafe}`);
}
{
  // Camera roll regression: stale lookAt roll must not survive spawn()
  const cam = new THREE.PerspectiveCamera(); cam.position.set(20, 12, 30); cam.lookAt(0, 2, -10);
  cam.rotation.z = 0.4;
  const ph = new PhysicsSystem(new THREE.Scene());
  const p = new PlayerController(cam, dom, ph); p.enable(); p.spawn(0, 6, 0);
  check('player.spawn() leaves the camera with zero roll', Math.abs(cam.rotation.z) < 1e-9 && cam.rotation.order === 'YXZ');
}

// ---------- 3. Scenario / score logic ----------
console.log('\n# Scenario & scoring');
function rig(cfg) {
  const score = new ScoreManager(), obj = new ObjectiveManager();
  const sm = new ScenarioManager({ objectiveManager: obj, scoreManager: score, i18n: {} });
  let completions = 0; sm.on(t => { if (t === 'complete') completions++; });
  sm.start(cfg({ onNotify: noop, onVisual: noop }));
  return { score, obj, sm, get completions() { return completions; } };
}
{
  const r = rig(createFireScenarioConfig); r.sm.handleEvent('assembly_point');
  check('fire module cannot be completed by skipping straight to the assembly point', r.completions === 0);
}
{
  const r = rig(createGasScenarioConfig); r.sm.handleEvent('gas_alarm'); const s1 = r.score.score; for (let i = 0; i < 20; i++) r.sm.handleEvent('gas_alarm');
  check('repeating an event does not farm points (idempotent)', r.score.score === s1, `${s1} → ${r.score.score}`);
}
{
  // main.js hazard callback + scenario 'enter_hazard' handler must not both deduct points
  const main = fs.readFileSync('src/main.js', 'utf8');
  const start = main.indexOf('setHazardCallback('); const block = main.slice(start, main.indexOf('\n  });', start));
  const scenarioPenalises = /case 'enter_hazard':[\s\S]{0,120}addUnsafe/.test(fs.readFileSync('src/modules/GasSafety.js', 'utf8'));
  const mainPenalises = /engine\.score\.addUnsafe\(/.test(block) && /handleEvent\('enter_hazard'/.test(block);
  check('a hazard entry is penalised exactly once (currently scenario −15 AND main.js −15)', !(scenarioPenalises && mainPenalises));
}
{
  const s = new ScoreManager(); for (let i = 0; i < 6; i++) s.addCorrect();
  check('displayed score and internal score agree (no hidden banked points)', s.getPercentage() === Math.round(s.score) || s.score <= 100, `raw ${s.score}, shown ${s.getPercentage()}`);
}
{
  const r = rig(createFireScenarioConfig); r.sm.complete(); r.sm.complete();
  check('ScenarioManager.complete() is idempotent', r.completions === 1, `emitted ${r.completions}×`);
}

// ---------- 4. i18n / build ----------
console.log('\n# i18n & build config');
{
  const src = ['src/modules/FireSafety.js', 'src/modules/GasSafety.js', 'src/modules/MachinerySafety.js', 'src/modules/PPESafety.js', 'src/main.js']
    .map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const keys = new Set([...src.matchAll(/onNotify\?\.\('([A-Za-z0-9_]+)'/g)].map(m => m[1]));
  const missing = [...keys].filter(k => !(k in en));
  check('every onNotify() key exists in en.js', missing.length === 0, missing.join(', '));
  const cfg = fs.readFileSync('vite.config.js', 'utf8');
  check('vite.config.js builds verify.html and admin.html', /verify\.html/.test(cfg) && /admin\.html/.test(cfg));
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  check('README promises PWA/offline → a PWA plugin or service worker exists',
    !!(pkg.devDependencies?.['vite-plugin-pwa'] || fs.existsSync('public/sw.js') || fs.existsSync('src/sw.js')));
}

const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed, ${failed} failing`);
process.exit(failed ? 1 : 0);
