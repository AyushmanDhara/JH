/**
 * Training module environments — fire, gas, PPE, machinery.
 * Visual meshes marked userData.physics / noCollision explicitly.
 */
import * as THREE from 'three';
import { createFire, createExtinguisher } from './City.js';

const mat = {
  wall: new THREE.MeshStandardMaterial({ color: 0x3a4550, roughness: 0.8 }),
  floor: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.9 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x556070, roughness: 0.4, metalness: 0.7 }),
  warning: new THREE.MeshStandardMaterial({ color: 0xff9900, emissive: 0x442200, emissiveIntensity: 0.3 }),
  danger: new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x440000, emissiveIntensity: 0.4 }),
  cyan: new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.25 }),
  green: new THREE.MeshStandardMaterial({ color: 0x226622, roughness: 0.7 }),
  lamp: new THREE.MeshBasicMaterial({ color: 0xfff6e0 }),
  yellowPaint: new THREE.MeshBasicMaterial({ color: 0xffc400 }),
  redPaint: new THREE.MeshBasicMaterial({ color: 0xff3b30 }),
};

function solidBox(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.solid = true;
  m.userData.physics = { body: 'static', shape: 'box' };
  return m;
}

function floorBox(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  m.userData.noCollision = true; // walked via ground probe / dedicated floor collider
  m.userData.floorSurface = true;
  return m;
}

function vfxNoCollide(obj) {
  obj.traverse((c) => {
    if (c.isMesh) {
      c.userData.noCollision = true;
      c.userData.solid = false;
    }
  });
  obj.userData.noCollision = true;
  return obj;
}

function markVfx(group) {
  return vfxNoCollide(group);
}

function noCollide(obj) {
  obj.traverse((c) => {
    if (c.isMesh) {
      c.userData.noCollision = true;
      c.userData.solid = false;
    }
  });
  obj.userData.noCollision = true;
  return obj;
}

/** Draw into a canvas and wrap it as a texture. Returns null if canvas is unavailable. */
function makeCanvasTexture(w, h, draw) {
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    draw(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex._canvas = c;
    return tex;
  } catch (_) {
    return null;
  }
}

/** Camera-facing text label (sprite). Never solid, never blocks interaction rays. */
function makeLabel(text, { width = 1.9, height = 0.38, color = '#e8f4ff', border = '#00e5ff' } = {}) {
  const tex = makeCanvasTexture(512, Math.round((512 * height) / width), (ctx, w, h) => {
    ctx.fillStyle = 'rgba(8,18,32,0.85)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.round(h * 0.44)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
  if (!tex) return new THREE.Group();
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  m.userData.ownsMap = true;
  const sp = new THREE.Sprite(m);
  sp.scale.set(width, height, 1);
  sp.userData.noCollision = true;
  return sp;
}

/** Flat textured plane (signs, boards, floor markings). Never solid. */
function makePanel(w, h, tex, fallbackColor = 0x223344) {
  const m = new THREE.MeshBasicMaterial(tex ? { map: tex } : { color: fallbackColor });
  if (tex) m.userData.ownsMap = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.userData.noCollision = true;
  mesh.userData.solid = false;
  return mesh;
}

/**
 * Give an enclosed training room its own lighting.
 * BUGFIX: rooms relied purely on the outdoor sun/ambient rig, so enclosed
 * rooms (gas tunnel, PPE lab, machinery hall) rendered almost black.
 */
function addRoomLights(group, spots, { color = 0xfff1d6, intensity = 30, distance = 24, hemi = 0.75 } = {}) {
  if (hemi) group.add(new THREE.HemisphereLight(0xdde8ff, 0x445566, hemi));
  spots.forEach(([x, y, z]) => {
    const l = new THREE.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z);
    group.add(l);
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.4), mat.lamp);
    fixture.position.set(x, y + 0.3, z);
    noCollide(fixture);
    group.add(fixture);
  });
}

