/**
 * LocalizationManager — JSON-based i18n.
 * Keeps all UI/training strings out of components.
 */
import en from '../i18n/en.js';
import hi from '../i18n/hi.js';
import sat from '../i18n/sat.js';

const locales = { en, hi, sat };

export class LocalizationManager {
  constructor() {
    this.lang = localStorage.getItem('jh_lang') || 'en';
    this.dict = locales[this.lang] || en;
    this.listeners = [];
  }

  setLanguage(code) {
    if (!locales[code]) return;
    this.lang = code;
    this.dict = locales[code];
    localStorage.setItem('jh_lang', code);
    this.listeners.forEach(fn => fn(code));
  }

  t(key) {
    return this.dict[key] ?? en[key] ?? key;
  }

  onChange(fn) {
    this.listeners.push(fn);
  }
}
