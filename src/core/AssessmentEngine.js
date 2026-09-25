/**
 * AssessmentEngine — scenario summary + short knowledge quiz.
 */
const QUIZ_BANK = {
  fire: [
    {
      q: 'What does PASS stand for when using a fire extinguisher?',
      options: [
        'Pull, Aim, Squeeze, Sweep',
        'Point, Activate, Spray, Stop',
        'Push, Aim, Spray, Secure',
        'Pull, Activate, Squeeze, Stop',
      ],
      correct: 0,
    },
    {
      q: 'Which extinguisher is best for electrical fires?',
      options: ['Water', 'CO2', 'Foam', 'Wet chemical'],
      correct: 1,
    },
    {
      q: 'When should you evacuate during a fire?',
      options: [
        'Only after extinguishing',
        'Immediately if fire is large or spreading',
        'After calling supervisor only',
        'Never leave equipment',
      ],
      correct: 1,
    },
    {
      q: 'Where should you stand when approaching a fire?',
      options: [
        'Downwind',
        'Upwind / safe distance',
        'Directly above',
        'Inside the smoke',
      ],
      correct: 1,
    },
    {
      q: 'What is the first action on discovering a fire?',
      options: [
        'Raise the alarm / alert others',
        'Hide',
        'Take photos',
        'Continue working',
      ],
      correct: 0,
    },
  ],
  gas: [
    {
      q: 'What should you do first if you smell gas or see a gas warning?',
      options: [
        'Enter the area to investigate',
        'Do not enter, alert others, use detector',
        'Light a match to check',
        'Ignore if smell is weak',
      ],
      correct: 1,
    },
    {
      q: 'Buddy system means:',
      options: [
        'Working alone is fine',
        'Always have a partner when entering hazard zones',
        'Only supervisors enter',
        'No communication needed',
      ],
      correct: 1,
    },
    {
      q: 'A gas detector is used to:',
      options: [
        'Measure toxic / flammable gas levels',
        'Put out fires',
        'Open doors',
        'Call emergency only',
      ],
      correct: 0,
    },
    {
      q: 'If gas levels are high you should:',
      options: [
        'Stay and finish the job',
        'Evacuate to safe zone and report',
        'Remove PPE',
        'Turn off all lights only',
      ],
      correct: 1,
    },
    {
      q: 'Confined space entry requires:',
      options: [
        'No special rules',
        'PPE, testing atmosphere, permit, standby person',
        'Only a helmet',
        'Running into the space quickly',
      ],
      correct: 1,
    },
  ],
  ppe: [
    {
      q: 'Which PPE protects you from falling objects?',
      options: ['Safety goggles', 'Safety helmet', 'Reflective vest', 'Gloves'],
      correct: 1,
    },
    {
      q: 'Why wear a reflective (hi-vis) vest on site?',
      options: [
        'It keeps you warm',
        'So vehicle and crane operators can see you',
        'It replaces a helmet',
        'It is only a company uniform',
      ],
      correct: 1,
    },
    {
      q: 'Which footwear is acceptable in a mining or plant work area?',
      options: ['Sandals', 'Open-toe slippers', 'Steel-toe safety shoes', 'Any comfortable shoes'],
      correct: 2,
    },
    {
      q: 'Ordinary prescription glasses are enough eye protection when grinding or cutting.',
      options: [
        'True — they block dust',
        'False — use safety goggles or a face shield',
        'True — if they are clean',
        'Only for short jobs',
      ],
      correct: 1,
    },
    {
      q: 'What should you do if your PPE is damaged?',
      options: [
        'Keep using it carefully',
        'Report it and replace it before starting work',
        'Fix it with tape and continue',
        'Lend it to a colleague',
      ],
      correct: 1,
    },
  ],
  machinery: [
    {
      q: 'What does a painted danger zone around a machine tell you?',
      options: [
        'A good place to rest',
        'Moving parts can reach you — stay out unless the machine is isolated',
        'The machine is out of order',
        'Only visitors must stay out',
      ],
      correct: 1,
    },
    {
      q: 'What is the purpose of an emergency stop (e-stop)?',
      options: [
        'Routine shutdown at end of shift',
        'Quickly halt the machine in an emergency',
        'Make the machine safe to repair',
        'Reset production counters',
      ],
      correct: 1,
    },
    {
      q: 'What does lockout / tagout (LOTO) do?',
      options: [
        'Locks the factory gate at night',
        'Isolates energy and prevents accidental restart during servicing',
        'Tags finished products',
        'Records machine output',
      ],
      correct: 1,
    },
    {
      q: 'Before servicing a machine you have stopped with the e-stop, you must:',
      options: [
        'Start work immediately',
        'Apply your lock and tag and verify zero energy',
        'Ask a colleague to watch the button',
        'Remove the guards to work faster',
      ],
      correct: 1,
    },
    {
      q: 'Which is unsafe when working near rotating machinery?',
      options: [
        'Tying back long hair',
        'Wearing loose sleeves or dangling jewellery',
        'Wearing snug clothing',
        'Wearing safety shoes',
      ],
      correct: 1,
    },
  ],
};

export class AssessmentEngine {
  constructor(scoreManager) {
    this.scoreManager = scoreManager;
  }

  /** Module-specific quiz. Unknown modules get no quiz (never another module's questions). */
  getQuiz(moduleId) {
    return QUIZ_BANK[moduleId] || [];
  }

  scoreQuiz(answers, moduleId) {
    const quiz = this.getQuiz(moduleId);
    let correct = 0;
    answers.forEach((ans, i) => {
      if (quiz[i] && ans === quiz[i].correct) correct += 1;
    });
    // Small score influence
    const bonus = correct * 2;
    this.scoreManager.score += bonus;
    return { correct, total: quiz.length, bonus };
  }

  buildResult(moduleId, moduleName) {
    this.scoreManager.finish();
    const summary = this.scoreManager.getSummary();
    return {
      moduleId,
      moduleName,
      ...summary,
    };
  }
}
