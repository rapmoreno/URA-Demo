"use strict";

/**
 * Module: effect.translation.js
 * Type: Effect module
 * Purpose: i18n - fetch translations, setLanguage, dispatch app:language-changed.
 *
 * Depends on: effect.error.js, effect.state.js, config.js
 * Used by: main.js, components
 * Side effects: fetch, DOM updates, custom events
 */

import { handleError } from "./effect.error.js";
import { getState, updateState } from "./effect.state.js";
import { CONFIG } from "./config.js";

const supportedLanguages = Object.freeze({
  en: "English",
  zh: "中文",
  ms: "Melayu",
  ta: "தமிழ்",
});

const translations = {};

/**
 * @param {string} lang
 * @returns {Promise<void>}
 */
export async function loadTranslations(lang) {
  if (translations[lang]) return;
  try {
    const response = await fetch(`${CONFIG.TRANSLATIONS_BASE}/${lang}.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    translations[lang] = await response.json();
  } catch (err) {
    handleError(err, { module: "effect.translation", lang });
    if (lang !== "en" && !translations.en) {
      await loadTranslations("en");
    }
  }
}

/**
 * @param {string} key
 * @returns {string | null}
 */
function getNestedTranslation(key) {
  const t = translations[getState().language];
  if (!t) return null;
  const keys = key.split(".");
  let cur = t;
  for (const k of keys) {
    if (cur && typeof cur === "object" && k in cur) {
      cur = cur[k];
    } else {
      return null;
    }
  }
  return typeof cur === "string" ? cur : null;
}

/**
 * Renders translation string safely without innerHTML.
 * Supports <br> and <br/> as line breaks via DOM nodes.
 * @param {Element} el
 * @param {string} str
 */
function setElementContentSafe(el, str) {
  el.textContent = "";
  if (!str || typeof str !== "string") return;
  const parts = str.split(/<br\s*\/?>/i);
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) el.appendChild(document.createElement("br"));
    el.appendChild(document.createTextNode(parts[i]));
  }
}

function updateTranslatedElements() {
  document.querySelectorAll("[data-translate]").forEach((el) => {
    const key = el.getAttribute("data-translate");
    const val = getNestedTranslation(key);
    if (val) setElementContentSafe(el, val);
  });
}

function updateLanguageToggle() {
  const span = document.getElementById("currentLanguage");
  if (span) span.textContent = supportedLanguages[getState().language] ?? getState().language;
}

/**
 * @param {string} lang
 * @returns {Promise<void>}
 */
export async function setLanguage(lang) {
  if (!(lang in supportedLanguages)) return;
  if (!translations[lang]) await loadTranslations(lang);
  updateState((s) => ({ ...s, language: lang }));
  document.body.setAttribute("data-lang", lang);
  updateTranslatedElements();
  updateLanguageToggle();
  document.dispatchEvent(
    new CustomEvent("app:language-changed", {
      detail: { lang, translations: translations[lang] },
    })
  );
}

/**
 * @returns {Promise<void>}
 */
export async function initTranslation() {
  const saved = getState().language;
  await loadTranslations(saved);
  await setLanguage(saved);
}

export function getCurrentLanguage() {
  return getState().language;
}

export function getTranslations() {
  return translations;
}

export function getSupportedLanguages() {
  return supportedLanguages;
}
