import * as THREE from 'three';

export function createEnvironment(scene) {
  // Fog for atmosphere
  scene.fog = new THREE.FogExp2(0x1a2a3a, 0.012);
  scene.background = new THREE.Color(0x1a2a3a);

  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a28,
    roughness: 0.9,
    metalness: 0.1,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Simple grid helper for industrial feel (subtle)
  const grid = new THREE.GridHelper(200, 40, 0x3a4a5a, 0x2a3a4a);
  grid.position.y = 0.01;
  scene.add(grid);

  return { ground, grid };
}
