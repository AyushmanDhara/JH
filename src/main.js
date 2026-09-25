/**
 * JHARKHAND INDUSTRIAL SAFETY SIMULATOR
 * Main entry — wires TrainingEngine + World + UI.
 *
 * Navigation model (no free-roam city):
 *   Main Menu ─┬─ Training Menu → Training Module → Assessment → Certificate/Result
 *              │        ▲                │ (pause: Training Menu / Main Menu)
 *              │        └────────────────┘
 *              ├─ Tutorial & Safety · How to Play · Progress · Certificates · Settings
 *
 * appState: loading | menu (any menu screen) | module | paused | completing |
 *           assessment | certificate
 */
import { TrainingEngine } from './core/TrainingEngine.js';
import { World } from './world/World.js';
import { PlayerController } from './player/PlayerController.js';
import { MobileControls } from './player/MobileControls.js';
import { HUD } from './ui/HUD.js';
// All four training modules are imported statically. They were previously
// split: Fire/Gas shipped in the main bundle while PPE/Machinery were lazy
// dynamic imports, so those two failed whenever their chunk could not be
// fetched (stale cache after a deploy, partial upload, offline, flaky host).
import { createFireScenarioConfig } from './modules/FireSafety.js';
import { createGasScenarioConfig } from './modules/GasSafety.js';
import { createPPEScenarioConfig } from './modules/PPESafety.js';
import { createMachineryScenarioConfig } from './modules/MachinerySafety.js';
import { isMobile } from './utils/DeviceDetector.js';
import { generateQR } from './utils/QRGenerator.js';
import { AudioManager } from './utils/AudioManager.js';
import { TRAINING_VIDEOS, getEmbedUrl, isValidVideoId } from './data/videos.js';
import { getTip } from './data/trainingTips.js';

const canvas = document.getElementById('game-canvas');
const engine = new TrainingEngine();
const audio = new AudioManager();
const hud = new HUD(engine.i18n);

let world, player, mobileControls;
let appState = 'loading';
let currentModuleId = null;
let quizAnswers = [];
let lastResult = null;
let lastCert = null;
let assessTimer = null;
let assessBusy = false;
const shownTips = new Set();

/** Single registry of training modules: one entry per Training Menu card. */
const MODULES = {
  fire:      { nameKey: 'moduleFire',      create: createFireScenarioConfig,      spawn: { x: 0, z: 6, yaw: 0 } },
  gas:       { nameKey: 'moduleGas',       create: createGasScenarioConfig,       spawn: { x: 0, z: 6, yaw: 0 } },
  ppe:       { nameKey: 'modulePPE',       create: createPPEScenarioConfig,       spawn: { x: 0, z: 6, yaw: 0 } },
  machinery: { nameKey: 'moduleMachinery', create: createMachineryScenarioConfig, spawn: { x: 0, z: 6, yaw: 0 } },
};
const moduleName = (id) => (MODULES[id] ? engine.i18n.t(MODULES[id].nameKey) : 'Training');

const screens = {
  loading: document.getElementById('loading-screen'),
  menu: document.getElementById('main-menu'),
  pause: document.getElementById('pause-menu'),
  assessment: document.getElementById('assessment-modal'),
  certificate: document.getElementById('certificate-modal'),
  modules: document.getElementById('modules-menu'), // the Training Menu
  tutorial: document.getElementById('tutorial-menu'),
  howto: document.getElementById('howto-menu'),
  settings: document.getElementById('settings-menu'),
  progress: document.getElementById('progress-menu'),
  certificates: document.getElementById('certificates-menu'),
  namePrompt: document.getElementById('name-prompt'),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s?.classList.remove('active'));
  if (name && screens[name]) screens[name].classList.add('active');
}

function hideAllScreens() {
  Object.values(screens).forEach((s) => s?.classList.remove('active'));
}

