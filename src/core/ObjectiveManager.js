/**
 * ObjectiveManager — ordered list of objectives for a scenario.
 * Emits updates when current objective changes or completes.
 */
export class ObjectiveManager {
  constructor() {
    this.objectives = [];
    this.currentIndex = 0;
    this.listeners = [];
  }

  setObjectives(list) {
    // list: [{ id, textKey, completed: false }]
    this.objectives = list.map(o => ({ ...o, completed: false }));
    this.currentIndex = 0;
    this._notify();
  }

  getCurrent() {
    return this.objectives[this.currentIndex] || null;
  }

  getCurrentText(i18n) {
    const cur = this.getCurrent();
    return cur ? i18n.t(cur.textKey) : '';
  }

  completeCurrent() {
    const cur = this.getCurrent();
    if (!cur || cur.completed) return false;
    cur.completed = true;
    this.currentIndex += 1;
    this._notify();
    return true;
  }

  completeById(id) {
    const idx = this.objectives.findIndex(o => o.id === id);
    if (idx === -1 || this.objectives[idx].completed) return false;
    this.objectives[idx].completed = true;
    if (idx === this.currentIndex) {
      this.currentIndex += 1;
      // skip already completed
      while (
        this.currentIndex < this.objectives.length &&
        this.objectives[this.currentIndex].completed
      ) {
        this.currentIndex += 1;
      }
    }
    this._notify();
    return true;
  }

  isAllComplete() {
    return this.objectives.every(o => o.completed);
  }

  onChange(fn) {
    this.listeners.push(fn);
  }

  _notify() {
    this.listeners.forEach(fn => fn(this.getCurrent(), this.objectives));
  }
}
