/**
 * Practical Laboratory / PPE station building — decorative scenery on the
 * "other side" of the menu backdrop from the Training Centre. It is not an
 * entrance: training modules are started from the Training Menu.
 */
import * as THREE from 'three';

const mat = {
  brick: new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x88aacc, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.6,
  }),
  steel: new THREE.MeshStandardMaterial({ color: 0x556070, roughness: 0.4, metalness: 0.7 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.7 }),
  warning: new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.5, metalness: 0.2, emissive: 0x331100, emissiveIntensity: 0.2 }),
};

function box(w, h, d, material, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (opts.solid !== false && h >= 0.4) {
    m.userData.solid = true;
  }
  return m;
}

export function buildPracticalLab(parent, position = new THREE.Vector3(-15, 0, 15)) {
  const lab = new THREE.Group();
  lab.name = 'PracticalLab';
  lab.position.copy(position);

  lab.add(box(10, 4, 8, mat.brick, 0, 2, 0));
  // Window offset to one side so it doesn't overlap the new door.
  lab.add(box(3, 2.5, 0.2, mat.glass, -2.7, 2, 4.1));

  // PPE racks (simple props)
  const rack = box(2, 1.5, 0.4, mat.steel, 3, 0.75, 2);
  lab.add(rack);

  // Door + sign on the south wall (decorative)
  const door = box(2, 3, 0.25, mat.darkMetal, 1.8, 1.5, 4.15);
  door.name = 'practical_lab_door';
  lab.add(door);

  lab.add(box(2.6, 0.8, 0.15, mat.warning, 1.8, 3.7, 4.2));

  if (parent) parent.add(lab);
  return lab;
}
