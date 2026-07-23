import pool from "../config/db.js";
import env from "../config/env.js";
import { generateShortCode } from "../utils/codeGenerator.js";
import { isValidUrl, normaliseUrl } from "../utils/validator.js";
import crypto from "crypto"; // For generating edit tokens

/**
 * Bulk-shortens an array of URL rows from a CSV upload.
 * Each row: { url, title?, customAlias? }
 * Returns an array of results with success/error per row.
 */
export const bulkShortenUrls = async (rows, deviceId = null) => {
  const results = [];

  for (const row of rows) {
    const rawUrl = (row.url || row.URL || row.link || row.Link || "").trim();
    const title = (row.title || row.Title || "").trim() || null;
    const customAlias =
      (row.alias || row.custom_alias || row.customAlias || "").trim() || null;

    if (!rawUrl) {
      results.push({
        originalUrl: "",
        shortUrl: "",
        error: "Empty URL, skipped.",
      });
      continue;
    }

    if (!title) {
      results.push({
        originalUrl: rawUrl,
        shortUrl: "",
        error: "Title is required.",
      });
      continue;
    }

    try {
      const originalUrl = normaliseUrl(rawUrl);
      if (!isValidUrl(originalUrl)) {
        results.push({
          originalUrl: rawUrl,
          shortUrl: "",
          error: "Invalid URL format.",
        });
        continue;
      }

      // Validate custom alias if provided
      let shortCode = null;
      if (customAlias) {
        if (!/^[a-zA-Z0-9-]{3,30}$/.test(customAlias)) {
          results.push({
            originalUrl: rawUrl,
            shortUrl: "",
            error: "Invalid alias: use 3–30 alphanumeric chars or hyphens.",
          });
          continue;
        }
        const { rows: existing } = await pool.query(
          "SELECT id FROM urls WHERE short_code = $1",
          [customAlias],
        );
        if (existing.length > 0) {
          results.push({
            originalUrl: rawUrl,
            shortUrl: "",
            error: `Alias "${customAlias}" is already taken.`,
          });
          continue;
        }
        shortCode = customAlias;
      } else {
        // Check for existing duplicate (no alias, no password)
        const query = deviceId
          ? "SELECT short_code FROM urls WHERE original_url = $1 AND password_hash IS NULL AND device_id = $2 LIMIT 1"
          : "SELECT short_code FROM urls WHERE original_url = $1 AND password_hash IS NULL AND device_id IS NULL LIMIT 1";
        const params = deviceId ? [originalUrl, deviceId] : [originalUrl];

        const { rows: dupRows } = await pool.query(query, params);
        if (dupRows.length > 0) {
          shortCode = dupRows[0].short_code;
          results.push({
            originalUrl,
            title: title || originalUrl,
            shortUrl: `${env.frontendUrl}/${shortCode}`,
            shortCode,
            isExisting: true,
            error: null,
          });
          continue;
        }

        // Generate unique short code
        for (let i = 0; i < 5; i++) {
          const candidate = generateShortCode(i);
          const { rows: check } = await pool.query(
            "SELECT id FROM urls WHERE short_code = $1",
            [candidate],
          );
          if (check.length === 0) {
            shortCode = candidate;
            break;
          }
        }

        if (!shortCode) {
          results.push({
            originalUrl: rawUrl,
            shortUrl: "",
            error: "Could not generate unique code.",
          });
          continue;
        }
      }

      const editToken = crypto.randomBytes(16).toString("hex");
      const expiresInDays = 30; // default expiry for bulk links

      await pool.query(
        `
        INSERT INTO urls (short_code, original_url, password_hash, max_clicks, expires_at, edit_token, title, tags, device_id)
        VALUES ($1, $2, NULL, NULL, CURRENT_TIMESTAMP + ($3 || ' days')::interval, $4, $5, NULL, $6)
      `,
        [shortCode, originalUrl, expiresInDays, editToken, title, deviceId],
      );

      results.push({
        originalUrl,
        title: title || originalUrl,
        shortUrl: `${env.frontendUrl}/${shortCode}`,
        shortCode,
        editToken,
        isExisting: false,
        error: null,
      });
    } catch (err) {
      results.push({
        originalUrl: rawUrl,
        shortUrl: "",
        error: err.message || "Unknown error.",
      });
    }
  }

  return results;
};
