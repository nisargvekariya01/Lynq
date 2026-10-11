import { URL } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import env from "../config/env.js";

let genAI = null;
if (env.geminiApiKey) {
  genAI = new GoogleGenerativeAI(env.geminiApiKey);
}

/**
 * Known malicious, phishing, or adult domains.
 */
const BLACKLISTED_DOMAINS = [
  "malware-site.com",
  "phishing-attack.net",
  "free-crypto-giveaway.xyz",
  "stealyourpassword.org",
  "hackme.net",
  "credential-harvester.com",
  "fake-login-portal.net",
  "account-recovery-scam.com",
];

/**
 * Curated list of keywords typically found in spam or abuse links.
 */
const SPAM_KEYWORDS = [
  "crypto",
  "giveaway",
  "free-money",
  "viagra",
  "casino",
  "xxx",
  "porn",
];

/**
 * List of known URL shortener domains to prevent chaining / redirection loops.
 */
const KNOWN_SHORTENERS = [
  "bit.ly",
  "tinyurl.com",
  "goo.gl",
  "t.co",
  "is.gd",
  "buff.ly",
  "ow.ly",
];

/**
 * High-risk / suspicious Top-Level Domains (TLDs) frequently utilized in
 * automated phishing campaigns and malware delivery.
 */
const SUSPICIOUS_TLDS = new Set([
  "zip",
  "mov",
  "top",
  "tk",
  "ml",
  "ga",
  "cf",
  "gq",
  "work",
  "click",
  "buzz",
  "surf",
  "country",
  "stream",
  "science",
  "gdn",
  "mom",
  "rodeo",
  "kim",
]);

/**
 * Typo-squatting character substitutions and spoofed brand names.
 */
const TYPOSQUAT_PATTERNS = [
  /paypa1/i,
  /g0{1,2}gle/i,
  /micr0s0ft/i,
  /app1e/i,
  /netf1ix/i,
  /arnazon/i,
  /faceb0{1,2}k/i,
  /instagrarn/i,
  /disc0rd/i,
  /stearncommunity/i,
  /wellsfarg0/i,
  /b1nance/i,
  /c0inbase/i,
];

/**
 * Legitimate official brand domains that are allowed.
 */
const LEGITIMATE_BRAND_DOMAINS = [
  "google.com",
  "paypal.com",
  "microsoft.com",
  "apple.com",
  "netflix.com",
  "amazon.com",
  "facebook.com",
  "instagram.com",
  "discord.com",
  "steamcommunity.com",
  "wellsfargo.com",
  "binance.com",
  "coinbase.com",
];

/**
 * Keywords in domain or title indicating high-risk credential theft or account spoofing.
 */
const PHISHING_SENSITIVE_KEYWORDS = [
  "login",
  "signin",
  "verify-account",
  "account-update",
  "security-alert",
  "banking-portal",
  "wallet-connect",
  "password-reset",
  "billing-update",
  "claim-reward",
];

/**
 * Fast AI scanner for suspected credential harvesting and phishing lures using Gemini.
 * @param {string} targetUrl 
 * @param {string} title 
 * @returns {Promise<{ isSafe: boolean, reason?: string }>}
 */
export const checkPhishingWithAi = async (targetUrl, title = "") => {
  if (!genAI) {
    return { isSafe: true };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `You are a cybersecurity URL and phishing detection engine.
Analyze this destination URL and page title to determine if it is suspected of being a phishing attempt, credential harvesting lure, brand impersonation, or malicious link.

URL: "${targetUrl}"
Title: "${title}"

Respond with strict JSON adhering to this schema:
{
  "isSafe": boolean,
  "confidence": number, // 0 to 1
  "reason": string // If isSafe is false, explain why concisely (max 1 sentence)
}
Only flag as unsafe if there is clear evidence of phishing, deception, or credential theft. Valid personal blogs, docs, GitHub, and portfolios are safe.`;

    // Timeout guard so AI scan cannot block requests for more than 2.5 seconds
    const aiPromise = model.generateContent(prompt);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI security scan timed out")), 2500)
    );

    const result = await Promise.race([aiPromise, timeoutPromise]);
    const responseText = result.response.text();
    const data = JSON.parse(responseText);

    if (data.isSafe === false && (data.confidence === undefined || data.confidence >= 0.7)) {
      return {
        isSafe: false,
        reason: data.reason || "AI security scanner flagged suspected phishing or credential harvesting.",
      };
    }

    return { isSafe: true };
  } catch (error) {
    // If Gemini times out or is unreachable, degrade gracefully without blocking legitimate links
    return { isSafe: true };
  }
};