function addCeiling(group, w, d, y = 5.1) {
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), mat.wall);
  ceil.position.set(0, y, 0);
  ceil.userData.noCollision = true; // visual only — no ceiling collider needed at 5 m
  group.add(ceil);
}

/** Yellow/red painted rectangle outline on the floor (visual only). */
function floorRect(group, material, cx, cz, w, d, t = 0.2) {
  [[0, -d / 2, w, t], [0, d / 2, w, t], [-w / 2, 0, t, d], [w / 2, 0, t, d]].forEach(([dx, dz, sw, sd]) => {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(sw, sd), material);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(cx + dx, 0.115, cz + dz);
    noCollide(strip);
    group.add(strip);
  });
}

/**
 * Fire scenario: room + openable south door + outdoor assembly beyond z=9.
 */
export function buildFireScenario() {
  const group = new THREE.Group();
  group.name = 'FireScenario';

  // Indoor floor (top ≈ 0.1)
  group.add(floorBox(24, 0.2, 18, mat.floor, 0, 0, 0));
  // Outdoor floor beyond exit (z 8.5..16.5) — fenced assembly yard, not open-ended
  group.add(floorBox(24, 0.2, 8, mat.floor, 0, 0, 12.5));

  // Walls — north, west, east solid; south has door gap
  group.add(solidBox(24, 6, 0.3, mat.wall, 0, 3, -9));
  group.add(solidBox(0.3, 6, 18, mat.wall, -12, 3, 0));
  group.add(solidBox(0.3, 6, 18, mat.wall, 12, 3, 0));
  // South wall with gap for door (two segments)
  group.add(solidBox(10, 6, 0.3, mat.wall, -7, 3, 9));
  group.add(solidBox(10, 6, 0.3, mat.wall, 7, 3, 9));

  // Machinery
  group.add(solidBox(4, 2.5, 3, mat.steel, -6, 1.25, -3));
  group.add(solidBox(3, 3, 2, mat.steel, -6, 1.5, 3));

  const fire = markVfx(createFire(new THREE.Vector3(-5.5, 0, -1)));
  group.add(fire);

  // Room lighting + a flickering glow from the fire itself
  addRoomLights(group, [[-6, 5, 0], [6, 5, 0], [0, 5, -6], [0, 5, 6]], { intensity: 26, hemi: 0.5 });
  const fireLight = new THREE.PointLight(0xff6a1a, 30, 12, 2);
  fireLight.position.set(-5.5, 1.6, -1);
  group.add(fireLight);

  const types = ['CO2', 'Foam', 'DryPowder'];
  const extinguishers = [];
  types.forEach((t, i) => {
    const ext = createExtinguisher(t);
    ext.position.set(8, 0, -6 + i * 3);
    ext.userData.interactId = `ext_${t}`;
    // extinguisher is interactable, not a blocking wall — no solid on whole group
    ext.traverse((c) => {
      if (c.isMesh) {
        c.userData.noCollision = true;
        c.userData.solid = false;
      }
    });
    group.add(ext);
    extinguishers.push(ext);
  });

  // Door (solid until opened)
  const exitDoor = solidBox(2.2, 3, 0.25, mat.cyan, 0, 1.5, 9);
  exitDoor.userData.interactId = 'emergency_exit';
  exitDoor.userData.isDoor = true;
  exitDoor.name = 'emergency_exit_door';
  group.add(exitDoor);

  const alarm = solidBox(0.3, 0.3, 0.15, mat.danger, -11.7, 1.8, 2);
  alarm.userData.interactId = 'alarm_button';
  // small — still solid ok
  group.add(alarm);

  group.add(solidBox(1.5, 0.5, 0.1, mat.cyan, 0, 3.5, 8.7));

  // Assembly on outdoor pad (y above floor)
  const assembly = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 16),
    new THREE.MeshStandardMaterial({ color: 0x226622, transparent: true, opacity: 0.65, depthWrite: false })
  );
  assembly.rotation.x = -Math.PI / 2;
  assembly.position.set(0, 0.12, 14);
  assembly.userData.interactId = 'assembly_point';
  assembly.userData.noCollision = true;
  group.add(assembly);

  const wl1 = solidBox(0.3, 0.3, 0.3, mat.danger, -10, 5, -8);
  const wl2 = solidBox(0.3, 0.3, 0.3, mat.danger, 10, 5, -8);
  group.add(wl1, wl2);

  // Outdoor side bounds so player stays near assembly (fenced assembly yard)
  group.add(solidBox(0.3, 4, 8, mat.wall, -12, 2, 12.5));
  group.add(solidBox(0.3, 4, 8, mat.wall, 12, 2, 12.5));
  group.add(solidBox(24, 4, 0.3, mat.wall, 0, 2, 16.5));

  return {
    group,
    fire,
    extinguishers,
    exitDoor,
    update(dt, t) {
      fireLight.intensity = fire.userData.active ? 30 + Math.sin(t * 13) * 5 + Math.sin(t * 7.3) * 3 : 0;
    },
    interactables: [
      { id: 'ext_CO2', object: extinguishers[0], label: 'PICK UP CO2 EXTINGUISHER' },
      { id: 'ext_Foam', object: extinguishers[1], label: 'PICK UP FOAM EXTINGUISHER' },
      { id: 'ext_DryPowder', object: extinguishers[2], label: 'PICK UP DRY POWDER' },
      { id: 'alarm_button', object: alarm, label: 'ACTIVATE ALARM' },
      { id: 'emergency_exit', object: exitDoor, label: 'USE EMERGENCY EXIT' },
      { id: 'assembly_point', object: assembly, label: 'REACH ASSEMBLY POINT' },
      { id: 'fire', object: fire, label: 'EXTINGUISH FIRE' },
    ],
  };
}

