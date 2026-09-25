/**
 * ScoreManager — tracks score, actions, time.
 * Start 100. Correct +5, Wrong −10, Unsafe −15, Objective +5, Evacuation +10.
 */
export class ScoreManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 100;
    this.correct = 0;
    this.incorrect = 0;
    this.unsafe = 0;
    this.objectivesCompleted = 0;
    this.startTime = Date.now();
    this.endTime = null;
    this.ppeCompliant = true;
  }

  addCorrect() {
    this.score = Math.min(100, this.score + 5);
    this.correct += 1;
    return this.score;
  }

  addWrong() {
    this.score = Math.max(0, this.score - 10);
    this.incorrect += 1;
    return this.score;
  }

  addUnsafe() {
    this.score = Math.max(0, this.score - 15);
    this.unsafe += 1;
    return this.score;
  }

  completeObjective() {
    this.score = Math.min(100, this.score + 5);
    this.objectivesCompleted += 1;
    return this.score;
  }

  evacuationBonus() {
    this.score = Math.min(100, this.score + 10);
    return this.score;
  }

  fastResponseBonus(seconds) {
    if (seconds < 60) {
      this.score = Math.min(100, this.score + 5);
      return 5;
    }
    return 0;
  }

  finish() {
    this.endTime = Date.now();
  }

  getElapsedSeconds() {
    const end = this.endTime || Date.now();
    return Math.floor((end - this.startTime) / 1000);
  }

  formatTime() {
    const s = this.getElapsedSeconds();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  getPercentage() {
    // Display matches internal score, clamped to 0–100 for pass/fail only
    return Math.min(100, Math.max(0, Math.round(this.score)));
  }

  /** True displayed score for certificates (same as percentage for now) */
  getDisplayScore() {
    return this.getPercentage();
  }

  isPassing(threshold = 70) {
    return this.getPercentage() >= threshold;
  }

  getSummary() {
    return {
      score: this.getPercentage(),
      rawScore: this.score,
      correct: this.correct,
      incorrect: this.incorrect,
      unsafe: this.unsafe,
      objectivesCompleted: this.objectivesCompleted,
      time: this.formatTime(),
      seconds: this.getElapsedSeconds(),
      passed: this.isPassing(),
    };
  }
}