/**
 * Analyzes the URL, alias, and title for malicious patterns, suspicious TLDs, typo-squatting, or spam.
 * @param {string} targetUrl - The original URL the user wants to shorten
 * @param {string} [customAlias] - The requested custom alias
 * @param {string} [title] - The title of the link
 * @returns {Promise<object>} { isSafe: boolean, reason?: string }
 */
export const checkSecurity = async (targetUrl, customAlias = "", title = "") => {
  try {
    const parsedUrl = new URL(targetUrl);
    const domain = parsedUrl.hostname.toLowerCase();
    const domainParts = domain.split(".");
    const tld = domainParts[domainParts.length - 1];

    // 1. Check Blacklisted Domains
    if (BLACKLISTED_DOMAINS.some((badDomain) => domain === badDomain || domain.endsWith(`.${badDomain}`))) {
      return { isSafe: false, reason: "This domain is flagged as malicious." };
    }

    // 2. Prevent Shortener Chaining
    if (KNOWN_SHORTENERS.some((shortener) => domain === shortener || domain.endsWith(`.${shortener}`))) {
      return {
        isSafe: false,
        reason: "Shortening an already shortened link is not permitted.",
      };
    }

    // 3. Check for Suspicious / High-Abuse TLDs (.zip, .mov, .top, etc.)
    if (SUSPICIOUS_TLDS.has(tld)) {
      return {
        isSafe: false,
        reason: `Links using the '.${tld}' top-level domain are blocked due to elevated phishing and malware risk.`,
      };
    }

    // 4. Check for Typo-Squatting & Brand Impersonation
    const isLegitBrand = LEGITIMATE_BRAND_DOMAINS.some(
      (legit) => domain === legit || domain.endsWith(`.${legit}`)
    );

    if (!isLegitBrand) {
      // Check for typo-squat substitutions (e.g., paypa1, g00gle)
      for (const pattern of TYPOSQUAT_PATTERNS) {
        if (pattern.test(domain)) {
          return {
            isSafe: false,
            reason: "Domain flagged for suspected typo-squatting or brand impersonation.",
          };
        }
      }

      // Check for domain spoofing combinations (e.g., paypal-verify.com, apple-login.net)
      const brandKeywords = [
        "paypal",
        "google",
        "apple",
        "microsoft",
        "netflix",
        "amazon",
        "facebook",
        "instagram",
        "chase",
        "binance",
        "coinbase",
      ];
      const credentialWords = [
        "login",
        "signin",
        "verify",
        "security",
        "account",
        "auth",
        "billing",
        "update",
        "wallet",
        "portal",
      ];

      for (const brand of brandKeywords) {
        if (domain.includes(brand)) {
          const hasCredentialWord = credentialWords.some((w) => domain.includes(w));
          if (hasCredentialWord) {
            return {
              isSafe: false,
              reason: `Unauthorized domain spoofing detected for brand '${brand}'.`,
            };
          }
        }
      }
    }

    // 5. Check for Spam Keywords in URL, Alias, or Title
    const combinedText = `${targetUrl} ${customAlias} ${title}`.toLowerCase();
    const foundSpamWord = SPAM_KEYWORDS.find((word) =>
      combinedText.includes(word),
    );

    if (foundSpamWord) {
      return { isSafe: false, reason: "Content flagged as spam." };
    }

    // 6. Optional AI Phishing Scan (triggers if URL/title has credential-sensitive keywords)
    const needsAiScan = PHISHING_SENSITIVE_KEYWORDS.some((kw) =>
      combinedText.includes(kw)
    );

    if (needsAiScan && genAI) {
      const aiResult = await checkPhishingWithAi(targetUrl, title);
      if (!aiResult.isSafe) {
        return aiResult;
      }
    }

    // Passed all checks
    return { isSafe: true };
  } catch (error) {
    // If URL parsing fails, it's an invalid URL
    return { isSafe: false, reason: "Invalid URL format." };
  }
};