async function init() {
  // WebGL support check
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) throw new Error('no webgl');
  } catch {
    const err = document.getElementById('webgl-error');
    if (err) err.style.display = 'flex';
    document.getElementById('loading-screen')?.classList.remove('active');
    return;
  }

  const bar = document.getElementById('loading-bar');
  const text = document.getElementById('loading-text');
  const steps = [
    'Loading core systems...',
    'Building industrial scenery...',
    'Initializing training engine...',
    'Preparing modules...',
    'Ready.',
  ];
  for (let i = 0; i < steps.length; i++) {
    text.textContent = steps[i];
    bar.style.width = `${((i + 1) / steps.length) * 100}%`;
    await new Promise((r) => setTimeout(r, 280));
  }

  const settings = engine.storage.getSettings();
  const quality = settings.quality || (isMobile() ? 'low' : 'medium');
  const qualitySelect = document.getElementById('setting-quality');
  if (qualitySelect) qualitySelect.value = quality;

  world = new World(canvas, quality);
  engine.setRenderer(world);
  player = new PlayerController(world.camera, canvas, world.physics);
  engine.initInteraction(world.camera, world.scene);

  // Hazard zones → scenario decides the penalty (applied once, inside the scenario)
  world.setHazardCallback((id) => {
    if (appState !== 'module') return;
    engine.scenarios.handleEvent('enter_hazard', { zone: id });
    hud.setScore(engine.score.getPercentage());
  });

  // Walk-in trigger zones → scenario events
  world.setZoneCallback((id) => {
    if (appState !== 'module') return;
    if (id === 'emergency_exit_zone') engine.scenarios.handleEvent('emergency_exit');
    else if (id === 'machinery_caution') engine.scenarios.handleEvent('danger_zone_seen');
    hud.setScore(engine.score.getPercentage());
  });

  if (isMobile()) {
    mobileControls = new MobileControls(player, document.getElementById('mobile-controls'));
    mobileControls.onInteract = () => tryInteract();
  }

  engine.interaction.onPromptChange = (visible, label) => {
    hud.setPrompt(visible, label);
  };
  engine.interaction.setSolidMeshProvider(() => world.physics.getSolidMeshes());

  // Accessibility: reduced motion disables head bob
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    player.headBobEnabled = false;
  }

  engine.objectives.onChange((current) => {
    if (current) hud.setObjective(engine.i18n.t(current.textKey));
  });

  // Scenario complete → short beat, then assessment. 'completing' freezes pause/keys
  // so the transition can never race with the pause menu or a teardown.
  engine.scenarios.on((type) => {
    if (type !== 'complete' || appState !== 'module') return;
    appState = 'completing';
    player.setPaused(true);
    assessTimer = setTimeout(() => {
      assessTimer = null;
      openAssessment();
    }, 600);
  });

  bindUI();
  updateOfflineIndicator();
  window.addEventListener('online', updateOfflineIndicator);
  window.addEventListener('offline', updateOfflineIndicator);
  applyLanguage(engine.i18n.lang);

  goToMainMenu();
  requestAnimationFrame(loop);
}

function updateOfflineIndicator() {
  const el = document.getElementById('offline-indicator');
  if (!navigator.onLine) el?.classList.remove('hidden');
  else el?.classList.add('hidden');
}

function applyLanguage(code) {
  engine.i18n.setLanguage(code);
  document.querySelectorAll('.lang-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.lang === code);
  });
  const t = (k) => engine.i18n.t(k);
  const map = {
    '[data-action="start"]': 'startTraining',
    '[data-action="modules"]': 'trainingModules',
    '[data-action="progress"]': 'progress',
    '[data-action="certificates"]': 'certificates',
    '[data-action="howto"]': 'howToPlay',
    '[data-action="settings"]': 'settings',
  };
  Object.entries(map).forEach(([sel, key]) => {
    const el = document.querySelector(`#main-menu ${sel}`);
    if (el) el.textContent = t(key);
  });
}

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

function goToMainMenu() {
  destroyActiveVideo();
  appState = 'menu';
  showScreen('menu');
}

/** Training Menu. Optional banner: { text, type: 'error' | 'info' }. */
function showTrainingMenu(notice) {
  destroyActiveVideo();
  appState = 'menu';
  const el = document.getElementById('modules-notice');
  if (el) {
    el.textContent = notice?.text || '';
    el.className = `modules-notice ${notice ? notice.type || 'info' : 'hidden'}`;
  }
  showScreen('modules');
}

