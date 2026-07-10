import bcrypt from "bcrypt";
import crypto from "crypto";
import pool from "../config/db.js";
import env from "../config/env.js";
import { generateShortCode } from "../utils/codeGenerator.js";
import { isValidUrl, normaliseUrl } from "../utils/validator.js";
import redisClient from "../config/redis.js";

export const shortenUrl = async (
  rawUrl,
  customAlias = null,
  password = null,
  expiresInDays = null,
  maxClicks = null,
  title = null,
  tags = null,
  deviceId = null,
) => {
  const originalUrl = normaliseUrl(rawUrl);

  if (!isValidUrl(originalUrl)) {
    const err = new Error("Invalid URL. Only HTTP/HTTPS URLs are accepted.");
    err.status = 400;
    throw err;
  }

  if (
    !expiresInDays ||
    isNaN(expiresInDays) ||
    expiresInDays < 1 ||
    expiresInDays > 365
  ) {
    const err = new Error(
      "Expiry in days is required and must be between 1 and 365.",
    );
    err.status = 400;
    throw err;
  }

  // Duplicate check
  if (!customAlias && !password) {
    const query = deviceId 
      ? "SELECT * FROM urls WHERE original_url = $1 AND password_hash IS NULL AND device_id = $2 LIMIT 1"
      : "SELECT * FROM urls WHERE original_url = $1 AND password_hash IS NULL AND device_id IS NULL LIMIT 1";
    const params = deviceId ? [originalUrl, deviceId] : [originalUrl];
    
    const { rows: existingRows } = await pool.query(query, params);

    if (existingRows.length > 0) {
      const existing = existingRows[0];
      // Update expiry
      await pool.query(
        "UPDATE urls SET expires_at = CURRENT_TIMESTAMP + ($1 || ' days')::interval WHERE id = $2",
        [expiresInDays, existing.id],
      );

      return {
        shortUrl: `${env.baseUrl}/${existing.short_code}`,
        shortCode: existing.short_code,
        isExisting: true,
        data: {
          title: existing.title,
          tags: existing.tags,
          originalUrl: existing.original_url,
          createdAt: existing.created_at,
          clicks: existing.clicks,
        },
      };
    }
  }

  let shortCode = customAlias ? customAlias.trim() : null;

  if (shortCode) {
    if (!/^[a-zA-Z0-9-]{3,30}$/.test(shortCode)) {
      const err = new Error(
        "Custom alias must be 3–30 alphanumeric characters or hyphens.",
      );
      err.status = 400;
      throw err;
    }
    const { rows } = await pool.query(
      "SELECT id FROM urls WHERE short_code = $1",
      [shortCode],
    );
    if (rows.length > 0) {
      const err = new Error("That custom alias is already taken. Try another.");
      err.status = 409;
      throw err;
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const candidate = generateShortCode(i);
      const { rows } = await pool.query(
        "SELECT id FROM urls WHERE short_code = $1",
        [candidate],
      );
      if (rows.length === 0) {
        shortCode = candidate;
        break;
      }
    }
    if (!shortCode) {
      const err = new Error(
        "Failed to generate a unique short code. Please try again.",
      );
      err.status = 500;
      throw err;
    }
  }

  let passwordHash = null;
  if (password && password.trim().length > 0) {
    passwordHash = await bcrypt.hash(password.trim(), 10);
  }

  const editToken = crypto.randomBytes(16).toString("hex");

  const { rows: insertRows } = await pool.query(
    `
    INSERT INTO urls (short_code, original_url, password_hash, max_clicks, expires_at, edit_token, title, tags, device_id)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + ($5 || ' days')::interval, $6, $7, $8, $9)
    RETURNING *
  `,
    [
      shortCode,
      originalUrl,
      passwordHash,
      maxClicks || null,
      expiresInDays,
      editToken,
      title,
      tags,
      deviceId,
    ],
  );

  const inserted = insertRows[0];

  // Instantly Cache into Redis Hash
  try {
    await redisClient.hSet(`url:${shortCode}`, {
      original_url: inserted.original_url,
      password_hash: inserted.password_hash || "",
      max_clicks: inserted.max_clicks ? inserted.max_clicks.toString() : "",
      expires_at: inserted.expires_at ? inserted.expires_at.toISOString() : "",
      id: inserted.id.toString(),
    });
    await redisClient.expire(`url:${shortCode}`, 86400); // 24hr TTL
  } catch (err) {
    console.error("Redis cache set failed:", err.message);
  }

  return {
    shortUrl: `${env.baseUrl}/${shortCode}`,
    shortCode,
    isExisting: false,
    editToken,
    data: {
      title: inserted.title,
      tags: inserted.tags,
      originalUrl: inserted.original_url,
      createdAt: inserted.created_at,
      clicks: inserted.clicks,
    },
  };
};

