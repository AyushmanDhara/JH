/**
 * Simple AudioManager — can be expanded with real assets later.
 */
export class AudioManager {
  constructor() {
    this.volume = 0.7;
    this.enabled = true;
    this.ctx = null;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  // Procedural short beep for feedback (no external files required)
  playBeep(freq = 440, duration = 0.08, type = 'sine') {
    if (!this.enabled) return;
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = this.volume * 0.15;
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.stop(this.ctx.currentTime + duration);
    } catch (_) {}
  }

  playSuccess() {
    this.playBeep(660, 0.1);
    setTimeout(() => this.playBeep(880, 0.12), 80);
  }

  playError() {
    this.playBeep(220, 0.15, 'square');
  }

  playAlarm() {
    this.playBeep(800, 0.2);
    setTimeout(() => this.playBeep(600, 0.2), 200);
  }
}
