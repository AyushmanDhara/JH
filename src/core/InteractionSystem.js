/**
 * InteractionSystem — proximity + look + line-of-sight (blocked by solid walls).
 */
import * as THREE from 'three';

const _worldPos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _camDir = new THREE.Vector3();

export class InteractionSystem {
  constructor(camera, scene) {
    this.camera = camera;
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.interactables = new Map();
    this.currentTarget = null;
    this.promptVisible = false;
    this.onPromptChange = null;
    /** @type {() => THREE.Mesh[]} */
    this.getSolidMeshes = null;
  }

  setSolidMeshProvider(fn) {
    this.getSolidMeshes = fn;
  }

  register(id, object, handler, options = {}) {
    if (object) object.userData.interactId = id;
    this.interactables.set(id, {
      object,
      handler,
      label: options.label || 'INTERACT',
      maxDist: options.maxDist || 4,
    });
  }

  unregister(id) {
    this.interactables.delete(id);
  }

  clear() {
    this.interactables.clear();
    this.currentTarget = null;
    this._setPrompt(false);
  }

  update() {
    const camPos = this.camera.position;
    let best = null;
    let bestDist = Infinity;

    this.camera.getWorldDirection(_camDir);

    for (const [id, entry] of this.interactables) {
      if (!entry.object || !entry.object.visible) continue;
      entry.object.getWorldPosition(_worldPos);
      const dist = camPos.distanceTo(_worldPos);
      if (dist > entry.maxDist) continue;

      _dir.copy(_worldPos).sub(camPos).normalize();
      const dot = _dir.dot(_camDir);
      if (dot < 0.55) continue;

      // Line-of-sight: blocked if a solid mesh is closer than the target
      if (this.getSolidMeshes && !this._hasLineOfSight(camPos, _worldPos, dist, entry.object)) {
        continue;
      }

      if (dist < bestDist) {
        bestDist = dist;
        best = { id, ...entry };
      }
    }

    if (best) {
      this.currentTarget = best;
      this._setPrompt(true, best.label);
    } else {
      this.currentTarget = null;
      this._setPrompt(false);
    }
  }

  _hasLineOfSight(from, to, targetDist, targetObj) {
    _dir.copy(to).sub(from).normalize();
    this.raycaster.set(from, _dir);
    this.raycaster.far = Math.max(0.1, targetDist - 0.15);
    const solids = this.getSolidMeshes() || [];
    if (!solids.length) return true;
    const hits = this.raycaster.intersectObjects(solids, false);
    for (const h of hits) {
      if (h.object === targetObj) continue;
      // Ignore meshes that are part of the target group
      let o = h.object;
      let isDesc = false;
      while (o) {
        if (o === targetObj) { isDesc = true; break; }
        o = o.parent;
      }
      if (isDesc) continue;
      if (h.object.userData?.noCollision) continue;
      if (h.distance < targetDist - 0.2) return false;
    }
    return true;
  }

  interact() {
    if (!this.currentTarget) return false;
    const { id, handler } = this.currentTarget;
    if (typeof handler === 'function') {
      handler(id);
      return true;
    }
    return false;
  }

  _setPrompt(visible, label = 'INTERACT') {
    if (this.promptVisible === visible && !visible) return;
    this.promptVisible = visible;
    if (this.onPromptChange) this.onPromptChange(visible, label);
  }
}
