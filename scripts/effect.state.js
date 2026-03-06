"use strict";

/**
 * Module: effect.state.js
 * Type: Effect module
 * Purpose: Single state store. Only file allowed to hold state.
 *
 * Depends on: nothing
 * Used by: effect modules, components
 * Side effects: Mutates state, dispatches app:state-changed
 */

const STORAGE_KEYS = Object.freeze({ theme: "ura-theme", language: "ura-language" });

function loadFromStorage() {
  return Object.freeze({
    theme: localStorage.getItem(STORAGE_KEYS.theme) || "light",
    language: localStorage.getItem(STORAGE_KEYS.language) || "en",
  });
}

let state = loadFromStorage();

function persist(key, value) {
  if (key in STORAGE_KEYS) {
    localStorage.setItem(STORAGE_KEYS[key], value);
  }
}

/**
 * @param {(s: object) => object} reducer
 */
export function updateState(reducer) {
  const prev = state;
  const next = Object.freeze(reducer({ ...state }));
  if (next !== prev) {
    state = next;
    if (next.theme !== prev.theme) persist("theme", next.theme);
    if (next.language !== prev.language) persist("language", next.language);
    document.dispatchEvent(
      new CustomEvent("app:state-changed", { detail: { state } })
    );
  }
}

export function getState() {
  return state;
}
