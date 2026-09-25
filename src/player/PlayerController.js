/**
 * PlayerController — first-person movement with lightweight physics.
 * Gravity, ground detection, capsule collision, wall-slide, steps, slopes,
 * acceleration, air control, head bob, sprint rules.
 */
import * as THREE from 'three';

export class PlayerController {
  constructor(camera, domElement, physics) {
    this.camera = camera;
    this.dom = domElement;
    this.physics = physics;

    this.enabled = false;
    this.paused = false;
    this.isLocked = false;

    // Capsule / eye
    this.eyeHeight = 1.65;
    this.height = 1.7;
    this.radius = 0.35;

    // Physics state
    this.position = new THREE.Vector3(0, this.eyeHeight, 12); // eye position
    this.horizontalVelocity = new THREE.Vector3();
    this.verticalVelocity = 0;
    this.grounded = true;
    this.canJump = true;
    this.sprint = false;
    this.horizontalSpeed = 0;

    // Movement tuning
    this.walkSpeed = 5.5;
    this.sprintSpeed = 9.5;
    this.acceleration = 28;
    this.friction = 22;
    this.airControl = 0.35;
    this.jumpSpeed = 7.5;
    this.gravity = 22;
    this.maxFallSpeed = 35;

    // Input
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.mobileMove = { x: 0, y: 0 };
    this.yaw = 0;
    this.pitch = 0;

    // Head bob
    this.headBobEnabled = true;
    this.headBobTimer = 0;
    this.headBobAmount = 0.04;
    this.headBobSpeed = 10;
    this._bobOffset = 0;

    // Checkpoint / respawn
    this.checkpoint = new THREE.Vector3(0, this.eyeHeight, 12);
    this.worldMinY = -5;

    // Reusable vectors
    this._wish = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._move = new THREE.Vector3();

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onClick = this._onClick.bind(this);

    this.camera.position.copy(this.position);
  }

  enable() {
    this.enabled = true;
    this.paused = false;
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this.dom.addEventListener('click', this._onClick);
  }

  disable() {
    this.enabled = false;
    this.isLocked = false;
    this.sprint = false;
    this.moveForward = this.moveBackward = this.moveLeft = this.moveRight = false;
    document.exitPointerLock?.();
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this.dom.removeEventListener('click', this._onClick);
  }

  setPaused(v) {
    this.paused = !!v;
    if (v) {
      this.sprint = false;
      this.moveForward = this.moveBackward = this.moveLeft = this.moveRight = false;
      this.mobileMove.x = 0;
      this.mobileMove.y = 0;
    }
  }

  /** Full physics state reset (module change / restart) */
  resetPhysicsState() {
    this.horizontalVelocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.grounded = true;
    this.canJump = true;
    this.sprint = false;
    this.horizontalSpeed = 0;
    this.headBobTimer = 0;
    this._bobOffset = 0;
    this.moveForward = this.moveBackward = this.moveLeft = this.moveRight = false;
    this.mobileMove.x = 0;
    this.mobileMove.y = 0;
  }

  setCheckpoint(x, y, z) {
    this.checkpoint.set(x, y ?? this.eyeHeight, z);
  }

  respawn() {
    this.position.copy(this.checkpoint);
    this.resetPhysicsState();
    this.camera.position.copy(this.position);
  }

  setPosition(x, y, z) {
    this.position.set(x, y ?? this.eyeHeight, z);
    this.camera.position.copy(this.position);
    this.setCheckpoint(x, y ?? this.eyeHeight, z);
    this.resetPhysicsState();
  }

  /**
   * Apply yaw/pitch to the camera with zero roll.
   * BUGFIX: the menu backdrop orients the camera with lookAt(); switching the
   * Euler order to YXZ while only writing x/y left a stale z (roll) component,
   * so the first module entered rendered with a tilted horizon.
   */
  applyLook() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** Reset view + physics for a fresh module start (position given as feet-level x/z). */
  spawn(x, z, yaw = 0) {
    this.setPosition(x, undefined, z);
    this.yaw = yaw;
    this.pitch = 0;
    this.applyLook();
    this.camera.updateMatrixWorld(true);
  }

  // ---------- Input ----------

  _onClick() {
    if (!this.enabled || this.paused) return;
    if (!this.isLocked) this.dom.requestPointerLock();
  }