function showNamePrompt() {
  const input = document.getElementById('trainee-name-input');
  if (input && engine.traineeName && engine.traineeName !== 'Trainee') input.value = engine.traineeName;
  showScreen('namePrompt');
  input?.focus();
}

function bindUI() {
  // Main menu
  document.querySelectorAll('#main-menu [data-action]').forEach((btn) => {
    btn.addEventListener('click', () => handleMenuAction(btn.dataset.action));
  });

  // Every sub-screen BACK button → main menu (Training Menu BACK included)
  document.querySelectorAll('.screen [data-action="back-menu"]').forEach((btn) => {
    btn.addEventListener('click', goToMainMenu);
  });

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyLanguage(btn.dataset.lang));
  });

  // Training Menu: one delegated listener → every card is live, none can be missed
  document.getElementById('modules-menu')?.addEventListener('click', (e) => {
    const card = e.target.closest('.module-card');
    if (!card) return;
    startModuleFromMenu(card.dataset.module);
  });

  // Tutorial: tabs + start button bound ONCE (previously re-bound on every open)
  document.querySelectorAll('#tutorial-menu .tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tutorial-menu .tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderTutorialTab(btn.dataset.tab);
    });
  });
  document.querySelector('#tutorial-menu [data-action="start-interactive-tutorial"]')?.addEventListener('click', () => {
    destroyActiveVideo();
    localStorage.setItem('jh_tutorial_completed', '1');
    showNamePrompt();
  });

  // Pause
  document.getElementById('pause-btn')?.addEventListener('click', () => pauseGame());
  document.querySelectorAll('#pause-menu [data-action]').forEach((btn) => {
    btn.addEventListener('click', () => handlePauseAction(btn.dataset.action));
  });

  // Assessment / certificate
  document.getElementById('btn-continue-assess')?.addEventListener('click', onAssessmentContinue);
  document.getElementById('btn-assess-training')?.addEventListener('click', () => {
    teardownModule();
    showTrainingMenu();
  });
  document.getElementById('btn-close-cert')?.addEventListener('click', () => {
    teardownModule();
    showTrainingMenu();
  });
  document.getElementById('btn-download-cert')?.addEventListener('click', () => window.print());

  // Name prompt → Training Menu
  const confirmName = () => {
    const name = document.getElementById('trainee-name-input')?.value?.trim() || 'Trainee';
    engine.setTraineeName(name);
    const sn = document.getElementById('setting-name');
    if (sn) sn.value = name;
    showTrainingMenu();
  };
  document.getElementById('btn-confirm-name')?.addEventListener('click', confirmName);
  document.getElementById('trainee-name-input')?.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') confirmName();
  });

  // Settings
  const settingName = document.getElementById('setting-name');
  if (settingName && engine.traineeName) settingName.value = engine.traineeName;
  settingName?.addEventListener('change', (e) => engine.setTraineeName(e.target.value));
  document.getElementById('setting-volume')?.addEventListener('input', (e) => {
    audio.setVolume(e.target.value / 100);
  });
  document.getElementById('setting-quality')?.addEventListener('change', (e) => {
    engine.storage.saveSettings({ ...engine.storage.getSettings(), quality: e.target.value });
    document.getElementById('quality-hint')?.classList.remove('hidden');
  });

  // Esc is often taken by the browser to exit pointer lock — pause when lock is lost mid-play
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && appState === 'module') pauseGame();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (appState === 'module') pauseGame();
      else if (appState === 'paused') resumeGame();
    }
    if (e.code === 'KeyE' && appState === 'module') tryInteract();
    if (e.code === 'Space' && appState === 'module') e.preventDefault();
    // F3 — physics debug (developer)
    if (e.code === 'F3') {
      e.preventDefault();
      if (world?.physics) {
        const on = world.physics.toggleDebug();
        const panel = document.getElementById('physics-debug');
        if (panel) panel.classList.toggle('hidden', !on);
        if (on) world.physics.rebuildDebugHelpers();
      }
    }
    // F4 — FPS monitor (developer)
    if (e.code === 'F4') {
      e.preventDefault();
      document.getElementById('fps-monitor')?.classList.toggle('hidden');
    }
  });
}

