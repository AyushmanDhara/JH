/**
 * Procedural stylized industrial scenery inspired by Jharkhand mining/steel.
 * Low-poly, no external assets required.
 *
 * This is a NON-INTERACTIVE backdrop for the menu screens (the camera orbits
 * it). It has no entrances, colliders or walk-in mode.
 */
import * as THREE from 'three';
import { buildPracticalLab } from './PracticalLab.js';

// Materials created lazily after texture helpers exist — see initMaterials()
let mat = null;
function initMaterials() {
  if (mat) return mat;
  const concreteMap = makeNoiseTexture(0x6a6a68, 32);
  const asphaltMap = makeNoiseTexture(0x222224, 18);
  const steelMap = makeNoiseTexture(0x4a5560, 20);
  mat = {
    concrete: new THREE.MeshStandardMaterial({ map: concreteMap, color: 0xffffff, roughness: 0.88, metalness: 0.08 }),
    asphalt: new THREE.MeshStandardMaterial({ map: asphaltMap, color: 0xffffff, roughness: 0.95, metalness: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ map: steelMap, color: 0xffffff, roughness: 0.42, metalness: 0.75 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.72, metalness: 0.28 }),
    coal: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 }),
    warning: new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.5, metalness: 0.2, emissive: 0x331100, emissiveIntensity: 0.2 }),
    cyan: new THREE.MeshStandardMaterial({ color: 0x00e5ff, roughness: 0.3, metalness: 0.5, emissive: 0x00e5ff, emissiveIntensity: 0.3 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.7 }),
    brick: new THREE.MeshStandardMaterial({ map: makeNoiseTexture(0x5a4030, 40), color: 0xffffff, roughness: 0.9 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x88aacc, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.55 }),
    green: new THREE.MeshStandardMaterial({ color: 0x2d5a3d, roughness: 0.9 }),
    hazard: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.1 }),
  };
  return mat;
}

function box(w, h, d, material, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  // Floors (very flat) are not solid walls
  if (opts.solid !== false && h >= 0.4) {
    m.userData.solid = true;
  }
  if (opts.noCollision) m.userData.noCollision = true;
  return m;
}

