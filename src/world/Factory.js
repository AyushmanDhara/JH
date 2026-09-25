/**
 * Steel / Factory area — halls, chimneys, tanks, pipes.
 */
import * as THREE from 'three';

const mat = {
  steel: new THREE.MeshStandardMaterial({ color: 0x4a5560, roughness: 0.4, metalness: 0.8 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.7, metalness: 0.3 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.7 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x88aacc, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.6,
  }),
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

export function buildFactory(parent, position = new THREE.Vector3(30, 0, -10)) {
  const factory = new THREE.Group();
  factory.name = 'Factory';
  factory.position.copy(position);

  // Main hall
  factory.add(box(20, 10, 14, mat.steel, 0, 5, 0));
  // Windows
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

  if (parent) parent.add(factory);
  return factory;
}