function handleMenuAction(action) {
  switch (action) {
    case 'start':
      showNamePrompt();
      break;
    case 'modules':
      showTrainingMenu();
      break;
    case 'progress':
      showProgress();
      break;
    case 'certificates':
      showCertificates();
      break;
    case 'tutorial':
      openTutorial();
      break;
    case 'howto':
      showScreen('howto');
      break;
    case 'settings':
      showScreen('settings');
      break;
  }
}

function handlePauseAction(action) {
  switch (action) {
    case 'resume':
      resumeGame();
      break;
    case 'restart-module':
      if (currentModuleId) {
        const id = currentModuleId;
        hideAllScreens();
        startModule(id);
      }
      break;
    case 'exit-to-training':
      teardownModule();
      showTrainingMenu();
      break;
    case 'main-menu':
      teardownModule();
      goToMainMenu();
      break;
  }
}

/* ------------------------------------------------------------------ *
 * Training module lifecycle
 * ------------------------------------------------------------------ */

function startModuleFromMenu(moduleId) {
  hideAllScreens();
  startModule(moduleId);
}

/**
 * Release everything a running module holds: scenario, timers, scene, colliders,
 * interaction targets, HUD, controls, pointer lock. Safe to call at any time
 * (also when no module is running) — every exit path funnels through here.
 */
function teardownModule() {
  if (assessTimer) {
    clearTimeout(assessTimer);
    assessTimer = null;
  }
  assessBusy = false;
  engine.scenarios.abort();
  currentModuleId = null;
  shownTips.clear();
  if (player) player.disable();
  mobileControls?.hide();
  hud.hide();
  hud.clearNotifications();
  hud.setPrompt(false);
  engine.interaction?.clear();
  world?.exitModule();
  document.exitPointerLock?.();
  world?.clock.getDelta(); // discard the large delta accumulated in menus
  appState = 'menu';
}

function showTip(key) {
  if (!currentModuleId || shownTips.has(key)) return;
  const tip = getTip(currentModuleId, key);
  if (!tip) return;
  shownTips.add(key);
  hud.notify(tip, 'tip', 7000);
}

