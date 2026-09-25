/**
 * TrainingEngine — central orchestrator.
 * Training logic is independent of the renderer (Three.js or future AR).
 *
 * Architecture:
 *   TrainingEngine
 *     ├── ScenarioManager
 *     ├── ObjectiveManager
 *     ├── AssessmentEngine
 *     ├── ScoreManager
 *     ├── CertificateManager
 *     ├── LocalizationManager
 *     ├── StorageManager
 *     └── Renderer (ThreeJSRenderer | FutureARRenderer)
 */
import { LocalizationManager } from './LocalizationManager.js';
import { StorageManager } from './StorageManager.js';
import { ScoreManager } from './ScoreManager.js';
import { ObjectiveManager } from './ObjectiveManager.js';
import { AssessmentEngine } from './AssessmentEngine.js';
import { CertificateManager } from './CertificateManager.js';
import { ScenarioManager } from './ScenarioManager.js';
import { InteractionSystem } from './InteractionSystem.js';

export class TrainingEngine {
  constructor() {
    this.i18n = new LocalizationManager();
    this.storage = new StorageManager();
    this.score = new ScoreManager();
    this.objectives = new ObjectiveManager();
    this.assessment = new AssessmentEngine(this.score);
    this.certificates = new CertificateManager(this.storage);
    this.scenarios = new ScenarioManager({
      objectiveManager: this.objectives,
      scoreManager: this.score,
      i18n: this.i18n,
    });
    this.interaction = null; // set after renderer/camera ready
    this.renderer = null;
    this.mode = 'menu'; // menu | module | assessment
    this.currentModule = null;
    this.traineeName = localStorage.getItem('jh_trainee') || 'Trainee';
  }

  setRenderer(renderer) {
    this.renderer = renderer;
  }

  initInteraction(camera, scene) {
    this.interaction = new InteractionSystem(camera, scene);
    return this.interaction;
  }

  setTraineeName(name) {
    this.traineeName = name || 'Trainee';
    localStorage.setItem('jh_trainee', this.traineeName);
  }

  // Called by UI / world when player enters a module
  startModule(moduleId) {
    this.currentModule = moduleId;
    this.mode = 'module';
    this.score.reset();
  }

  endModule() {
    this.mode = 'assessment';
  }

  async finishAndCertify(moduleId, moduleName) {
    const result = this.assessment.buildResult(moduleId, moduleName);
    let cert = null;
    if (result.passed) {
      cert = await this.certificates.create({
        traineeName: this.traineeName,
        moduleId,
        moduleName,
        score: result.score,
        duration: result.time,
        passed: true,
      });
    }
    return { result, cert };
  }
}
