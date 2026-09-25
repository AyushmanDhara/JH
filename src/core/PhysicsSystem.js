/**
 * Lightweight physics system for first-person industrial safety simulator.
 * Uses Three.js math only — no heavy physics engine.
 *
 * Categories: STATIC | DYNAMIC | TRIGGER | INTERACTABLE | HAZARD
 */
import * as THREE from 'three';

export const ColliderType = {
  STATIC: 'STATIC',
  DYNAMIC: 'DYNAMIC',
  TRIGGER: 'TRIGGER',
  INTERACTABLE: 'INTERACTABLE',
  HAZARD: 'HAZARD',
};

// Reusable temps — never allocate in hot loops
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _box = new THREE.Box3();
const _box2 = new THREE.Box3();
const _ray = new THREE.Raycaster();
_ray.far = 3;

/**
 * Axis-aligned box collider (world space, updated each registration).
 */
export class BoxCollider {
  constructor(object, options = {}) {
    this.object = object;
    this.type = options.type || ColliderType.STATIC;
    this.id = options.id || object?.uuid || Math.random().toString(36).slice(2);
    this.box = new THREE.Box3();
    this.padding = options.padding || 0;
    this.isOpen = options.isOpen || false; // doors
    this.active = true;
    this.onEnter = options.onEnter || null;
    this.onExit = options.onExit || null;
    this.userData = options.userData || {};
    this._inside = false;
    this.updateBounds();
  }

  updateBounds(force = false) {
    if (!this.object) return;
    // Skip recompute for static cached colliders unless forced / object moved
    if (this._boundsCached && !force && this.type !== 'DYNAMIC') {
      // Still disable if hidden
      if (this.object.visible === false) this.active = false;
      else if (!this.isOpen) this.active = true;
      return;
    }
    this.object.updateWorldMatrix(true, false);
    this.box.setFromObject(this.object);
    if (this.padding) {
      this.box.expandByScalar(this.padding);
    }
    if (this.object.visible === false) this.active = false;
  }

  // Manual AABB (for invisible volumes without mesh)
  setFromCenterSize(center, size) {
    this.box.setFromCenterAndSize(center, size);
  }
}

export class PhysicsSystem {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // solid: STATIC, DYNAMIC
    this.triggers = [];  // TRIGGER, HAZARD, INTERACTABLE zones
    this.dynamicBodies = []; // pushable

    // Player capsule params
    this.playerRadius = 0.35;
    this.playerHeight = 1.7; // eye height ≈ full height for capsule
    this.playerEyeHeight = 1.65;
    this.maxStepHeight = 0.35;
    this.maxWalkableSlope = 45 * (Math.PI / 180); // radians
    this.worldMinY = -5;
    this.groundRayLength = 2.2;

    // Debug
    this.debug = false;
    this.debugHelpers = new THREE.Group();
    this.debugHelpers.name = 'PhysicsDebug';
    this.debugHelpers.visible = false;
    scene.add(this.debugHelpers);