function startModule(moduleId) {
  const def = MODULES[moduleId];
  if (!def) {
    console.error(`[training] Unknown module "${moduleId}"`);
    showTrainingMenu({ text: 'That training module is not available.', type: 'error' });
    return;
  }

  teardownModule(); // clean slate: no state can leak from a previous run

  try {
    currentModuleId = moduleId;
    engine.startModule(moduleId);
    const moduleData = world.enterModule(moduleId);

    // Player / camera: position, yaw, pitch AND zero roll
    const sp = def.spawn;
    player.spawn(sp.x, sp.z, sp.yaw);
    player.enable();
    player.setPaused(false);
    mobileControls?.show();

    hud.show();
    hud.clearNotifications();
    hud.setModule(moduleName(moduleId));
    hud.setScore(100);

    engine.interaction.clear();
    (moduleData.interactables || []).forEach((item) => {
      engine.interaction.register(item.id, item.object, (id) => {
        engine.scenarios.handleEvent(id);
        audio.playBeep(520, 0.06);
      }, { label: item.label, maxDist: 3.5 });
    });

    const notify = (key, type) => {
      const msg = engine.i18n.t(key) || key;
      hud.notify(msg, type === 'success' ? 'success' : type === 'danger' ? 'danger' : 'warning');
      if (type === 'success') audio.playSuccess();
      else if (type === 'danger' || type === 'warning') audio.playError();
      hud.setScore(engine.score.getPercentage());
    };

    const onVisual = (action, arg) => {
      // A visual callback may fire after the module was left (timers) — ignore then.
      if (currentModuleId !== moduleId || world.moduleData !== moduleData) return;
      switch (action) {
        case 'completeObj':
          if (engine.objectives.completeById(arg)) engine.score.completeObjective();
          hud.setScore(engine.score.getPercentage());
          break;
        case 'extinguish':
          if (moduleData.fire) {
            moduleData.fire.visible = false;
            moduleData.fire.userData.active = false;
          }
          break;
        case 'alarm':
          audio.playAlarm();
          break;
        case 'pickupExt': {
          const ext = moduleData.extinguishers?.find(
            (e) => e.userData.extinguisherType === arg || e.userData.interactId === `ext_${arg}`
          );
          if (ext) {
            ext.visible = false;
            ext.traverse((c) => { if (c.isMesh) c.visible = false; });
          }
          break;
        }
        case 'exit': {
          const door = moduleData.exitDoor || moduleData.group?.getObjectByName('emergency_exit_door');
          if (door) {
            door.visible = false;
            door.userData.solid = false;
            world.physics.colliders.forEach((c) => {
              if (c.object === door || c.id === 'emergency_exit') {
                c.active = false;
                c.isOpen = true;
              }
            });
          }
          break;
        }
        case 'ppeOn':
          moduleData.collectItem?.(arg);
          break;
        case 'wrongItem':
          moduleData.flagWrong?.(arg);
          break;
        case 'machineStop':
          moduleData.stopMachine?.();
          audio.playAlarm();
          break;
        case 'lockout':
          moduleData.lockOut?.();
          break;
        case 'reading':
          hud.notify('Detector: CH₄ 9% LEL · CO 140 ppm — UNSAFE. Do not enter.', 'warning', 5500);
          break;
        case 'tip':
          showTip(arg);
          break;
      }
    };

    const config = def.create({ onNotify: notify, onVisual });
    engine.scenarios.start(config);
    hud.setObjective(engine.objectives.getCurrentText(engine.i18n));
    appState = 'module';
  } catch (err) {
    // Root-cause visibility: log it, then recover to a valid screen with a message
    console.error(`[training] "${moduleId}" failed to start`, err);
    teardownModule();
    showTrainingMenu({
      text: `Could not start "${moduleName(moduleId)}". Please try again or pick another module.`,
      type: 'error',
    });
  }
}

function pauseGame() {
  if (appState !== 'module') return;
  appState = 'paused';
  player.setPaused(true);
  player.sprint = false;
  document.exitPointerLock?.();
  showScreen('pause');
}

function resumeGame() {
  if (appState !== 'paused') return;
  hideAllScreens();
  appState = 'module';
  world.clock.getDelta(); // discard large delta after pause
  player.setPaused(false);
  player.enable();
}

async function openAssessment() {
  if (!currentModuleId) return; // module was left during the transition beat
  player.setPaused(true);
  player.sprint = false;
  player.disable();
  document.exitPointerLock?.();
  hud.setPrompt(false);
  appState = 'assessment';
  assessBusy = false;

  const name = moduleName(currentModuleId);
  lastResult = engine.assessment.buildResult(currentModuleId, name);

  document.getElementById('assess-module').textContent = name;
  document.getElementById('assess-score').textContent = `${lastResult.score}%`;
  document.getElementById('assess-correct').textContent = `${lastResult.correct}/${lastResult.correct + lastResult.incorrect}`;
  document.getElementById('assess-unsafe').textContent = String(lastResult.unsafe);
  document.getElementById('assess-time').textContent = lastResult.time;
  const resEl = document.getElementById('assess-result');
  resEl.textContent = lastResult.passed ? engine.i18n.t('passed') : engine.i18n.t('failed');
  resEl.style.color = lastResult.passed ? 'var(--accent-green)' : 'var(--danger)';

  const quizSection = document.getElementById('quiz-section');
  const quizContainer = document.getElementById('quiz-container');
  quizAnswers = [];
  const quiz = engine.assessment.getQuiz(currentModuleId);
  quizContainer.innerHTML = '';
  quiz.forEach((q, qi) => {
    const div = document.createElement('div');
    div.className = 'quiz-q';
    const p = document.createElement('p');
    p.textContent = `${qi + 1}. ${q.q}`;
    div.appendChild(p);
    q.options.forEach((opt, oi) => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        div.querySelectorAll('.quiz-opt').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        quizAnswers[qi] = oi;
      });
      div.appendChild(btn);
    });
    quizContainer.appendChild(div);
  });
  quizSection.classList.toggle('hidden', quiz.length === 0);
  showScreen('assessment');
}

