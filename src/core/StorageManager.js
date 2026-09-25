/**
 * StorageManager — LocalStorage + IndexedDB abstraction.
 * Certificates and progress survive offline.
 */
const DB_NAME = 'jh_safety_sim';
const DB_VERSION = 1;
const STORE = 'certificates';

function safeParse(raw, fallback) {
  try {
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

export class StorageManager {
  constructor() {
    this.db = null;
    // BUGFIX: _initDB() resolves asynchronously. Earlier code left this
    // unawaited, so saveCertificate()/getCertificates() decided IndexedDB-vs-
    // localStorage independently based on whatever this.db happened to be at
    // that exact moment — a real certificate could be written to localStorage
    // (db not ready yet) and then never found by getCertificates() (db ready
    // by then, and it only looked in IndexedDB). Certs could silently vanish
    // from Progress / Certificates / admin.html / verify.html.
    // Store the init promise so every call can await the same readiness state.
    this.dbReady = this._initDB().catch(() => { this.db = null; });
  }

  async _initDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  // Progress
  getProgress() {
    return safeParse(localStorage.getItem('jh_progress'), {});
  }

  saveProgress(data) {
    localStorage.setItem('jh_progress', JSON.stringify(data));
  }

  // Settings
  getSettings() {
    return safeParse(localStorage.getItem('jh_settings'), {});
  }

  saveSettings(data) {
    localStorage.setItem('jh_settings', JSON.stringify(data));
  }

  // Certificates (IndexedDB preferred; always mirrored to localStorage too).
  // admin.html and verify.html are plain standalone pages that read
  // localStorage directly (they can't easily share this class), so every
  // certificate is written to both stores to keep them in sync no matter
  // which page or timing wrote it.
  async saveCertificate(cert) {
    await this.dbReady;

    const list = this.getLocalCerts();
    if (!list.some((c) => c.id === cert.id)) {
      list.push(cert);
      localStorage.setItem('jh_certificates', JSON.stringify(list));
    }

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(cert);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  async getCertificates() {
    await this.dbReady;
    const local = this.getLocalCerts();
    if (this.db) {
      const fromDb = await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      // Merge so certs saved before IndexedDB was ready (localStorage-only)
      // still show up.
      const byId = new Map(fromDb.map((c) => [c.id, c]));
      for (const c of local) if (!byId.has(c.id)) byId.set(c.id, c);
      return [...byId.values()];
    }
    return local;
  }

  getLocalCerts() {
    const list = safeParse(localStorage.getItem('jh_certificates'), []);
    return Array.isArray(list) ? list : [];
  }

  async getCertificateById(id) {
    const all = await this.getCertificates();
    return all.find(c => c.id === id) || null;
  }
}
