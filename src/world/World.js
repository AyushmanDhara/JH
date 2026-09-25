/**
 * World — owns the Three.js scene, the menu backdrop, training-module rooms,
 * and physics colliders.
 *
 * The industrial scenery (City.js) is a NON-INTERACTIVE backdrop that the
 * camera orbits while a menu is open. It has no colliders, entrances or
 * walk-in mode — training modules are entered from the Training Menu only.
 */
import * as THREE from 'three';
import { setupLighting } from './Lighting.js';
import { createEnvironment } from './Environment.js';
import { buildCity } from './City.js';
import { buildFireScenario, buildGasScenario, buildPPEScenario, buildMachineryScenario } from './TrainingCentre.js';
import { PhysicsSystem, ColliderType } from '../core/PhysicsSystem.js';

/** Single registry of every training-module room. Unknown ids fail loudly. */
const MODULE_BUILDERS = {
  fire: buildFireScenario,
  gas: buildGasScenario,
  ppe: buildPPEScenario,
  machinery: buildMachineryScenario,
};
export const MODULE_IDS = Object.keys(MODULE_BUILDERS);

export class World {
  constructor(canvas, quality = 'medium') {
    this.canvas = canvas;
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality !== 'low',
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'low' ? 1.5 : 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );

    this.backdropGroup = null;
    this.moduleGroup = null;
    this.moduleData = null;
    this.mode = 'menu'; // menu | module

    this.physics = new PhysicsSystem(this.scene);

    this.lights = setupLighting(this.scene, quality);
    const env = createEnvironment(this.scene);
    // Ground mesh for raycasts
    if (env.ground) {
      env.ground.name = 'ground';
      this.physics._groundMeshes.push(env.ground);
    }

    this.backdropGroup = buildCity(this.scene);
    this.backdropGroup.name = 'MenuBackdrop';

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  /**
   * Register module-room walls, machines, triggers, hazards.
   */
  _registerModuleColliders(moduleId, moduleData) {
    this.physics.clear();
    this.scene.traverse((obj) => {
      if (obj.name === 'ground' && obj.isMesh) {
        this.physics._groundMeshes.push(obj);
      }
    });

    if (moduleData?.group) {
      this.physics.registerSolidMeshes(moduleData.group, { minSize: 0.12 });
      // Module floor plane at visible floor top (y=0.1)
      const floorMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = 0.1;
      floorMesh.name = 'module_floor_probe';
      moduleData.group.add(floorMesh);
      this.physics._groundMeshes.push(floorMesh);
      // Soft bounds around module
      this.physics.addVolume([0, 3, -22], [30, 6, 1], { type: ColliderType.STATIC, id: 'mod_bound_n' });
      this.physics.addVolume([0, 3, 22], [30, 6, 1], { type: ColliderType.STATIC, id: 'mod_bound_s' });
      this.physics.addVolume([-15, 3, 0], [1, 6, 50], { type: ColliderType.STATIC, id: 'mod_bound_w' });
      this.physics.addVolume([15, 3, 0], [1, 6, 50], { type: ColliderType.STATIC, id: 'mod_bound_e' });
    }

    if (moduleId === 'fire') {
      this.physics.addVolume([-5.5, 1, -1], [3, 2.5, 3], {
        type: ColliderType.HAZARD,
        id: 'fire_zone',
        onEnter: () => this._onHazardEnter?.('fire_zone'),
      });
      this.physics.addVolume([0, 0.5, 14], [5, 1, 5], { type: ColliderType.TRIGGER, id: 'assembly_point' });
      // Emergency exit doors push open automatically as the player approaches —
      // no real fire-exit requires a key press, and the door must never trap the player.
      this.physics.addVolume([0, 1.5, 8.5], [3, 3, 1.5], {
        type: ColliderType.TRIGGER,
        id: 'emergency_exit_zone',
        onEnter: () => {
          const doorCol = this.physics.colliders.find(
            (c) => c.id === 'emergency_exit' || c.object === this.moduleData?.exitDoor
          );
          if (doorCol) { doorCol.active = false; doorCol.isOpen = true; }
          this._onZoneEnter?.('emergency_exit_zone');
        },
      });
    } else if (moduleId === 'gas') {
      this.physics.addVolume([0, 1.5, -8], [7, 3, 8], {
        type: ColliderType.HAZARD,
        id: 'gas_zone',
        onEnter: () => this._onHazardEnter?.('gas_zone'),
      });
      this.physics.addVolume([0, 0.5, 16], [4, 1, 4], { type: ColliderType.TRIGGER, id: 'safe_zone' });
    } else if (moduleId === 'machinery') {
      // Outer caution lane (painted on the floor): approaching it teaches the
      // trainee where the danger zone starts — no penalty, objective credit only.
      this.physics.addVolume([0, 1, 0], [9, 2, 6], {
        type: ColliderType.TRIGGER,
        id: 'machinery_caution',
        onEnter: () => this._onZoneEnter?.('machinery_caution'),
      });
      // Inner hazard: the conveyor / rotating-machine lane — moving parts.
      this.physics.addVolume([0, 1, 0], [4.5, 2, 3.2], {
        type: ColliderType.HAZARD,
        id: 'machinery_zone',
        onEnter: () => this._onHazardEnter?.('machinery_zone'),
      });
    }

    if (this.physics.debug) this.physics.rebuildDebugHelpers();
  }

  setHazardCallback(fn) {
    this._onHazardEnter = fn;
  }

  setZoneCallback(fn) {
    this._onZoneEnter = fn;
  }

  enterModule(moduleId) {
    const build = MODULE_BUILDERS[moduleId];
    if (!build) throw new Error(`Unknown training module: "${moduleId}"`);

    this.clearModule();
    let data;
    try {
      data = build();
      if (!data?.group) throw new Error('module builder returned no scene group');
    } catch (err) {
      // Leave the world in a clean, valid state so the UI can recover.
      this.exitModule();
      throw err;
    }

    this.mode = 'module';
    if (this.backdropGroup) this.backdropGroup.visible = false;
    this.moduleData = data;
    this.moduleGroup = data.group;
    this.scene.add(this.moduleGroup);
    this._registerModuleColliders(moduleId, this.moduleData);
    return this.moduleData;
  }

  exitModule() {
    this.clearModule();
    this.mode = 'menu';
    if (this.backdropGroup) this.backdropGroup.visible = true;
    // No walkable scenery in menu mode: drop every collider/trigger left behind.
    this.physics.clear();
    if (this.physics.debug) this.physics.rebuildDebugHelpers();
  }

  clearModule() {
    if (this.moduleGroup) {
      this.scene.remove(this.moduleGroup);
      this.moduleGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if (m.map && m.userData?.ownsMap) m.map.dispose();
            m.dispose();
          });
        }
      });
      this.moduleGroup = null;
      this.moduleData = null;
    }
  }

  /** @deprecated — physics handles collision; kept for API compat */
  collisionCheck(newPos) {
    return newPos;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  get delta() {
    return Math.min(this.clock.getDelta(), 0.05);
  }
}