async function onAssessmentContinue() {
  if (assessBusy || appState !== 'assessment' || !currentModuleId) return;
  assessBusy = true;
  try {
    if (quizAnswers.length) {
      engine.assessment.scoreQuiz(quizAnswers, currentModuleId);
      lastResult = engine.assessment.buildResult(currentModuleId, lastResult.moduleName);
    }

    if (lastResult.passed) {
      lastCert = await engine.certificates.create({
        traineeName: engine.traineeName,
        moduleId: currentModuleId,
        moduleName: lastResult.moduleName,
        score: lastResult.score,
        duration: lastResult.time,
        passed: true,
      });
      await showCertificate(lastCert);
    } else {
      const failedName = lastResult.moduleName;
      const score = lastResult.score;
      teardownModule();
      showTrainingMenu({
        text: `${failedName}: ${engine.i18n.t('failed')} (${score}%). 70% is required — try again.`,
        type: 'error',
      });
    }
  } catch (err) {
    console.error('[training] assessment/certificate failed', err);
    teardownModule();
    showTrainingMenu({ text: 'Could not save your certificate. Please try the module again.', type: 'error' });
  } finally {
    assessBusy = false;
  }
}

async function showCertificate(cert) {
  appState = 'certificate';
  document.getElementById('cert-name').textContent = cert.traineeName;
  document.getElementById('cert-module').textContent = cert.moduleName;
  document.getElementById('cert-score').textContent = `${cert.score}%`;
  document.getElementById('cert-duration').textContent = cert.duration;
  document.getElementById('cert-date').textContent = cert.date;
  document.getElementById('cert-id').textContent = cert.id;

  const qrEl = document.getElementById('cert-qr');
  const payload = JSON.stringify({
    id: cert.id,
    name: cert.traineeName,
    module: cert.moduleName,
    score: cert.score,
    date: cert.date,
    verify: `verify.html?id=${cert.id}`,
  });
  await generateQR(payload, qrEl);
  showScreen('certificate');
}

async function showProgress() {
  const certs = await engine.certificates.list();
  const el = document.getElementById('progress-content');
  el.replaceChildren();
  const p = document.createElement('p');
  p.style.cssText = 'color:var(--text-secondary);margin-bottom:1rem;';
  p.textContent = 'Certificates earned: ';
  const strong = document.createElement('strong');
  strong.style.color = 'var(--accent-green)';
  strong.textContent = String(certs.length);
  p.appendChild(strong);
  el.appendChild(p);
  const ul = document.createElement('ul');
  ul.style.listStyle = 'none';
  if (!certs.length) {
    const li = document.createElement('li');
    li.textContent = 'No training completed yet.';
    ul.appendChild(li);
  } else {
    certs.forEach((c) => {
      const li = document.createElement('li');
      li.style.cssText = 'margin-bottom:0.5rem;font-size:0.9rem;';
      li.textContent = `${c.moduleName} — ${c.score}% — ${c.date}`;
      ul.appendChild(li);
    });
  }
  el.appendChild(ul);
  showScreen('progress');
}