/**
 * Gas leak / confined-space tunnel with closed ends and bounds.
 */
export function buildGasScenario() {
  const group = new THREE.Group();
  group.name = 'GasScenario';

  group.add(floorBox(8, 0.2, 40, mat.floor, 0, 0, 0));
  group.add(solidBox(8, 5, 0.3, mat.wall, 0, 2.5, -20));
  group.add(solidBox(0.3, 5, 40, mat.wall, -4, 2.5, 0));
  group.add(solidBox(0.3, 5, 40, mat.wall, 4, 2.5, 0));
  group.add(solidBox(8, 0.3, 40, mat.wall, 0, 5, 0)); // ceiling
  // Closed south end (exit door area)
  group.add(solidBox(3, 5, 0.3, mat.wall, -2.5, 2.5, 20));
  group.add(solidBox(3, 5, 0.3, mat.wall, 2.5, 2.5, 20));

  // Tunnel lighting: the solid ceiling blocks the sun, so light it from inside.
  addRoomLights(group, [[0, 4.3, -16], [0, 4.3, -8], [0, 4.3, 0], [0, 4.3, 8], [0, 4.3, 16]], {
    intensity: 22, distance: 14, hemi: 0.7,
  });

  const hazard = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 8),
    new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })
  );
  hazard.rotation.x = -Math.PI / 2;
  hazard.position.set(0, 0.12, -8);
  hazard.userData.noCollision = true;
  group.add(hazard);

  const sign = solidBox(1.5, 1, 0.1, mat.warning, -3.5, 2, 5);
  sign.userData.interactId = 'gas_sign';
  group.add(sign);

  const detector = solidBox(0.4, 0.6, 0.2, mat.cyan, 3.7, 1.5, 2);
  detector.userData.interactId = 'gas_detector';
  group.add(detector);

  const ppe = solidBox(1.5, 1.2, 0.8, mat.steel, 3, 0.6, 10);
  ppe.userData.interactId = 'ppe_station';
  group.add(ppe);

  const alarm = solidBox(0.3, 0.3, 0.15, mat.danger, -3.7, 2, 8);
  alarm.userData.interactId = 'gas_alarm';
  group.add(alarm);

  const safe = new THREE.Mesh(
    new THREE.CircleGeometry(2, 16),
    new THREE.MeshStandardMaterial({ color: 0x226622, transparent: true, opacity: 0.5, depthWrite: false })
  );
  safe.rotation.x = -Math.PI / 2;
  safe.position.set(0, 0.12, 16);
  safe.userData.interactId = 'safe_zone';
  safe.userData.noCollision = true;
  group.add(safe);

  const exit = solidBox(2, 3, 0.25, mat.cyan, 0, 1.5, 19.9);
  exit.userData.interactId = 'gas_exit';
  exit.userData.isDoor = true;
  group.add(exit);

  const mist = new THREE.Mesh(
    new THREE.SphereGeometry(3, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x88aa88, transparent: true, opacity: 0.2, depthWrite: false })
  );
  mist.position.set(0, 1.5, -8);
  mist.userData.noCollision = true;
  group.add(mist);

  group.add(solidBox(3, 1, 0.15, mat.warning, -2, 0.5, -2));
  group.add(solidBox(3, 1, 0.15, mat.warning, 2, 0.5, -2));

  return {
    group,
    interactables: [
      { id: 'gas_sign', object: sign, label: 'READ WARNING' },
      { id: 'ppe_station', object: ppe, label: 'SELECT PPE' },
      { id: 'gas_detector', object: detector, label: 'TAKE GAS DETECTOR' },
      { id: 'gas_alarm', object: alarm, label: 'ACTIVATE ALARM' },
      { id: 'safe_zone', object: safe, label: 'ENTER SAFE ZONE' },
      { id: 'gas_exit', object: exit, label: 'EMERGENCY EXIT' },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * PPE laboratory
 * ------------------------------------------------------------------ */

const PPE_INFO = {
  helmet:  { label: 'HELMET',          row: 'HEAD',  text: 'Safety helmet — falling objects, low roofs' },
  shoes:   { label: 'SAFETY SHOES',    row: 'FEET',  text: 'Steel-toe shoes — crush, sharp & hot surfaces' },
  gloves:  { label: 'GLOVES',          row: 'HANDS', text: 'Protective gloves — cuts, chemicals, heat' },
  goggles: { label: 'GOGGLES',         row: 'EYES',  text: 'Safety goggles — dust, sparks, splashes' },
  vest:    { label: 'REFLECTIVE VEST', row: 'BODY',  text: 'Hi-vis vest — be seen near vehicles & machines' },
};
const PPE_ORDER = ['helmet', 'shoes', 'gloves', 'goggles', 'vest'];

function ppeMaterial(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...extra });
}