  _onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.dom;
    if (this.isLocked) {
      document.addEventListener('mousemove', this._onMouseMove);
    } else {
      document.removeEventListener('mousemove', this._onMouseMove);
    }
  }

  _onMouseMove(e) {
    if (!this.isLocked || this.paused) return;
    const sens = 0.0022;
    this.yaw -= e.movementX * sens;
    this.pitch -= e.movementY * sens;
    this.pitch = Math.max(-Math.PI / 2 + 0.12, Math.min(Math.PI / 2 - 0.12, this.pitch));
  }

  _onKeyDown(e) {
    if (!this.enabled || this.paused) return;
    switch (e.code) {
      case 'KeyW': this.moveForward = true; break;
      case 'KeyS': this.moveBackward = true; break;
      case 'KeyA': this.moveLeft = true; break;
      case 'KeyD': this.moveRight = true; break;
      case 'ShiftLeft':
      case 'ShiftRight': this.sprint = true; break;
      case 'Space':
        if (this.grounded && this.canJump) {
          this.verticalVelocity = this.jumpSpeed;
          this.grounded = false;
          this.canJump = false;
        }
        break;
    }
  }

  _onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': this.moveForward = false; break;
      case 'KeyS': this.moveBackward = false; break;
      case 'KeyA': this.moveLeft = false; break;
      case 'KeyD': this.moveRight = false; break;
      case 'ShiftLeft':
      case 'ShiftRight': this.sprint = false; break;
    }
  }

  setMobileMove(x, y) {
    this.mobileMove.x = x;
    this.mobileMove.y = y;
  }

  setMobileLook(dx, dy) {
    if (this.paused) return;
    this.yaw -= dx * 0.004;
    this.pitch -= dy * 0.004;
    this.pitch = Math.max(-Math.PI / 2 + 0.12, Math.min(Math.PI / 2 - 0.12, this.pitch));
  }

  setMobileSprint(v) {
    if (this.paused) {
      this.sprint = false;
      return;
    }
    this.sprint = !!v;
  }

  setMobileJump() {
    if (this.paused) return;
    if (this.grounded && this.canJump) {
      this.verticalVelocity = this.jumpSpeed;
      this.grounded = false;
      this.canJump = false;
    }
  }

  // ---------- Core update ----------

  update(dt) {
    if (!this.enabled || this.paused) {
      // Still apply camera look orientation when paused? no — freeze
      return;
    }

    // Clamp delta (tab switch / mobile resume)
    dt = Math.min(dt, 0.05);

    // Look
    this.applyLook();

    // Wish direction (camera-relative)
    this._wish.set(0, 0, 0);
    if (this.moveForward) this._wish.z -= 1;
    if (this.moveBackward) this._wish.z += 1;
    if (this.moveLeft) this._wish.x -= 1;
    if (this.moveRight) this._wish.x += 1;
    if (Math.abs(this.mobileMove.x) > 0.05 || Math.abs(this.mobileMove.y) > 0.05) {
      this._wish.x += this.mobileMove.x;
      this._wish.z -= this.mobileMove.y;
    }
    if (this._wish.lengthSq() > 0) this._wish.normalize();

    this._forward.set(0, 0, -1).applyAxisAngle(_UP, this.yaw);
    this._right.set(1, 0, 0).applyAxisAngle(_UP, this.yaw);

    // Desired horizontal velocity — keep take-off sprint speed while airborne
    const maxSpeed = (this.sprint && (this.grounded || this.horizontalSpeed > this.walkSpeed * 0.85))
      ? this.sprintSpeed
      : this.walkSpeed;
    const wishVel = this._move
      .set(0, 0, 0)
      .addScaledVector(this._forward, -this._wish.z * maxSpeed)
      .addScaledVector(this._right, this._wish.x * maxSpeed);

    // Acceleration / friction (ground vs air)
    const control = this.grounded ? 1 : this.airControl;
    if (this._wish.lengthSq() > 0.01) {
      // Accelerate toward wish
      this.horizontalVelocity.x += (wishVel.x - this.horizontalVelocity.x) * Math.min(1, this.acceleration * control * dt);
      this.horizontalVelocity.z += (wishVel.z - this.horizontalVelocity.z) * Math.min(1, this.acceleration * control * dt);
    } else if (this.grounded) {
      // Friction
      const speed = Math.hypot(this.horizontalVelocity.x, this.horizontalVelocity.z);
      if (speed > 0.01) {
        const drop = Math.min(speed, this.friction * dt);
        const factor = (speed - drop) / speed;
        this.horizontalVelocity.x *= factor;
        this.horizontalVelocity.z *= factor;
      } else {
        this.horizontalVelocity.x = 0;
        this.horizontalVelocity.z = 0;
      }
    }

    // Clamp horizontal speed
    this.horizontalSpeed = Math.hypot(this.horizontalVelocity.x, this.horizontalVelocity.z);
    if (this.horizontalSpeed > maxSpeed) {
      const s = maxSpeed / this.horizontalSpeed;
      this.horizontalVelocity.x *= s;
      this.horizontalVelocity.z *= s;
      this.horizontalSpeed = maxSpeed;
    }

    const dx = this.horizontalVelocity.x * dt;
    const dz = this.horizontalVelocity.z * dt;

    // Feet / head from eye position
    let feetY = this.position.y - this.eyeHeight;
    let headY = feetY + this.height;

    // Horizontal collision + slide
    let nx = this.position.x;
    let nz = this.position.z;
    if (this.physics) {
      const resolved = this.physics.resolveHorizontal(
        this.position.x,
        this.position.z,
        feetY,
        headY,
        dx,
        dz
      );
      nx = resolved.x;
      nz = resolved.z;
      this.physics.pushDynamics(nx, nz, dx, dz);
    } else {
      nx += dx;
      nz += dz;
    }

    // Gravity
    if (!this.grounded) {
      this.verticalVelocity -= this.gravity * dt;
      if (this.verticalVelocity < -this.maxFallSpeed) {
        this.verticalVelocity = -this.maxFallSpeed;
      }
    }

    let proposedFeetY = feetY + this.verticalVelocity * dt;

    // Ground probe
    let ground = null;
    if (this.physics) {
      ground = this.physics.probeGround(nx, proposedFeetY, nz);
    } else {
      ground = { grounded: proposedFeetY <= 0, height: 0, slope: 0, surface: 'ground', normal: _UP };
    }

    // Slope: too steep → don't stand, slide down a bit
    if (ground.slope > (this.physics?.maxWalkableSlope ?? 0.8) && ground.distance < 0.3) {
      // Push downhill
      const slide = 2.5 * dt;
      // Downhill is +normal.xz for upward-facing normals with positive XZ tilt
      nx += (ground.normal?.x || 0) * slide * 2;
      nz += (ground.normal?.z || 0) * slide * 2;
      this.grounded = false;
    }

    // Land / stay grounded
    if (this.verticalVelocity <= 0 && ground.distance <= 0.12 && ground.slope <= (this.physics?.maxWalkableSlope ?? 0.8) + 0.05) {
      proposedFeetY = ground.height;
      this.verticalVelocity = 0;
      this.grounded = true;
      this.canJump = true;
    } else if (ground.distance > 0.15) {
      this.grounded = false;
    }

    // Step-up assist
    if (this.grounded && ground.height > feetY && ground.height - feetY <= (this.physics?.maxStepHeight ?? 0.35)) {
      proposedFeetY = ground.height;
    }

    // Ceiling
    headY = proposedFeetY + this.height;
    if (this.physics) {
      const ceil = this.physics.resolveCeiling(nx, nz, headY, proposedFeetY);
      if (ceil !== null && headY > ceil) {
        proposedFeetY = ceil - this.height;
        if (this.verticalVelocity > 0) this.verticalVelocity = 0;
      }
    }

    // Apply position (eye = feet + eyeHeight)
    this.position.x = nx;
    this.position.z = nz;
    this.position.y = proposedFeetY + this.eyeHeight;

    // Fall out of world → respawn
    if (this.position.y < this.worldMinY || proposedFeetY < this.worldMinY) {
      this.respawn();
      return;
    }

    // Triggers / hazards
    if (this.physics) {
      this.physics.updateTriggers(
        this.position.x,
        proposedFeetY,
        this.position.z,
        proposedFeetY + this.height
      );
    }

    // Head bob (grounded + moving only)
    if (
      this.headBobEnabled &&
      this.grounded &&
      this.horizontalSpeed > 1.2
    ) {
      this.headBobTimer += dt * this.headBobSpeed * (this.sprint ? 1.35 : 1);
      this._bobOffset = Math.sin(this.headBobTimer) * this.headBobAmount * Math.min(1, this.horizontalSpeed / this.walkSpeed);
    } else {
      this._bobOffset *= 0.85;
      if (Math.abs(this._bobOffset) < 0.001) this._bobOffset = 0;
    }

    this.camera.position.set(
      this.position.x,
      this.position.y + this._bobOffset,
      this.position.z
    );
  }
}

const _UP = new THREE.Vector3(0, 1, 0);