export const resolveUrl = async (shortCode, ip = "", userAgent = "") => {
  let data = null;

  // 1. FAST PATH: Fetch entirely from Redis RAM
  try {
    const cached = await redisClient.hGetAll(`url:${shortCode}`);
    if (cached && cached.original_url) {
      data = cached;
      if (data.password_hash === "") data.password_hash = null;
      if (data.max_clicks === "") data.max_clicks = null;
      else data.max_clicks = parseInt(data.max_clicks, 10);
      if (data.expires_at === "") data.expires_at = null;
      else data.expires_at = new Date(data.expires_at);
    }
  } catch (err) {
    console.error("Redis cache get failed:", err.message);
  }

  // 2. SLOW PATH: Fallback to PostgreSQL
  if (!data) {
    const { rows } = await pool.query(
      "SELECT * FROM urls WHERE short_code = $1",
      [shortCode],
    );
    if (rows.length === 0) {
      const err = new Error("Short URL not found or has expired.");
      err.status = 404;
      throw err;
    }
    data = rows[0];

    // Re-cache for the next person
    try {
      await redisClient.hSet(`url:${shortCode}`, {
        original_url: data.original_url,
        password_hash: data.password_hash || "",
        max_clicks: data.max_clicks ? data.max_clicks.toString() : "",
        expires_at: data.expires_at ? data.expires_at.toISOString() : "",
        id: data.id.toString(),
      });
      await redisClient.expire(`url:${shortCode}`, 86400);
    } catch (err) {
      console.error("Redis cache fallback set failed:", err.message);
    }
  }

  // 3. Expiry Check
  if (data.expires_at && data.expires_at <= new Date()) {
    await pool.query("DELETE FROM urls WHERE short_code = $1", [shortCode]);
    await redisClient.del(`url:${shortCode}`);
    const err = new Error("Short URL not found or has expired.");
    err.status = 404;
    throw err;
  }

  if (data.password_hash) {
    return { requiresPassword: true, originalUrl: null };
  }

  // 4. v2 Analytics Queue (Fire & Forget, zero DB connections on hot-path!)
  try {
    const clickData = JSON.stringify({
      shortCode,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    });
    // Push to the right side of the list (non-blocking)
    redisClient.rPush("analytics_queue", clickData).catch((err) => {
      console.error("Redis rPush failed:", err.message);
    });
  } catch (err) {
    console.error("Failed to queue analytics:", err.message);
  }

  return { requiresPassword: false, originalUrl: data.original_url };
};

export const verifyUrlPassword = async (
  shortCode,
  password,
  ip = "",
  userAgent = "",
) => {
  const { rows } = await pool.query(
    "SELECT * FROM urls WHERE short_code = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
    [shortCode],
  );

  if (rows.length === 0) {
    await pool.query("DELETE FROM urls WHERE short_code = $1", [shortCode]);
    const err = new Error("Short URL not found or has expired.");
    err.status = 404;
    throw err;
  }

  const data = rows[0];

  if (!data.password_hash) {
    return data.original_url;
  }

  const isValid = await bcrypt.compare(password, data.password_hash);
  if (!isValid) {
    const err = new Error("Incorrect password");
    err.status = 401;
    throw err;
  }

  await pool.query(
    "UPDATE urls SET clicks = clicks + 1, last_visited = CURRENT_TIMESTAMP WHERE id = $1",
    [data.id],
  );

  const visitorString = `${ip}-${userAgent}`;
  const visitorHash = crypto
    .createHash("md5")
    .update(visitorString)
    .digest("hex");

  await pool.query(
    `
    INSERT INTO click_history (short_code, visitor_hash, user_agent)
    VALUES ($1, $2, $3)
  `,
    [shortCode, visitorHash, userAgent],
  );

  const { rowCount } = await pool.query(
    `
    INSERT INTO unique_visitors (short_code, visitor_hash) 
    VALUES ($1, $2) ON CONFLICT (short_code, visitor_hash) DO NOTHING
  `,
    [shortCode, visitorHash],
  );

  if (data.max_clicks) {
    if (rowCount > 0) {
      const { rows: countRows } = await pool.query(
        "SELECT COUNT(*) as count FROM unique_visitors WHERE short_code = $1",
        [shortCode],
      );
      const uniqueCount = parseInt(countRows[0].count, 10);

      if (uniqueCount >= data.max_clicks) {
        await pool.query("DELETE FROM urls WHERE id = $1", [data.id]);
      }
    }
  }

  return data.original_url;
};

