import { URL } from 'url';

/**
 * A curated list of known malicious, phishing, or adult domains.
 * In a real-world scenario, this might sync with an external DB.
 */
const BLACKLISTED_DOMAINS = [
  'malware-site.com',
  'phishing-attack.net',
  'free-crypto-giveaway.xyz',
  'stealyourpassword.org',
  'hackme.net'
];

/**
 * A curated list of keywords typically found in spam or abuse links.
 */
const SPAM_KEYWORDS = [
  'crypto',
  'giveaway',
  'free-money',
  'viagra',
  'casino',
  'xxx',
  'porn'
];

/**
 * A list of known URL shortener domains.
 * We block shortening already-shortened links (chaining) to prevent abuse obfuscation.
 */
const KNOWN_SHORTENERS = [
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  't.co',
  'is.gd',
  'buff.ly',
  'ow.ly'
];

/**
 * Analyzes the URL, alias, and title for malicious patterns or spam.
 * @param {string} targetUrl - The original URL the user wants to shorten
 * @param {string} [customAlias] - The requested custom alias
 * @param {string} [title] - The title of the link
 * @returns {object} { isSafe: boolean, reason?: string }
 */
export const checkSecurity = (targetUrl, customAlias = '', title = '') => {
  try {
    const parsedUrl = new URL(targetUrl);
    const domain = parsedUrl.hostname.toLowerCase();

    // 1. Check Blacklisted Domains
    if (BLACKLISTED_DOMAINS.some(badDomain => domain.includes(badDomain))) {
      return { isSafe: false, reason: 'This domain is flagged as malicious.' };
    }

    // 2. Prevent Shortener Chaining
    if (KNOWN_SHORTENERS.some(shortener => domain.includes(shortener))) {
      return { isSafe: false, reason: 'Shortening an already shortened link is not permitted.' };
    }

    // 3. Check for Spam Keywords in URL, Alias, or Title
    const combinedText = `${targetUrl} ${customAlias} ${title}`.toLowerCase();
    const foundSpamWord = SPAM_KEYWORDS.find(word => combinedText.includes(word));
    
    if (foundSpamWord) {
      return { isSafe: false, reason: 'Content flagged as spam.' };
    }

    // Passed all checks
    return { isSafe: true };
  } catch (error) {
    // If URL parsing fails, it's an invalid URL
    return { isSafe: false, reason: 'Invalid URL format.' };
  }
};
