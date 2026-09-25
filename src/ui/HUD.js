/**
 * HUD controller — updates score, objective, interaction prompt, notifications.
 */
export class HUD {
  constructor(i18n) {
    this.i18n = i18n;
    this.root = document.getElementById('hud');
    this.moduleName = document.getElementById('module-name');
    this.scoreValue = document.getElementById('score-value');
    this.objectiveText = document.getElementById('objective-text');
    this.prompt = document.getElementById('interaction-prompt');
    this.promptText = this.prompt?.querySelector('.prompt-text');
    this.notifArea = document.getElementById('notification-area');
  }

  show() {
    this.root?.classList.remove('hidden');
  }

  hide() {
    this.root?.classList.add('hidden');
  }

  setModule(name) {
    if (this.moduleName) this.moduleName.textContent = name;
  }

  setScore(n) {
    if (this.scoreValue) this.scoreValue.textContent = String(n);
  }

  setObjective(text) {
    if (this.objectiveText) this.objectiveText.textContent = text;
  }

  setPrompt(visible, label = 'INTERACT') {
    if (!this.prompt) return;
    if (visible) {
      this.prompt.classList.remove('hidden');
      if (this.promptText) this.promptText.textContent = label;
    } else {
      this.prompt.classList.add('hidden');
    }
  }

  clearNotifications() {
    this.notifArea?.replaceChildren();
  }

  notify(message, type = 'info', duration = 2800) {
    if (!this.notifArea) return;
    // Keep the stack short so toasts never cover the scene or the objective panel
    while (this.notifArea.children.length >= 3) this.notifArea.firstElementChild?.remove();
    const el = document.createElement('div');
    el.className = `notification ${type}`;
    el.textContent = message;
    this.notifArea.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
}