/** Procedural tiling texture for industrial look (no external assets). */
function makeNoiseTexture(baseColor, variation = 28, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const r = (baseColor >> 16) & 255;
  const g = (baseColor >> 8) & 255;
  const b = baseColor & 255;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (Math.random() - 0.5) * variation;
    const o = i * 4;
    img.data[o] = Math.max(0, Math.min(255, r + n));
    img.data[o + 1] = Math.max(0, Math.min(255, g + n));
    img.data[o + 2] = Math.max(0, Math.min(255, b + n));
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // subtle grid seams
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function cyl(rTop, rBot, h, material, x, y, z, segs = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (h >= 0.5) m.userData.solid = true;
  return m;
}

export function buildCity(scene) {
  initMaterials();
  const group = new THREE.Group();
  group.name = 'City';

  // ---- Roads ----
  const roadH = box(120, 0.08, 8, mat.asphalt, 0, 0.05, 0, { solid: false });
  const roadV = box(8, 0.08, 80, mat.asphalt, 0, 0.05, -20, { solid: false });
  // Hazard stripe along road edge (slightly raised to avoid z-fight)
  const stripe = box(120, 0.02, 0.35, mat.warning, 0, 0.1, 4.2, { solid: false });
  group.add(stripe);
  group.add(roadH, roadV);

  // ---- Mining area (left / negative X) ----
  const mine = new THREE.Group();
  mine.name = 'Mine';
  mine.position.set(-35, 0, -15);

  // Coal pile
  mine.add(cyl(6, 8, 3, mat.coal, 0, 1.5, 0, 8));
  mine.add(cyl(4, 5, 2, mat.coal, 8, 1, 5, 8));

  // Mine entrance (tunnel portal)
  const portal = box(8, 6, 2, mat.darkMetal, -12, 3, 0);
  mine.add(portal);
  const tunnel = box(6, 4.5, 12, mat.coal, -12, 2.5, -7);
  mine.add(tunnel);

  // Excavator body (stylized)
  const excav = new THREE.Group();
  excav.add(box(4, 2, 2.5, mat.steel, 0, 1.5, 0));
  excav.add(box(1.5, 1, 1.5, mat.warning, 2.5, 2, 0));
  excav.add(box(0.4, 0.4, 5, mat.darkMetal, 4, 2.5, 0));
  excav.position.set(10, 0, -8);
  mine.add(excav);

  // Dump truck
  const truck = new THREE.Group();
  truck.add(box(5, 1.8, 2.5, mat.warning, 0, 1.2, 0));
  truck.add(box(2.5, 1.5, 2.2, mat.darkMetal, -3, 1.5, 0));
  truck.position.set(5, 0, 10);
  mine.add(truck);

  // Conveyor
  const conv = box(12, 0.4, 1.2, mat.steel, 0, 2, 8);
  conv.rotation.z = -0.15;
  mine.add(conv);

  group.add(mine);

  // ---- Steel / Factory area (right) ----
  const factory = new THREE.Group();
  factory.name = 'Factory';
  factory.position.set(30, 0, -10);

  // Main hall
  factory.add(box(20, 10, 14, mat.steel, 0, 5, 0));
  // Windows strip
  factory.add(box(18, 2, 0.2, mat.glass, 0, 6, 7.1));
  // Chimneys
  factory.add(cyl(1.2, 1.5, 16, mat.rust, -6, 13, -3));
  factory.add(cyl(1, 1.2, 12, mat.rust, -2, 11, -4));
  // Storage tanks
  factory.add(cyl(3, 3, 6, mat.steel, 12, 3, 8));
  factory.add(cyl(2.5, 2.5, 5, mat.steel, 12, 2.5, -6));
  // Pipes
  factory.add(box(0.6, 0.6, 10, mat.darkMetal, 8, 4, 0));
  factory.add(box(8, 0.5, 0.5, mat.darkMetal, 4, 6, 5));

  group.add(factory);

  // ---- Training Centre (centre-north) ----
  const training = new THREE.Group();
  training.name = 'TrainingCentre';
  training.position.set(0, 0, -35);

  // Main building
  const tcBody = box(18, 8, 12, mat.concrete, 0, 4, 0);
  training.add(tcBody);
  // Accent stripe
  training.add(box(18.2, 0.4, 12.2, mat.cyan, 0, 7, 0));
  // Entrance canopy
  training.add(box(6, 0.3, 3, mat.steel, 0, 3.5, 7));
  // Door (decorative)
  const door = box(2.5, 3.5, 0.3, mat.darkMetal, 0, 1.75, 6.2);
  door.name = 'training_door';
  training.add(door);
  // Sign post
  training.add(box(4, 1.2, 0.2, mat.warning, 0, 6.5, 6.3));

  // Side lab wing
  training.add(box(8, 5, 8, mat.concrete, 14, 2.5, 0));

  group.add(training);

  // ---- Practical Lab / Worker area (decorative building) ----
  buildPracticalLab(group, new THREE.Vector3(-15, 0, 15));

  // ---- Emergency assembly point ----
  const assembly = new THREE.Group();
  assembly.name = 'AssemblyPoint';
  assembly.position.set(15, 0, 20);
  // Marked zone
  const zone = new THREE.Mesh(
    new THREE.CircleGeometry(5, 24),
    new THREE.MeshStandardMaterial({ color: 0x224422, roughness: 0.8, transparent: true, opacity: 0.7 })
  );
  zone.rotation.x = -Math.PI / 2;
  zone.position.y = 0.05;
  assembly.add(zone);
  // Sign
  assembly.add(box(0.2, 3, 0.2, mat.steel, 0, 1.5, 0));
  assembly.add(box(1.5, 1, 0.1, mat.warning, 0, 3.2, 0));
  group.add(assembly);

  // ---- Street lights ----
  for (let i = -50; i <= 50; i += 20) {
    const light = new THREE.Group();
    light.add(cyl(0.12, 0.15, 5, mat.darkMetal, 0, 2.5, 0));
    light.add(box(0.8, 0.2, 0.4, mat.warning, 0, 5.1, 0));
    const pl = new THREE.PointLight(0xffcc88, 0.6, 18);
    pl.position.set(0, 5, 0);
    light.add(pl);
    light.position.set(i, 0, 5);
    group.add(light);

    const light2 = light.clone();
    light2.position.set(i, 0, -25);
    group.add(light2);
  }

  // ---- Barriers & signs ----
  for (let i = 0; i < 6; i++) {
    const barrier = box(1.5, 0.8, 0.15, mat.warning, -20 + i * 3, 0.4, 8);
    group.add(barrier);
  }

  // ---- Sparse trees ----
  for (let i = 0; i < 12; i++) {
    const tree = new THREE.Group();
    tree.add(cyl(0.25, 0.35, 2, mat.rust, 0, 1, 0, 6));
    tree.add(new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 3, 6),
      mat.green
    ));
    tree.children[1].position.y = 3.2;
    const angle = (i / 12) * Math.PI * 2;
    const r = 55 + (i % 3) * 8;
    tree.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r - 10);
    group.add(tree);
  }

  // ---- Warehouse ----
  const wh = box(12, 6, 10, mat.concrete, -40, 3, 25);
  group.add(wh);

  scene.add(group);
  return group;
}

/**
 * Create a simple fire visual (particles + orange mesh).
 */
export function createFire(position) {
  const group = new THREE.Group();
  group.position.copy(position);

  const fireMat = new THREE.MeshBasicMaterial({
    color: 0xff5500,
    transparent: true,
    opacity: 0.85,
  });
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 6), fireMat);
  core.position.y = 1.1;
  group.add(core);

  const outer = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 1.6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5 })
  );
  outer.position.y = 0.9;
  group.add(outer);

  // Smoke
  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.35 })
  );
  smoke.position.y = 3.5;
  group.add(smoke);

  group.userData.isFire = true;
  group.userData.active = true;
  group.userData.noCollision = true;
  group.traverse((ch) => {
    if (ch.isMesh) {
      ch.userData.noCollision = true;
      ch.userData.solid = false;
    }
  });
  return group;
}

/**
 * Simple extinguisher prop.
 */
export function createExtinguisher(type = 'CO2') {
  const g = new THREE.Group();
  const body = cyl(0.18, 0.2, 0.9, new THREE.MeshStandardMaterial({
    color: type === 'CO2' ? 0x2222aa : type === 'Foam' ? 0xeeeeee : 0xcc2222,
    roughness: 0.4,
    metalness: 0.6,
  }), 0, 0.45, 0);
  g.add(body);
  g.add(box(0.15, 0.08, 0.25, mat.darkMetal, 0.1, 0.85, 0));
  g.userData.extinguisherType = type;
  g.userData.isExtinguisher = true;
  return g;
}


/**
 * Create a wall mesh with matching solid collider metadata.
 */
export function createWall(w, h, d, material, x, y, z) {
  initMaterials();
  return box(w, h, d, material || mat.concrete, x, y, z, { solid: true });
}