    this._groundMeshes = []; // meshes for ground raycast
    this._lastSlope = 0;
    this._lastSurface = 'none';
    this._activeHazards = new Set();
  }

  // ---------- Registration ----------

  clear() {
    this.colliders.length = 0;
    this.triggers.length = 0;
    this.dynamicBodies.length = 0;
    this._groundMeshes.length = 0;
    this._activeHazards.clear();
    while (this.debugHelpers.children.length) {
      const c = this.debugHelpers.children[0];
      this.debugHelpers.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }

  /**
   * Register a mesh/group as a solid collider.
   */
  addCollider(object, options = {}) {
    const col = new BoxCollider(object, {
      type: options.type || ColliderType.STATIC,
      id: options.id,
      padding: options.padding,
      isOpen: options.isOpen,
      userData: options.userData,
    });
    if (col.type === ColliderType.TRIGGER || col.type === ColliderType.HAZARD) {
      this.triggers.push(col);
    } else {
      this.colliders.push(col);
    }
    if (options.ground !== false && object?.isMesh) {
      this._groundMeshes.push(object);
    }
    return col;
  }

  /**
   * Invisible AABB trigger / hazard / solid (no mesh required).
   */
  addVolume(center, size, options = {}) {
    const col = new BoxCollider(null, {
      type: options.type || ColliderType.TRIGGER,
      id: options.id,
      onEnter: options.onEnter,
      onExit: options.onExit,
      userData: options.userData,
    });
    col.setFromCenterSize(
      center instanceof THREE.Vector3 ? center : new THREE.Vector3().fromArray(center),
      size instanceof THREE.Vector3 ? size : new THREE.Vector3().fromArray(size)
    );
    if (
      col.type === ColliderType.TRIGGER ||
      col.type === ColliderType.HAZARD ||
      col.type === ColliderType.INTERACTABLE
    ) {
      this.triggers.push(col);
    } else {
      this.colliders.push(col);
    }
    return col;
  }

  removeById(id) {
    this.colliders = this.colliders.filter((c) => c.id !== id);
    this.triggers = this.triggers.filter((c) => c.id !== id);
  }

  setDoorOpen(id, open) {
    const all = [...this.colliders, ...this.triggers];
    const col = all.find((c) => c.id === id);
    if (col) {
      col.isOpen = open;
      col.active = !open; // closed = solid
    }
  }

  // ---------- Ground detection ----------

  /**
   * Downward ray from player feet. Returns { grounded, height, normal, slope, surface }.
   * feetY is the bottom of the capsule (position.y - eyeHeight for eye-anchored pos).
   */
  probeGround(feetX, feetY, feetZ) {
    // Ray origin slightly above feet
    _v1.set(feetX, feetY + 0.15, feetZ);
    _v2.set(0, -1, 0);
    _ray.set(_v1, _v2);
    _ray.far = this.groundRayLength;

    const hits = _ray.intersectObjects(this._groundMeshes, false);
    // Also test static collider top faces via AABB
    let bestY = -Infinity;
    let bestNormal = _v3.set(0, 1, 0);
    let surface = 'none';

    if (hits.length > 0) {
      const h = hits[0];
      if (h.point.y > bestY) {
        bestY = h.point.y;
        if (h.face) {
          bestNormal = h.face.normal
            .clone()
            .transformDirection(h.object.matrixWorld)
            .normalize();
        }
        surface = h.object.name || 'mesh';
      }
    }

    // AABB top surfaces near player
    for (const col of this.colliders) {
      if (!col.active || col.isOpen) continue;
      col.updateBounds();
      const b = col.box;
      if (
        feetX >= b.min.x - this.playerRadius &&
        feetX <= b.max.x + this.playerRadius &&
        feetZ >= b.min.z - this.playerRadius &&
        feetZ <= b.max.z + this.playerRadius
      ) {
        const topY = b.max.y;
        // Only consider if top is near feet and we're roughly above it
        if (topY <= feetY + this.maxStepHeight && topY > bestY && topY > feetY - 0.5) {
          bestY = topY;
          bestNormal.set(0, 1, 0);
          surface = col.id || 'collider';
        }
      }
    }

    // Default infinite ground plane at y=0
    if (bestY === -Infinity) {
      bestY = 0;
      bestNormal.set(0, 1, 0);
      surface = 'ground';
    }

    const slope = Math.acos(Math.min(1, Math.max(-1, bestNormal.y)));
    const dist = feetY - bestY;
    const grounded = dist <= 0.12 && dist >= -0.05 && slope <= this.maxWalkableSlope + 0.05;

    this._lastSlope = slope;
    this._lastSurface = surface;

    return {
      grounded,
      height: bestY,
      normal: bestNormal.clone(),
      slope,
      surface,
      distance: dist,
    };
  }

  // ---------- Horizontal collision (slide) ----------

  /**
   * Resolve horizontal movement against solid colliders.
   * Returns corrected (x, z). Uses iterative penetration resolution + wall slide.
   */
  resolveHorizontal(px, pz, feetY, headY, dx, dz) {
    // Sub-step long moves to reduce tunneling through thin walls
    const dist = Math.hypot(dx, dz);
    const steps = dist > 0.25 ? Math.min(6, Math.ceil(dist / 0.2)) : 1;
    let x = px;
    let z = pz;
    const sdx = dx / steps;
    const sdz = dz / steps;
    const radius = this.playerRadius;
    const bodyBottom = feetY + 0.05;
    const bodyTop = headY - 0.05;

    for (let s = 0; s < steps; s++) {
      // Move X then resolve, then Z then resolve (stable wall-slide)
      x += sdx;
      ({ x, z } = this._resolveAxis(x, z, bodyBottom, bodyTop, radius, 'x'));
      z += sdz;
      ({ x, z } = this._resolveAxis(x, z, bodyBottom, bodyTop, radius, 'z'));
    }
    return { x, z };
  }

  _resolveAxis(x, z, bodyBottom, bodyTop, radius, axis) {
    for (let iter = 0; iter < 4; iter++) {
      let hit = false;
      for (const col of this.colliders) {
        if (!col.active || col.isOpen) continue;
        if (col.object) col.updateBounds();
        const b = col.box;

        if (bodyTop < b.min.y || bodyBottom > b.max.y + this.maxStepHeight) continue;

        // Walkable step — skip solid block
        if (
          b.max.y - bodyBottom > 0 &&
          b.max.y - (bodyBottom - 0.05) <= this.maxStepHeight &&
          bodyBottom < b.max.y
        ) {
          continue;
        }

        const minX = b.min.x - radius;
        const maxX = b.max.x + radius;
        const minZ = b.min.z - radius;
        const maxZ = b.max.z + radius;

        if (x <= minX || x >= maxX || z <= minZ || z >= maxZ) continue;

        const penLeft = x - minX;
        const penRight = maxX - x;
        const penNear = z - minZ;
        const penFar = maxZ - z;

        if (axis === 'x') {
          if (penLeft < penRight) x = minX;
          else x = maxX;
        } else {
          if (penNear < penFar) z = minZ;
          else z = maxZ;
        }
        hit = true;
      }
      if (!hit) break;
    }
    return { x, z };
  }

  /**
   * Register all meshes marked userData.solid (or solid:true option) under a root.
   * Collision bounds match visual geometry.
   */
  registerSolidMeshes(root, options = {}) {
    if (!root) return;
    const minSize = options.minSize ?? 0.15;
    root.updateMatrixWorld(true);
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      if (obj.userData.noCollision) return;
      if (obj.visible === false) return;
      // Explicit opt-out
      if (obj.userData.solid === false) return;

      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      box.getSize(size);

      // Floor-like: thin + large XZ → ground only
      if (size.y < 0.35 && size.x > 3 && size.z > 3) {
        if (!this._groundMeshes.includes(obj)) this._groundMeshes.push(obj);
        return;
      }
      if (Math.max(size.x, size.y, size.z) < minSize) return;

      // Opt-in solid: userData.solid or userData.physics, or options.all
      const isSolid = obj.userData.solid === true
        || obj.userData.physics?.body === 'static'
        || options.all === true;
      if (!isSolid) return;

      const col = this.addCollider(obj, {
        type: ColliderType.STATIC,
        id: obj.userData.interactId || obj.name || obj.uuid,
        ground: false,
      });
      // Cache bounds once
      col._boundsCached = true;
    });
  }

  getSolidMeshes() {
    const meshes = [];
    for (const c of this.colliders) {
      if (!c.active || c.isOpen) continue;
      if (c.object && c.object.isMesh && c.object.visible !== false) {
        meshes.push(c.object);
      }
    }
    return meshes;
  }

  /**
   * Head / ceiling check — returns max allowed head Y (or null).
   */
  resolveCeiling(px, pz, proposedHeadY, feetY) {
    const radius = this.playerRadius * 0.9;
    for (const col of this.colliders) {
      if (!col.active || col.isOpen) continue;
      col.updateBounds();
      const b = col.box;
      if (
        px > b.min.x - radius &&
        px < b.max.x + radius &&
        pz > b.min.z - radius &&
        pz < b.max.z + radius
      ) {
        // Ceiling is underside of box above player
        if (b.min.y < proposedHeadY && b.min.y > feetY + 0.3) {
          return b.min.y - 0.05;
        }
      }
    }
    return null;
  }

  // ---------- Triggers / hazards ----------

  /**
   * Test player capsule against trigger volumes. Calls onEnter/onExit.
   * Returns list of active hazard ids.
   */
  updateTriggers(px, feetY, pz, headY) {
    const hazards = [];
    // Approximate player as AABB
    _box.min.set(px - this.playerRadius, feetY, pz - this.playerRadius);
    _box.max.set(px + this.playerRadius, headY, pz + this.playerRadius);

    for (const t of this.triggers) {
      if (!t.active) continue;
      if (t.object) t.updateBounds();
      const overlaps = _box.intersectsBox(t.box);

      if (overlaps && !t._inside) {
        t._inside = true;
        if (typeof t.onEnter === 'function') t.onEnter(t);
      } else if (!overlaps && t._inside) {
        t._inside = false;
        if (typeof t.onExit === 'function') t.onExit(t);
      }

      if (overlaps && t.type === ColliderType.HAZARD) {
        hazards.push(t.id);
        this._activeHazards.add(t.id);
      }
    }

    // Clean hazards no longer inside
    for (const id of [...this._activeHazards]) {
      if (!hazards.includes(id)) this._activeHazards.delete(id);
    }

    return hazards;
  }

  getActiveHazards() {
    return [...this._activeHazards];
  }

  // ---------- Pushable dynamics (lightweight) ----------

  /**
   * Simple push: if DYNAMIC collider overlaps player, nudge it along move dir.
   */
  pushDynamics(px, pz, dx, dz) {
    const radius = this.playerRadius + 0.1;
    for (const col of this.colliders) {
      if (col.type !== ColliderType.DYNAMIC || !col.active || !col.object) continue;
      col.updateBounds();
      const b = col.box;
      const cx = (b.min.x + b.max.x) * 0.5;
      const cz = (b.min.z + b.max.z) * 0.5;
      const distX = px - cx;
      const distZ = pz - cz;
      if (Math.abs(distX) < radius + (b.max.x - b.min.x) * 0.5 &&
          Math.abs(distZ) < radius + (b.max.z - b.min.z) * 0.5) {
        col.object.position.x += dx * 0.4;
        col.object.position.z += dz * 0.4;
        col.updateBounds();
      }
    }
  }

  // ---------- Debug ----------

  setDebug(enabled) {
    this.debug = enabled;
    this.debugHelpers.visible = enabled;
    if (enabled) this.rebuildDebugHelpers();
  }

  toggleDebug() {
    this.setDebug(!this.debug);
    return this.debug;
  }

  rebuildDebugHelpers() {
    while (this.debugHelpers.children.length) {
      const c = this.debugHelpers.children[0];
      this.debugHelpers.remove(c);
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }

    const addBoxHelper = (box, color) => {
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size.x, size.y, size.z),
        new THREE.MeshBasicMaterial({
          color,
          wireframe: true,
          transparent: true,
          opacity: 0.55,
          depthTest: true,
        })
      );
      mesh.position.copy(center);
      this.debugHelpers.add(mesh);
    };

    for (const col of this.colliders) {
      if (col.object) col.updateBounds();
      addBoxHelper(col.box, col.type === ColliderType.DYNAMIC ? 0x00ff9d : 0x00e5ff);
    }
    for (const t of this.triggers) {
      if (t.object) t.updateBounds();
      const color = t.type === ColliderType.HAZARD ? 0xff3b3b : 0xffaa00;
      addBoxHelper(t.box, color);
    }
  }

  getDebugState(player) {
    return {
      grounded: player?.grounded ?? false,
      velocityY: player?.verticalVelocity?.toFixed?.(2) ?? '—',
      speed: player?.horizontalSpeed?.toFixed?.(2) ?? '—',
      slope: ((this._lastSlope * 180) / Math.PI).toFixed(1) + '°',
      surface: this._lastSurface,
      hazards: [...this._activeHazards].join(',') || 'none',
      colliders: this.colliders.length,
      triggers: this.triggers.length,
    };
  }
}