async function showCertificates() {
  const certs = await engine.certificates.list();
  const el = document.getElementById('certificates-list');
  el.replaceChildren();

  if (!certs.length) {
    const p = document.createElement('p');
    p.style.color = 'var(--text-muted)';
    p.textContent = 'No certificates yet. Complete a module to earn one.';
    el.appendChild(p);
    showScreen('certificates');
    return;
  }

  // BUGFIX: traineeName is free-text the trainee typed in; the previous
  // version injected it via innerHTML (stored-XSS). Build the DOM with
  // textContent instead, same pattern already used in showProgress().
  certs.forEach((c) => {
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(0,0,0,0.25);padding:0.75rem;border-radius:8px;margin-bottom:0.5rem;font-size:0.85rem;';

    const idLine = document.createElement('strong');
    idLine.style.color = 'var(--accent-cyan)';
    idLine.textContent = c.id;
    card.appendChild(idLine);
    card.appendChild(document.createElement('br'));

    card.appendChild(document.createTextNode(`${c.traineeName} · ${c.moduleName}`));
    card.appendChild(document.createElement('br'));

    card.appendChild(document.createTextNode(`Score: ${c.score}% · ${c.date}`));

    el.appendChild(card);
  });

  showScreen('certificates');
}



// ---------- Tutorial ----------
let activeVideoIframe = null;

function openTutorial() {
  document.querySelectorAll('#tutorial-menu .tab-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === 'controls');
  });
  showScreen('tutorial');
  renderTutorialTab('controls');
}

function renderTutorialTab(tab) {
  const panel = document.getElementById('tutorial-panel');
  if (!panel) return;
  destroyActiveVideo();
  if (tab === 'controls') {
    panel.innerHTML = `
      <div class="t-card"><h4>Desktop</h4><p><kbd>W A S D</kbd> Move · <kbd>Mouse</kbd> Look · <kbd>Shift</kbd> Sprint · <kbd>E</kbd> Interact · <kbd>Esc</kbd> Pause · <kbd>Space</kbd> Jump</p></div>
      <div class="t-card"><h4>Mobile</h4><p>Left joystick — move · Right area — look · Buttons — Sprint / Jump / Interact</p></div>
      <div class="t-card"><h4>Goal</h4><p>Pick a training module, complete the interactive objectives, pass the assessment and earn a certificate.</p></div>
    `;
  } else if (tab === 'safety') {
    panel.innerHTML = [
      ['PPE', 'Wear the correct personal protective equipment before entering hazard areas. Helmet, shoes, gloves, goggles, and vest protect against common injuries.'],
      ['Fire Safety', 'Raise the alarm, use the correct extinguisher (PASS), approach from upwind, evacuate if the fire grows.'],
      ['Gas Safety', 'Never enter a gas hazard without testing. Use detectors, buddy system, and evacuate to a safe zone.'],
      ['Machinery', 'Stay outside danger zones until isolation (lockout/tagout). Use emergency stops only when trained.'],
      ['Evacuation', 'Follow marked routes to the assembly point. Do not re-enter until cleared.'],
      ['Confined Space', 'Requires permit, atmosphere testing, PPE, and a standby person — never enter alone.'],
    ].map(([h, p]) => `<div class="t-card"><h4>${h}</h4><p>${p}</p></div>`).join('');
  } else if (tab === 'scoring') {
    panel.innerHTML = `
      <div class="t-card"><h4>Start score</h4><p>100 points</p></div>
      <div class="t-card"><h4>Correct action</h4><p>+5 · Wrong −10 · Unsafe −15 · Objective +5 · Evacuation +10</p></div>
      <div class="t-card"><h4>Pass mark</h4><p>70% or higher after scenario + knowledge check</p></div>
    `;
  } else if (tab === 'videos') {
    if (!navigator.onLine) {
      panel.innerHTML = '<p class="offline-video-msg">Internet connection required to play training videos. The rest of the simulator works offline.</p>';
      return;
    }
    panel.innerHTML = `<div class="video-grid">${TRAINING_VIDEOS.map((v) => `
      <div class="video-card" data-vid="${v.id}">
        <div class="video-thumb" data-vid="${v.id}">▶</div>
        <div class="video-meta"><div class="cat">${v.category}</div><h4>${v.title}</h4></div>
        <div class="video-iframe-wrap hidden" data-wrap="${v.id}"></div>
      </div>`).join('')}</div>`;
    panel.querySelectorAll('.video-card').forEach((card) => {
      card.addEventListener('click', () => loadVideo(card.dataset.vid, card));
    });
  }
}