export const getUrlInfo = async (shortCode) => {
  const { rows } = await pool.query(
    "SELECT * FROM urls WHERE short_code = $1 AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
    [shortCode],
  );

  if (rows.length === 0) {
    const err = new Error("Short URL not found or has expired.");
    err.status = 404;
    throw err;
  }

  const data = rows[0];

  const { rows: uniqueRows } = await pool.query(
    "SELECT COUNT(*) as count FROM unique_visitors WHERE short_code = $1",
    [shortCode],
  );
  const uniqueVisitors = parseInt(uniqueRows[0].count, 10) || 0;

  const durationHours =
    (new Date().getTime() - new Date(data.created_at).getTime()) /
    (1000 * 60 * 60);
  const bucketInterval = durationHours <= 48 ? "hour" : "day";

  const { rows: historyRows } = await pool.query(
    `
    SELECT 
      DATE_TRUNC('${bucketInterval}', clicked_at) as bucket,
      COUNT(*)::int as total_clicks,
      COUNT(DISTINCT visitor_hash)::int as unique_clicks
    FROM click_history 
    WHERE short_code = $1 
    GROUP BY bucket
    ORDER BY bucket ASC
  `,
    [shortCode],
  );

  return {
    shortCode,
    shortUrl: `${env.baseUrl}/${shortCode}`,
    originalUrl: data.original_url,
    clicks: data.clicks,
    uniqueVisitors,
    history: historyRows,
    bucketInterval,
    createdAt: data.created_at,
    lastVisited: data.last_visited,
    isProtected: !!data.password_hash,
  };
};

export const editUrlDestination = async (shortCode, newUrl, editToken) => {
  const originalUrl = normaliseUrl(newUrl);

  if (!isValidUrl(originalUrl)) {
    const err = new Error("Invalid new URL provided.");
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    "SELECT * FROM urls WHERE short_code = $1",
    [shortCode],
  );

  if (rows.length === 0) {
    const err = new Error("Short URL not found.");
    err.status = 404;
    throw err;
  }

  const data = rows[0];

  if (data.edit_token !== editToken) {
    const err = new Error("Unauthorized: Invalid edit token.");
    err.status = 401;
    throw err;
  }

  await pool.query("UPDATE urls SET original_url = $1 WHERE id = $2", [
    originalUrl,
    data.id,
  ]);

  // Invalidate Redis Cache
  try {
    await redisClient.del(`url:${shortCode}`);
  } catch (err) {
    console.error("Redis cache invalidation failed:", err.message);
  }

  return { success: true, newUrl: originalUrl };
};

export const deleteUrl = async (shortCode, editToken) => {
  const { rows } = await pool.query(
    "SELECT * FROM urls WHERE short_code = $1",
    [shortCode],
  );

  if (rows.length === 0) {
    const err = new Error("Short URL not found.");
    err.status = 404;
    throw err;
  }

  const data = rows[0];

  if (data.edit_token !== editToken) {
    const err = new Error("Unauthorized: Invalid edit token.");
    err.status = 401;
    throw err;
  }

  await pool.query("DELETE FROM urls WHERE id = $1", [data.id]);

  // Invalidate Redis Cache
  try {
    await redisClient.del(`url:${shortCode}`);
  } catch (err) {
    console.error("Redis cache invalidation failed:", err.message);
  }

  return { success: true };
};

/**
 * Check whether a custom alias (short code) is available.
 * Returns { available: true } or { available: false }.
 */
export const checkAliasAvailability = async (alias) => {
  if (!/^[a-zA-Z0-9-]{3,30}$/.test(alias)) {
    const err = new Error(
      "Alias must be 3–30 alphanumeric characters or hyphens.",
    );
    err.status = 400;
    throw err;
  }
  const { rows } = await pool.query(
    "SELECT id FROM urls WHERE short_code = $1",
    [alias],
  );
  return { available: rows.length === 0 };
};
