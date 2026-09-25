import * as THREE from 'three';

export function setupLighting(scene, quality = 'medium') {
  // Ambient
  const ambient = new THREE.AmbientLight(0x4a6080, 0.45);
  scene.add(ambient);

  // Hemisphere for industrial sky
  const hemi = new THREE.HemisphereLight(0x87a0c0, 0x2a1a0a, 0.55);
  scene.add(hemi);

  // Main sun / industrial key light
  const sun = new THREE.DirectionalLight(0xfff0dd, 1.1);
  sun.position.set(40, 60, 30);
  sun.castShadow = quality !== 'low';
  if (sun.castShadow) {
    sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 150;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.bias = -0.0005;
  }
  scene.add(sun);

  // Cool fill from opposite side
  const fill = new THREE.DirectionalLight(0x4488ff, 0.25);
  fill.position.set(-30, 20, -20);
  scene.add(fill);

  // Subtle cyan accent for futuristic feel
  const accent = new THREE.PointLight(0x00e5ff, 0.4, 40);
  accent.position.set(0, 8, 0);
  scene.add(accent);

  return { ambient, hemi, sun, fill, accent };
}