function destroyActiveVideo() {
  if (activeVideoIframe?.parentNode) activeVideoIframe.parentNode.innerHTML = '';
  activeVideoIframe = null;
  document.querySelectorAll('.video-iframe-wrap').forEach((w) => {
    w.classList.add('hidden');
    w.innerHTML = '';
  });
  document.querySelectorAll('.video-thumb').forEach((t) => t.classList.remove('hidden'));
}

function loadVideo(id, card) {
  if (!isValidVideoId(id) || !navigator.onLine) return;
  destroyActiveVideo();
  const url = getEmbedUrl(id);
  if (!url) return;
  const wrap = card.querySelector('.video-iframe-wrap');
  const thumb = card.querySelector('.video-thumb');
  if (!wrap) return;
  thumb?.classList.add('hidden');
  wrap.classList.remove('hidden');
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  iframe.title = 'Training video';
  wrap.appendChild(iframe);
  activeVideoIframe = iframe;
}

let _fpsFrames = 0;
let _fpsLast = performance.now();

function tryInteract() {
  if (appState === 'module') {
    const ok = engine.interaction.interact();
    if (ok) audio.playBeep(600, 0.05);
  }
}

function loop() {
  requestAnimationFrame(loop);
  const dt = world?.delta ?? 0.016;

  // FPS monitor
  _fpsFrames++;
  const now = performance.now();
  if (now - _fpsLast >= 500) {
    const fps = Math.round((_fpsFrames * 1000) / (now - _fpsLast));
    _fpsFrames = 0;
    _fpsLast = now;
    const el = document.getElementById('fps-monitor');
    if (el && !el.classList.contains('hidden') && world?.renderer) {
      const info = world.renderer.info;
      el.textContent = `${fps} FPS | ${info.render.calls} calls | ${info.memory.geometries} geo`;
    }
  }

  if (!world) return;

  if (world.mode === 'menu') {
    // Non-interactive backdrop: slow orbit around the scenery while any menu is open
    const t0 = now * 0.00015;
    world.camera.position.set(Math.sin(t0) * 28, 12, Math.cos(t0) * 28 + 5);
    world.camera.lookAt(0, 2, -10);
  } else if (appState === 'module') {
    player.update(dt);
    engine.interaction.update();
    world.moduleData?.update?.(dt, now / 1000);
  } else if (appState === 'paused' || appState === 'completing' || appState === 'assessment' || appState === 'certificate') {
    // Scene stays visible behind the overlay; keep ambient animation (belt, rotor, fire) alive
    // only while not paused so pausing truly freezes the training scene.
    if (appState !== 'paused') world.moduleData?.update?.(dt, now / 1000);
  }

  // Physics debug HUD
  const dbg = document.getElementById('physics-debug');
  if (dbg && world?.physics?.debug && player) {
    const s = world.physics.getDebugState(player);
    dbg.innerHTML = `
      <div><b>PHYSICS DEBUG</b> (F3)</div>
      <div>Grounded: ${s.grounded ? 'YES' : 'NO'}</div>
      <div>Vel Y: ${s.velocityY}</div>
      <div>Speed: ${s.speed}</div>
      <div>Slope: ${s.slope}</div>
      <div>Surface: ${s.surface}</div>
      <div>Hazard: ${s.hazards}</div>
      <div>Colliders: ${s.colliders} | Triggers: ${s.triggers}</div>
      <div>Module: ${currentModuleId || 'none'}</div>
    `;
  }

  if (world.moduleData?.fire?.userData?.active && appState !== 'paused') {
    const f = world.moduleData.fire;
    f.scale.y = 1 + Math.sin(now * 0.01) * 0.12;
    f.rotation.y += dt * 0.5;
  }

  world.render();
}

// Dev-only QA hook (tree-shaken from production builds).
if (import.meta.env?.DEV) {
  window.__jh = {
    get appState() { return appState; },
    get currentModuleId() { return currentModuleId; },
    engine,
    get world() { return world; },
    get player() { return player; },
    tryInteract,
  };
}

init().catch((err) => {
  console.error('[init] failed', err);
  const text = document.getElementById('loading-text');
  if (text) text.textContent = 'Failed to start. Please reload the page.';
});
