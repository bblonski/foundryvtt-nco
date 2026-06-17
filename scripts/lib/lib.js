/**
 * Shared, dependency-free helpers used across the system.
 */

const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * Escape a string for safe interpolation into an HTML template (e.g. the dice
 * chat card and sheet-generated chat messages).
 * @param {*} text  Coerced to a string before escaping.
 * @returns {string}
 */
export const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
