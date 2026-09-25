/**
 * Mine area — coal mine, entrance, excavators, conveyor, dump trucks.
 * Used by City.js; can also be placed independently.
 */
import * as THREE from 'three';

const mat = {
  coal: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.4, metalness: 0.8 }),
  warning: new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.5, metalness: 0.2 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.7 }),
};

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cyl(rTop, rBot, h, material, x, y, z, segs = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildMine(parent, position = new THREE.Vector3(-35, 0, -15)) {
  const mine = new THREE.Group();
  mine.name = 'Mine';
  mine.position.copy(position);

  // Coal piles
  mine.add(cyl(6, 8, 3, mat.coal, 0, 1.5, 0, 8));
  mine.add(cyl(4, 5, 2, mat.coal, 8, 1, 5, 8));

  // Mine entrance (tunnel portal)
  mine.add(box(8, 6, 2, mat.darkMetal, -12, 3, 0));
  mine.add(box(6, 4.5, 12, mat.coal, -12, 2.5, -7));

  // Excavator (stylized)
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

  // Conveyor belt
  const conv = box(12, 0.4, 1.2, mat.steel, 0, 2, 8);
  conv.rotation.z = -0.15;
  mine.add(conv);

  if (parent) parent.add(mine);
  return mine;
}
