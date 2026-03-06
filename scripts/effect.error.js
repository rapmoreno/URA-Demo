"use strict";

/**
 * Module: effect.error.js
 * Type: Effect module
 * Purpose: Centralized error handler. All errors go through here.
 *
 * Depends on: nothing
 *
 * Used by: all effect.* modules
 *
 * Side effects: Logs to console, may dispatch app:error
 */

/**
 * @param {() => Promise<void> | void} fn
 * @returns {Promise<void> | void}
 */
export function withErrorHandling(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      handleError(err);
      throw err;
    }
  };
}

/**
 * @param {Error} err
 * @param {object} [context]
 */
export function handleError(err, context = {}) {
  console.error("[effect.error]", err.message, context);
  document.dispatchEvent(
    new CustomEvent("app:error", {
      detail: { error: err, ...context },
    })
  );
}

/**
 * @param {string} message
 * @param {object} [data]
 */
export function addBreadcrumb(message, data = {}) {
  console.debug("[breadcrumb]", message, data);
}
