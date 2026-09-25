/**
 * CertificateManager — generates certificate data + QR payload.
 * ID format: JH-SAFE-YYYY-XXXXXX
 */
export class CertificateManager {
  constructor(storage) {
    this.storage = storage;
  }

  generateId() {
    const year = new Date().getFullYear();
    let rand;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(6);
      crypto.getRandomValues(buf);
      rand = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    } else {
      rand = Math.random().toString(16).slice(2, 14).toUpperCase();
    }
    return `JH-SAFE-${year}-${rand}`;
  }

  async create({ traineeName, moduleId, moduleName, score, duration, passed }) {
    const cert = {
      id: this.generateId(),
      traineeName: traineeName || 'Trainee',
      moduleId,
      moduleName,
      score,
      duration,
      date: new Date().toISOString().slice(0, 10),
      passed: !!passed,
      createdAt: Date.now(),
    };
    await this.storage.saveCertificate(cert);
    return cert;
  }

  async list() {
    return this.storage.getCertificates();
  }

  async verify(id) {
    return this.storage.getCertificateById(id);
  }
}
