import { customAlphabet } from 'nanoid';
import env from '../config/env.js';

// URL-safe alphabet — avoids ambiguous chars like 0/O, 1/l/I
const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generate = customAlphabet(alphabet, env.shortCodeLength);
const generateLong = customAlphabet(alphabet, env.shortCodeLength + 2);

/**
 * Generate a unique short code of configurable length.
 * @param {number} attempt - 0-indexed retry count
 * @returns {string}
 */
export const generateShortCode = (attempt = 0) => {
  if (attempt === 0) return generate();
  // Simple non-blocking entropy for retries
  const entropy = Math.random().toString(36).substring(2, 6);
  return (generateLong() + entropy).slice(0, env.shortCodeLength + 2);
};


/**
 * Create a stable hash key for reverse-lookup deduplication.
 * Uses a simple, fast digest of the URL string.
 * @param {string} url
 * @returns {string}
 */
export const hashUrl = (url) => {
  // Simple djb2 hash — fast and good enough for a lookup key
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash) ^ url.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned 32-bit
  }
  return hash.toString(36);
};
