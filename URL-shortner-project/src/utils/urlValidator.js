const { z } = require('zod');

// Allowed URL protocols
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

// Block private/local addresses
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
];

const BLOCKED_HOSTNAME_PATTERNS = [
  /^10\.\d+\.\d+\.\d+$/, // 10.x.x.x
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/, // 172.16-31.x.x
  /^192\.168\.\d+\.\d+$/, // 192.168.x.x
];

/**
 * Validate that a URL is safe to shorten.
 * Checks protocol, hostname, and SSRF-prevention rules.
 *
 * @param {string} urlString
 * @returns {{ valid: boolean, error?: string, normalised?: string }}
 */
function validateUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  const trimmed = urlString.trim();

  if (trimmed.length > 2048) {
    return { valid: false, error: 'URL exceeds maximum length of 2048 characters' };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return {
      valid: false,
      error: `URL protocol must be one of: ${ALLOWED_PROTOCOLS.join(', ')}`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: 'URLs pointing to local addresses are not allowed' };
  }

  for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'URLs pointing to private IP ranges are not allowed' };
    }
  }

  if (!hostname.includes('.') && !hostname.startsWith('[')) {
    return { valid: false, error: 'URL must have a valid hostname with a TLD' };
  }

  return { valid: true, normalised: parsed.toString() };
}

/**
 * Zod schema for the create-URL request body
 */
const createUrlSchema = z.object({
  originalUrl: z
    .string({ required_error: 'originalUrl is required' })
    .min(1, 'originalUrl cannot be empty')
    .max(2048, 'URL is too long'),
  customAlias: z
    .string()
    .min(3, 'Custom alias must be at least 3 characters')
    .max(50, 'Custom alias must not exceed 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Alias may only contain letters, numbers, hyphens, underscores')
    .optional(),
  expiresInDays: z
    .number()
    .int('expiresInDays must be an integer')
    .min(1, 'Minimum expiry is 1 day')
    .max(3650, 'Maximum expiry is 3650 days (10 years)')
    .optional(),
  title: z
    .string()
    .max(255, 'Title is too long')
    .optional(),
});

module.exports = { validateUrl, createUrlSchema };
