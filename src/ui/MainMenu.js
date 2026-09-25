/**
 * MainMenu — menu navigation helpers.
 * DOM is defined in index.html; this module wires actions.
 */
export class MainMenu {
  constructor({ onAction, i18n }) {
    this.onAction = onAction;
    this.i18n = i18n;
    this.root = document.getElementById('main-menu');
  }

  show() {
    this.root?.classList.add('active');
  }

  hide() {
    this.root?.classList.remove('active');
  }

  bind() {
    this.root?.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.onAction) this.onAction(btn.dataset.action);
      });
    });
  }

  applyLanguage() {
    const t = (k) => this.i18n.t(k);
    const map = {
      '[data-action="start"]': 'startTraining',
      '[data-action="modules"]': 'trainingModules',
      '[data-action="progress"]': 'progress',
      '[data-action="certificates"]': 'certificates',
      '[data-action="howto"]': 'howToPlay',
      '[data-action="settings"]': 'settings',
    };
    Object.entries(map).forEach(([sel, key]) => {
      const el = this.root?.querySelector(sel);
      if (el) el.textContent = t(key);
    });
  }
}
