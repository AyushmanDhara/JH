/**
 * TrainingMenu — module selection grid.
 */
export class TrainingMenu {
  constructor({ onSelect, onBack }) {
    this.onSelect = onSelect;
    this.onBack = onBack;
    this.root = document.getElementById('modules-menu');
  }

  show() {
    this.root?.classList.add('active');
  }

  hide() {
    this.root?.classList.remove('active');
  }

  bind() {
    this.root?.querySelectorAll('.module-card').forEach((card) => {
      card.addEventListener('click', () => {
        if (this.onSelect) this.onSelect(card.dataset.module);
      });
    });
    this.root?.querySelectorAll('[data-action="back-menu"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.onBack) this.onBack();
      });
    });
  }
}
