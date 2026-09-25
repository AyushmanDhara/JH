/**
 * CameraController — yaw/pitch look helpers.
 * PlayerController already embeds look logic; this module exposes
 * reusable camera utilities for future AR / free-camera modes.
 */
import * as THREE from 'three';

export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0;
    this.sensitivity = 0.0022;
    this.minPitch = -Math.PI / 2 + 0.1;
    this.maxPitch = Math.PI / 2 - 0.1;
  }

  applyMouseDelta(dx, dy) {
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch));
    this._apply();
  }

  setLook(yaw, pitch) {
    this.yaw = yaw;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, pitch));
    this._apply();
  }

  lookAt(target) {
    this.camera.lookAt(target);
    // Sync yaw/pitch from camera matrix if needed later
  }

  _apply() {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  getForward() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    return dir;
  }

  getRight() {
    const dir = new THREE.Vector3(1, 0, 0);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    return dir;
  }
}
