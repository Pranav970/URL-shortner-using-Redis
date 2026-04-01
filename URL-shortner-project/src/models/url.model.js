'use strict';

/**
 * URL record shape (mirrors the database schema).
 *
 * @typedef {Object} UrlRecord
 * @property {number}  id
 * @property {string}  short_code   - The unique 7-char (or custom) code
 * @property {string}  original_url - The full destination URL
 * @property {string}  [title]      - Optional friendly title
 * @property {number}  click_count  - Total clicks
 * @property {Date}    [expires_at] - Expiry timestamp (null = never expires)
 * @property {boolean} is_active    - Soft-delete / disable flag
 * @property {Date}    created_at
 * @property {Date}    updated_at
 */

/**
 * Click record shape.
 *
 * @typedef {Object} ClickRecord
 * @property {number} id
 * @property {number} url_id
 * @property {string} [ip_address]
 * @property {string} [user_agent]
 * @property {string} [referer]
 * @property {string} [country]
 * @property {Date}   clicked_at
 */

const MAX_COLLISION_RETRIES = 5;
const CLICK_CACHE_PREFIX = 'clicks:';
const URL_CACHE_PREFIX = ''; // base prefix already set in Redis config

module.exports = {
  MAX_COLLISION_RETRIES,
  CLICK_CACHE_PREFIX,
  URL_CACHE_PREFIX,
};
