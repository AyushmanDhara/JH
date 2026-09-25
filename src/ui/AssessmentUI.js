/**
 * AssessmentUI — displays scenario results + knowledge quiz.
 */
export class AssessmentUI {
  constructor({ onContinue, i18n }) {
    this.onContinue = onContinue;
    this.i18n = i18n;
    this.root = document.getElementById('assessment-modal');
    this.quizAnswers = [];
  }

  show(result, quiz) {
    document.getElementById('assess-module').textContent = result.moduleName;
    document.getElementById('assess-score').textContent = `${result.score}%`;
    document.getElementById('assess-correct').textContent =
      `${result.correct}/${result.correct + result.incorrect}`;
    document.getElementById('assess-unsafe').textContent = String(result.unsafe);
    document.getElementById('assess-time').textContent = result.time;
    const resEl = document.getElementById('assess-result');
    resEl.textContent = result.passed
      ? this.i18n.t('passed')
      : this.i18n.t('failed');
    resEl.style.color = result.passed ? 'var(--accent-green)' : 'var(--danger)';

    this._renderQuiz(quiz || []);
    this.root?.classList.add('active');
  }

  hide() {
    this.root?.classList.remove('active');
  }

  _renderQuiz(quiz) {
    const section = document.getElementById('quiz-section');
    const container = document.getElementById('quiz-container');
    this.quizAnswers = [];
    container.innerHTML = '';
    quiz.forEach((q, qi) => {
      const div = document.createElement('div');
      div.className = 'quiz-q';
      div.innerHTML = `<p>${qi + 1}. ${q.q}</p>`;
      q.options.forEach((opt, oi) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
          div.querySelectorAll('.quiz-opt').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          this.quizAnswers[qi] = oi;
        });
        div.appendChild(btn);
      });
      container.appendChild(div);
    });
    section?.classList.remove('hidden');
  }

  bind() {
    document.getElementById('btn-continue-assess')?.addEventListener('click', () => {
      if (this.onContinue) this.onContinue(this.quizAnswers);
    });
  }

  getAnswers() {
    return this.quizAnswers;
  }
}