/** Small recognisable prop for each PPE item (all visual-only). */
function makePPEItem(id) {
  const g = new THREE.Group();
  g.name = `ppe_${id}`;
  const add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  switch (id) {
    case 'helmet': {
      const shell = ppeMaterial(0xffcc00, { roughness: 0.35 });
      add(new THREE.SphereGeometry(0.3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), shell, 0, -0.05, 0);
      add(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 22), shell, 0, -0.06, 0.04);
      add(new THREE.BoxGeometry(0.07, 0.05, 0.52), shell, 0, 0.25, 0);
      break;
    }
    case 'shoes': {
      const leather = ppeMaterial(0x3a3a3a, { roughness: 0.7 });
      const sole = ppeMaterial(0x111111);
      [-0.16, 0.16].forEach((x) => {
        add(new THREE.BoxGeometry(0.2, 0.14, 0.44), leather, x, -0.08, 0.02);
        add(new THREE.BoxGeometry(0.2, 0.22, 0.2), leather, x, 0.06, -0.1);
        add(new THREE.BoxGeometry(0.22, 0.04, 0.46), sole, x, -0.17, 0.02);
        add(new THREE.BoxGeometry(0.2, 0.05, 0.14), ppeMaterial(0x999999, { metalness: 0.7 }), x, -0.05, 0.2);
      });
      break;
    }
    case 'gloves': {
      const leather = ppeMaterial(0xc98a3c, { roughness: 0.8 });
      [-0.15, 0.15].forEach((x) => {
        add(new THREE.BoxGeometry(0.22, 0.06, 0.24), leather, x, 0, 0);
        for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.045, 0.05, 0.16), leather, x - 0.075 + i * 0.05, 0, 0.19);
        add(new THREE.CylinderGeometry(0.11, 0.12, 0.14, 12), ppeMaterial(0x2b5d8a), x, 0, -0.17, Math.PI / 2, 0, 0);
      });
      break;
    }
    case 'goggles': {
      add(new THREE.TorusGeometry(0.27, 0.025, 8, 28), ppeMaterial(0x222222), 0, 0, 0, Math.PI / 2, 0, 0);
      const lens = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.2 });
      [-0.13, 0.13].forEach((x) => {
        add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 18), lens, x, 0, 0.27, Math.PI / 2, 0, 0);
        add(new THREE.TorusGeometry(0.1, 0.02, 8, 18), ppeMaterial(0x222222), x, 0, 0.3);
      });
      break;
    }
    case 'vest': {
      add(new THREE.BoxGeometry(0.5, 0.6, 0.16), ppeMaterial(0xff6a00, { emissive: 0x331500, emissiveIntensity: 0.3 }));
      const strip = ppeMaterial(0xe8f0ff, { metalness: 0.6, roughness: 0.25 });
      add(new THREE.BoxGeometry(0.52, 0.07, 0.17), strip, 0, 0.1, 0);
      add(new THREE.BoxGeometry(0.52, 0.07, 0.17), strip, 0, -0.14, 0);
      break;
    }
    case 'sandals': {
      const tan = ppeMaterial(0xb08a5a, { roughness: 0.9 });
      [-0.16, 0.16].forEach((x) => {
        add(new THREE.BoxGeometry(0.18, 0.03, 0.44), tan, x, -0.15, 0);
        add(new THREE.BoxGeometry(0.2, 0.02, 0.05), ppeMaterial(0x7a5a33), x, -0.12, 0.05);
        add(new THREE.BoxGeometry(0.2, 0.02, 0.05), ppeMaterial(0x7a5a33), x, -0.12, -0.08);
      });
      break;
    }
    default:
      add(new THREE.BoxGeometry(0.4, 0.4, 0.4), ppeMaterial(0x888888));
  }
  return noCollide(g);
}

