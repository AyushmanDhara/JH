/**
 * ScenarioManager — loads and drives scenario state machines.
 * Decoupled from renderer so AR can reuse the same logic.
 */
export class ScenarioManager {
  constructor({ objectiveManager, scoreManager, i18n }) {
    this.objectives = objectiveManager;
    this.score = scoreManager;
    this.i18n = i18n;
    this.active = null; // { id, name, state, onEvent }
    this.state = 'idle';
    this.listeners = [];
  }

  start(scenario) {
    // scenario: { id, name, objectives: [{id, textKey}], onStart, onEvent, onComplete }
    this.active = scenario;
    this.state = 'running';
    this.score.reset();
    this.objectives.setObjectives(scenario.objectives || []);
    if (typeof scenario.onStart === 'function') scenario.onStart();
    this._emit('start', scenario);
  }

  handleEvent(eventName, payload = {}) {
    if (!this.active || this.state !== 'running') return;
    if (typeof this.active.onEvent === 'function') {
      this.active.onEvent(eventName, payload, {
        objectives: this.objectives,
        score: this.score,
        complete: () => this.complete(),
      });
    }
    this._emit('event', { eventName, payload });
  }

  complete() {
    if (!this.active || this.state === 'complete') return;
    this.state = 'complete';
    if (typeof this.active.onComplete === 'function') {
      this.active.onComplete();
    }
    this._emit('complete', this.active);
  }

  abort() {
    if (this.active && typeof this.active.dispose === 'function') {
      this.active.dispose();
    }
    this.active = null;
    this.state = 'idle';
    this._emit('abort');
  }

  on(fn) {
    this.listeners.push(fn);
  }

  _emit(type, data) {
    this.listeners.forEach(fn => fn(type, data));
  }
}
