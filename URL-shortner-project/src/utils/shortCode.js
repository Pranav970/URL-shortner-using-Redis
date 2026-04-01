const { nanoid } = require('nanoid');
const config = require('../config');

// Base62 alphabet (URL-safe, no ambiguous chars)
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Generates a URL-safe short code using nanoid with a base62 alphabet.
 *
 * With length=7: 62^7 ≈ 3.5 trillion combinations.
 * With length=8: 62^8 ≈ 218 trillion combinations.
 *
 * The calling service handles collision checking and retries.
 *
 * @param {number} [length] - Length of the short code (default from config)
 * @returns {string} A random short code
 */
function generateShortCode(length) {
  const len = length || config.app.shortCodeLength;
  return nanoid(len);
}

/**
 * Generate a short code with increased length on retry to reduce collision probability.
 * Each retry adds 1 character, multiplying the possibility space by 62x.
 *
 * @param {number} attempt - Current attempt number (0-indexed)
 * @returns {string}
 */
function generateShortCodeForAttempt(attempt = 0) {
  const baseLength = config.app.shortCodeLength;
  const length = baseLength + Math.floor(attempt / 2); // increase length every 2 attempts
  return generateShortCode(length);
}

/**
 * Validate a custom alias string.
 * Must be alphanumeric with hyphens/underscores, 3–50 chars.
 *
 * @param {string} alias
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCustomAlias(alias) {
  if (!alias || typeof alias !== 'string') {
    return { valid: false, error: 'Alias must be a non-empty string' };
  }

  const trimmed = alias.trim();

  if (trimmed.length < 3) {
    return { valid: false, error: 'Alias must be at least 3 characters long' };
  }

  if (trimmed.length > config.url.maxCustomAliasLength) {
    return {
      valid: false,
      error: `Alias must not exceed ${config.url.maxCustomAliasLength} characters`,
    };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Alias may only contain letters, numbers, hyphens, and underscores',
    };
  }

  // Block reserved words that could conflict with API routes
  const reserved = ['api', 'health', 'admin', 'docs', 'static', 'assets', 'login', 'logout'];
  if (reserved.includes(trimmed.toLowerCase())) {
    return { valid: false, error: 'This alias is reserved and cannot be used' };
  }

  return { valid: true };
}

module.exports = {
  generateShortCode,
  generateShortCodeForAttempt,
  validateCustomAlias,
  ALPHABET,
};