/**
 * Dedicated PPE laboratory: five required items + one wrong item (sandals),
 * a live checklist board, labels and per-item feedback.
 */
export function buildPPEScenario() {
  const group = new THREE.Group();
  group.name = 'PPEScenario';

  group.add(floorBox(16, 0.2, 14, mat.floor, 0, 0, 0));
  group.add(solidBox(16, 5, 0.3, mat.wall, 0, 2.5, -7));
  group.add(solidBox(16, 5, 0.3, mat.wall, 0, 2.5, 7));
  group.add(solidBox(0.3, 5, 14, mat.wall, -8, 2.5, 0));
  group.add(solidBox(0.3, 5, 14, mat.wall, 8, 2.5, 0));
  addCeiling(group, 16, 14);
  addRoomLights(group, [[-4, 4.5, -2], [4, 4.5, -2], [0, 4.5, 3.5]]);

  // Live checklist board on the north wall
  const collected = new Set();
  const drawBoard = (ctx, w, h) => {
    ctx.fillStyle = '#0b1a2e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 52px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('REQUIRED PPE CHECKLIST', 40, 62);
    PPE_ORDER.forEach((id, i) => {
      const y = 140 + i * 78;
      const done = collected.has(id);
      ctx.strokeStyle = done ? '#2ee66b' : '#7f93ab';
      ctx.lineWidth = 6;
      ctx.strokeRect(40, y - 24, 48, 48);
      if (done) {
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(62, y + 14);
        ctx.lineTo(84, y - 16);
        ctx.stroke();
      }
      ctx.fillStyle = done ? '#2ee66b' : '#e8f4ff';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText(PPE_INFO[id].row, 112, y);
      ctx.fillStyle = done ? '#9be8b5' : '#9fb3c8';
      ctx.font = '32px sans-serif';
      ctx.fillText(PPE_INFO[id].text, 300, y);
    });
  };
  const boardTex = makeCanvasTexture(1024, 560, drawBoard);
  const board = makePanel(7.2, 3.94, boardTex);
  board.position.set(0, 2.9, -6.8);
  group.add(board);

  const defs = [
    ...PPE_ORDER.map((id, i) => ({ id, x: -4 + i * 2, z: -2 })),
    { id: 'sandals', x: 0, z: 2.5 },
  ];

  const items = {};
  const labels = {};
  const interactables = [];
  const wrongUntil = {};

  defs.forEach(({ id, x, z }) => {
    group.add(solidBox(0.7, 0.15, 0.7, mat.steel, x, 0.08, z)); // pedestal
    const item = makePPEItem(id);
    item.position.set(x, 0.55, z);
    group.add(item);
    items[id] = item;

    const label = makeLabel(id === 'sandals' ? 'SANDALS' : PPE_INFO[id].label, { width: id === 'vest' ? 2.3 : 1.9 });
    label.position.set(x, 1.35, z);
    group.add(label);
    labels[id] = label;

    interactables.push({
      id,
      object: item,
      label: `PICK UP ${id === 'sandals' ? 'SANDALS' : PPE_INFO[id].label}`,
    });
  });

  const tint = (item, hex, intensity) => item.traverse((c) => {
    if (c.isMesh && c.material?.emissive) {
      c.material.emissive.setHex(hex);
      c.material.emissiveIntensity = intensity;
    }
  });

  return {
    group,
    interactables,
    items,
    /** Correct item picked: tick it on the board, turn it green. */
    collectItem(id) {
      if (!items[id] || collected.has(id)) return;
      collected.add(id);
      tint(items[id], 0x00ff66, 0.45);
      const old = labels[id];
      const fresh = makeLabel(`✓ ${PPE_INFO[id].label}`, { width: id === 'vest' ? 2.5 : 2.1, color: '#9be8b5', border: '#2ee66b' });
      fresh.position.copy(old.position);
      group.remove(old);
      old.material?.map?.dispose();
      old.material?.dispose();
      group.add(fresh);
      labels[id] = fresh;
      if (boardTex) {
        drawBoard(boardTex._canvas.getContext('2d'), 1024, 560);
        boardTex.needsUpdate = true;
      }
    },
    /** Wrong item picked: flash red briefly. */
    flagWrong(id) {
      if (!items[id]) return;
      tint(items[id], 0xff2222, 0.7);
      wrongUntil[id] = performance.now() + 1200;
    },
    update(dt, t) {
      Object.entries(items).forEach(([id, it]) => {
        it.rotation.y = t * 0.6;
        it.position.y = 0.55 + Math.sin(t * 1.6 + it.position.x) * 0.03;
        if (wrongUntil[id] && performance.now() > wrongUntil[id]) {
          tint(it, 0x000000, 0);
          wrongUntil[id] = 0;
        }
      });
    },
  };
}

