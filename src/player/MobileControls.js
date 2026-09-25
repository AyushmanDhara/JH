/**
 * MobileControls — virtual joystick + look zone + action buttons.
 */
export class MobileControls {
  constructor(player, rootEl) {
    this.player = player;
    this.root = rootEl;
    this.active = false;

    this.base = document.getElementById('joystick-base');
    this.stick = document.getElementById('joystick-stick');
    this.lookZone = document.getElementById('look-zone');
    this.btnSprint = document.getElementById('btn-sprint');
    this.btnJump = document.getElementById('btn-jump');
    this.btnInteract = document.getElementById('btn-interact');

    this.joyTouchId = null;
    this.lookTouchId = null;
    this.lastLook = { x: 0, y: 0 };
    this.onInteract = null;

    this._bind();
  }

  show() {
    this.root.classList.remove('hidden');
    this.active = true;
  }

  hide() {
    this.root.classList.add('hidden');
    this.active = false;
    this.player.setMobileMove(0, 0);
  }

  _bind() {
    // Joystick
    this.base.addEventListener('touchstart', (e) => this._joyStart(e), { passive: false });
    this.base.addEventListener('touchmove', (e) => this._joyMove(e), { passive: false });
    this.base.addEventListener('touchend', (e) => this._joyEnd(e), { passive: false });
    this.base.addEventListener('touchcancel', (e) => this._joyEnd(e), { passive: false });

    // Look
    this.lookZone.addEventListener('touchstart', (e) => this._lookStart(e), { passive: false });
    this.lookZone.addEventListener('touchmove', (e) => this._lookMove(e), { passive: false });
    this.lookZone.addEventListener('touchend', (e) => this._lookEnd(e), { passive: false });
    this.lookZone.addEventListener('touchcancel', (e) => this._lookEnd(e), { passive: false });

    this.btnSprint.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.player.setMobileSprint(true);
    });
    this.btnSprint.addEventListener('touchend', () => this.player.setMobileSprint(false));

    this.btnJump.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.player.setMobileJump();
    });

    this.btnInteract.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.onInteract) this.onInteract();
    });
  }

  _joyStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    this.joyTouchId = t.identifier;
    this._updateJoy(t);
  }

  _joyMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyTouchId) this._updateJoy(t);
    }
  }

  _joyEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyTouchId) {
        this.joyTouchId = null;
        this.stick.style.transform = 'translate(-50%, -50%)';
        this.player.setMobileMove(0, 0);
      }
    }
  }

  _updateJoy(t) {
    const rect = this.base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = t.clientX - cx;
    let dy = t.clientY - cy;
    const max = rect.width / 2 - 10;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    this.player.setMobileMove(dx / max, -dy / max);
  }

  _lookStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    this.lookTouchId = t.identifier;
    this.lastLook = { x: t.clientX, y: t.clientY };
  }

  _lookMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.lookTouchId) {
        const dx = t.clientX - this.lastLook.x;
        const dy = t.clientY - this.lastLook.y;
        this.lastLook = { x: t.clientX, y: t.clientY };
        this.player.setMobileLook(dx, dy);
      }
    }
  }

  _lookEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this.lookTouchId) this.lookTouchId = null;
    }
  }
}
