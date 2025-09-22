/**
 * Radio Adamowo - i18n Toggle (PL default, EN/NL optional)
 * Uses modules/i18n/manager.js to manage language preference and UI updates.
 * Note: Only elements with i18n data attributes will auto-update; the rest stays as-is for MVP.
 */
import { I18nManager } from '../modules/i18n/manager.js';

const DEFAULT_LANG = 'pl';
const SUPPORTED = ['pl', 'en', 'nl'];
const STORAGE_KEY = 'radio-adamowo-language';

function setActiveButton(lang) {
  const buttons = document.querySelectorAll('#lang-switcher [data-lang]');
  buttons.forEach(btn => {
    const active = btn.getAttribute('data-lang') === lang;
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.classList.toggle('text-gray-200', active);
    btn.classList.toggle('text-gray-400', !active);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const i18n = new I18nManager({
    defaultLanguage: DEFAULT_LANG,
    supportedLanguages: SUPPORTED,
    storageKey: STORAGE_KEY,
    fallbackLanguage: 'pl'
  });

  // Expose globally if needed
  window.i18n = i18n;

  try {
    await i18n.init();
  } catch (e) {
    console.warn('i18n init failed:', e);
  }

  setActiveButton(i18n.getCurrentLanguage());

  const switcher = document.getElementById('lang-switcher');
  if (switcher) {
    switcher.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-lang]');
      if (!btn) return;
      const lang = btn.getAttribute('data-lang');
      if (!SUPPORTED.includes(lang)) return;

      const ok = await i18n.setLanguage(lang);
      if (ok) {
        setActiveButton(lang);
      }
    });
  }
});