/* ------------------------------------------------------------------ *
 * Machinery hall
 * ------------------------------------------------------------------ */

function makeHazardSignTexture() {
  return makeCanvasTexture(512, 340, (ctx, w, h) => {
    ctx.fillStyle = '#ffc400';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#111';
    ctx.beginPath(); // warning triangle
    ctx.moveTo(w / 2, 34);
    ctx.lineTo(w / 2 + 62, 150);
    ctx.lineTo(w / 2 - 62, 150);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffc400';
    ctx.font = 'bold 76px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', w / 2, 106);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('DANGER', w / 2, 194);
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('MOVING MACHINERY', w / 2, 240);
    ctx.font = '26px sans-serif';
    ctx.fillText('PPE REQUIRED · STOP & LOCK OUT BEFORE SERVICE', w / 2, 290);
  });
}

/**
 * Machinery training hall: live conveyor + rotor that keep running until the
 * trainee hits the e-stop, then a lockout/tagout point.
 */
export function buildMachineryScenario() {
  const group = new THREE.Group();
  group.name = 'MachineryScenario';

  group.add(floorBox(18, 0.2, 14, mat.floor, 0, 0, 0));
  group.add(solidBox(18, 5, 0.3, mat.wall, 0, 2.5, -7));
  group.add(solidBox(18, 5, 0.3, mat.wall, 0, 2.5, 7));
  group.add(solidBox(0.3, 5, 14, mat.wall, -9, 2.5, 0));
  group.add(solidBox(0.3, 5, 14, mat.wall, 9, 2.5, 0));
  addCeiling(group, 18, 14);
  addRoomLights(group, [[-5, 4.5, 0], [5, 4.5, 0], [0, 4.5, 4.5]]);

  // Painted floor: outer caution lane (yellow) and inner danger zone (red)
  floorRect(group, mat.yellowPaint, 0, 0, 9, 6);
  floorRect(group, mat.redPaint, 0, 0, 4.5, 3.2, 0.14);
  const zoneTex = makeCanvasTexture(512, 96, (ctx, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffc400';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DANGER ZONE', w / 2, h / 2);
  });
  if (zoneTex) {
    const zoneText = makePanel(3.4, 0.64, zoneTex);
    zoneText.material.transparent = true;
    zoneText.rotation.x = -Math.PI / 2;
    zoneText.position.set(0, 0.12, 2.35);
    group.add(zoneText);
  }

  // Conveyor with a moving belt surface + crates
  const conv = solidBox(8, 0.4, 1.5, mat.steel, 0, 0.6, 0);
  conv.userData.interactId = 'conveyor';
  group.add(conv);
  const beltTex = makeCanvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#1b1d21';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a3f47';
    for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 6, h);
  });
  if (beltTex) {
    beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
    beltTex.repeat.set(10, 1);
  }
  const belt = makePanel(7.8, 1.3, beltTex, 0x1b1d21);
  belt.rotation.x = -Math.PI / 2;
  belt.position.set(0, 0.805, 0);
  belt.material = new THREE.MeshStandardMaterial(beltTex ? { map: beltTex, roughness: 0.9 } : { color: 0x1b1d21 });
  belt.material.userData.ownsMap = !!beltTex;
  group.add(belt);
  const crates = [-2.4, 0.2, 2.6].map((x) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), ppeMaterial(0x9a6b3a, { roughness: 0.9 }));
    c.position.set(x, 1.03, 0);
    c.castShadow = true;
    noCollide(c);
    group.add(c);
    return c;
  });

  // Rotating machine: body + spinning rotor + status beacon
  group.add(solidBox(2.5, 2, 2.5, mat.steel, -5, 1, 0));
  const rotor = new THREE.Group();
  rotor.position.set(-5, 2.3, 0);
  const bladeMat = ppeMaterial(0xb0b8c4, { metalness: 0.8, roughness: 0.3 });
  rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 12), bladeMat));
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.26), bladeMat);
    blade.rotation.y = (i * Math.PI) / 4;
    rotor.add(blade);
  }
  noCollide(rotor);
  group.add(rotor);
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x22ff66, emissive: 0x22ff66, emissiveIntensity: 1.2 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 12), beaconMat);
  beacon.position.set(-4.2, 2.16, -1.0);
  noCollide(beacon);
  group.add(beacon);
  const beaconLight = new THREE.PointLight(0x22ff66, 8, 7, 2);
  beaconLight.position.set(-4.2, 2.7, -1.0);
  group.add(beaconLight);

  // Hazard sign on a post, facing the entry side (readable from spawn)
  const hazardSign = solidBox(1.5, 1, 0.1, mat.warning, -1.8, 1.9, 3.6);
  hazardSign.userData.interactId = 'hazard_sign';
  group.add(hazardSign);
  group.add(solidBox(0.1, 1.4, 0.1, mat.steel, -1.8, 0.7, 3.6));
  const signTex = makeHazardSignTexture();
  [0.056, -0.056].forEach((dz, i) => {
    const face = makePanel(1.42, 0.94, signTex, 0xffc400);
    if (i === 1) face.rotation.y = Math.PI;
    face.position.set(0, 0, dz);
    hazardSign.add(face);
  });

  // E-stop (mushroom button on a post) and lockout/tagout station
  const estop = solidBox(0.4, 0.4, 0.2, mat.danger, 4, 1.2, -3);
  estop.userData.interactId = 'emergency_stop';
  group.add(estop);
  group.add(solidBox(0.2, 1.0, 0.2, mat.steel, 4, 0.5, -3));
  const mushroom = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.1, 16), mat.danger);
  mushroom.rotation.x = Math.PI / 2;
  mushroom.position.set(0, 0, 0.14);
  noCollide(mushroom);
  estop.add(mushroom);

  const lockout = solidBox(0.5, 0.8, 0.3, mat.warning, 4, 1, 2);
  lockout.userData.interactId = 'lockout_tagout';
  group.add(lockout);
  group.add(solidBox(0.4, 0.6, 0.4, mat.steel, 4, 0.3, 2));
  const padlock = new THREE.Group();
  padlock.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, 0.09), mat.danger));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 14, Math.PI), ppeMaterial(0xcccccc, { metalness: 0.9 }));
  shackle.position.y = 0.09;
  padlock.add(shackle);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.03), mat.yellowPaint);
  tag.position.set(0.02, -0.26, 0);
  padlock.add(tag);
  padlock.position.set(4, 1.62, 2);
  padlock.visible = false;
  noCollide(padlock);
  group.add(padlock);

  const ppe = solidBox(1.2, 1.2, 0.6, mat.cyan, -6, 0.7, 4);
  ppe.userData.interactId = 'ppe_station';
  group.add(ppe);

  // Labels
  [
    ['PPE STATION', -6, 1.85, 4],
    ['EMERGENCY STOP', 4, 1.85, -3],
    ['LOCKOUT / TAGOUT', 4, 2.05, 2],
  ].forEach(([text, x, y, z]) => {
    const l = makeLabel(text, { width: 2.3 });
    l.position.set(x, y, z);
    group.add(l);
  });

  // Barriers around the moving parts
  group.add(solidBox(0.2, 1, 3, mat.warning, -2, 0.5, 0));
  group.add(solidBox(0.2, 1, 3, mat.warning, 2, 0.5, 0));

  let running = true;
  let speed = 1;
  return {
    group,
    stopMachine() {
      running = false;
      beaconMat.color.setHex(0xff2a2a);
      beaconMat.emissive.setHex(0xff2a2a);
      beaconLight.color.setHex(0xff2a2a);
    },
    lockOut() {
      padlock.visible = true;
    },
    update(dt) {
      speed += ((running ? 1 : 0) - speed) * Math.min(1, dt * 3);
      if (speed < 0.005) speed = 0;
      if (beltTex) beltTex.offset.x -= dt * 0.45 * speed;
      rotor.rotation.y += dt * 7 * speed;
      crates.forEach((c) => {
        c.position.x += dt * 1.3 * speed;
        if (c.position.x > 3.6) c.position.x = -3.6;
      });
    },
    interactables: [
      { id: 'hazard_sign', object: hazardSign, label: 'READ HAZARD SIGN' },
      { id: 'ppe_station', object: ppe, label: 'SELECT PPE' },
      { id: 'emergency_stop', object: estop, label: 'EMERGENCY STOP' },
      { id: 'lockout_tagout', object: lockout, label: 'LOCKOUT / TAGOUT' },
    ],
  };
}
