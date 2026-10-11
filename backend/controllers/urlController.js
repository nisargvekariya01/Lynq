import env from "../config/env.js";
import pool from "../config/db.js";
import eventBus from "../config/eventBus.js";
import {
  shortenUrl,
  resolveUrl,
  getUrlInfo,
  verifyUrlPassword,
  editUrlDestination,
  deleteUrl,
  checkAliasAvailability,
} from "../services/urlService.js";
import { checkSecurity } from "../services/securityService.js";

/**
 * POST /api/shorten
 * Body: { url: string, customAlias?: string, password?: string, expiresInDays?: number }
 */
export const handleShorten = async (req, res, next) => {
  try {
    const {
      url,
      customAlias,
      password,
      expiresInDays,
      maxClicks,
      title,
      tags,
      deviceId,
      routingRules,
    } = req.body;

    if (!url) {
      return res
        .status(400)
        .json({ success: false, error: "URL is required." });
    }

    // Security Check
    const securityCheck = await checkSecurity(url, customAlias, title);
    if (!securityCheck.isSafe) {
      return res
        .status(403)
        .json({ success: false, error: securityCheck.reason });
    }

    const result = await shortenUrl(
      url,
      customAlias || null,
      password || null,
      expiresInDays || null,
      maxClicks || null,
      title || null,
      tags || null,
      deviceId || null,
      req.userId || null,
      routingRules || null,
    );

    return res.status(result.isExisting ? 200 : 201).json({
      success: true,
      isExisting: result.isExisting,
      shortUrl: result.shortUrl,
      shortCode: result.shortCode,
      editToken: result.editToken,
      title: result.data.title,
      tags: result.data.tags,
      originalUrl: result.data.originalUrl,
      createdAt: result.data.createdAt,
      clicks: parseInt(result.data.clicks, 10) || 0,
      routingRules: result.routingRules || result.data.routing_rules || {},
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/shorten/:shortCode
 * Body: { newUrl: string, editToken: string, routingRules?: object }
 */
export const handleEditUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const { newUrl, editToken, routingRules } = req.body;

    if (!newUrl || !editToken) {
      return res
        .status(400)
        .json({ success: false, error: "newUrl and editToken are required." });
    }

    const result = await editUrlDestination(
      shortCode,
      newUrl,
      editToken,
      routingRules || null,
    );
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/shorten/:shortCode
 * Body: { editToken: string }
 */
export const handleDeleteUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const { editToken } = req.body;

    if (!editToken) {
      return res
        .status(400)
        .json({ success: false, error: "editToken is required." });
    }

    const result = await deleteUrl(shortCode, editToken);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /:shortCode
 * Redirects to original URL or to unlock page if password protected.
 */
export const handleRedirect = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const ip = req.ip || req.connection?.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";
    const referrer = req.headers["referer"] || req.headers["referrer"] || "";
    const result = await resolveUrl(shortCode, ip, userAgent, referrer);

    if (result.requiresPassword) {
      // Redirect to frontend unlock route
      return res.redirect(302, `${env.frontendUrl}/unlock/${shortCode}`);
    }

    return res.redirect(302, result.originalUrl);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/resolve/:shortCode
 * Same logic as handleRedirect but returns JSON to avoid browser hard-redirects
 */
export const handleResolveAndTrack = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const ip = req.ip || req.connection?.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";
    const referrer =
      req.headers["referer"] ||
      req.headers["referrer"] ||
      req.query.referrer ||
      "";
    const result = await resolveUrl(shortCode, ip, userAgent, referrer);

    return res.status(200).json({ success: true, result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/verify/:shortCode
 * Verifies password and returns original URL.
 */
export const handleVerifyPassword = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const { password } = req.body;

    if (!password) {
      return res
        .status(400)
        .json({ success: false, error: "Password is required." });
    }

    const ip = req.ip || req.connection?.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";
    const originalUrl = await verifyUrlPassword(
      shortCode,
      password,
      ip,
      userAgent,
    );
    return res.status(200).json({ success: true, originalUrl });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/info/:shortCode
 * Returns analytics data for a short URL.
 */
export const handleGetInfo = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const info = await getUrlInfo(shortCode);
    return res.status(200).json({ success: true, ...info });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/check-alias/:alias
 * Returns { available: true } or { available: false }
 */
export const handleCheckAlias = async (req, res, next) => {
  try {
    const { alias } = req.params;
    const result = await checkAliasAvailability(alias);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/live/:shortCode
 * Server-Sent Events (SSE) endpoint streaming real-time clicks for a shortCode.
 */
export const handleLiveStream = (req, res) => {
  const { shortCode } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Initial connection handshake
  res.write(
    `data: ${JSON.stringify({ type: "connected", shortCode, ts: Date.now() })}\n\n`,
  );

  const clickListener = (event) => {
    res.write(`data: ${JSON.stringify({ type: "click", ...event })}\n\n`);
  };

  eventBus.on(`click:${shortCode}`, clickListener);

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    eventBus.off(`click:${shortCode}`, clickListener);
  });
};

/**
 * GET /api/analytics/:shortCode/export
 * Exports historical click telemetry for a short URL as a downloadable CSV.
 */
export const handleExportCsv = async (req, res, next) => {
  try {
    const { shortCode } = req.params;

    const { rows: urlRows } = await pool.query(
      "SELECT id, original_url, title FROM urls WHERE short_code = $1",
      [shortCode],
    );

    if (urlRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Short code not found." });
    }

    const { rows: clickRows } = await pool.query(
      `SELECT clicked_at, country, city, device_type, browser, os, referrer 
       FROM click_history 
       WHERE short_code = $1 
       ORDER BY clicked_at DESC`,
      [shortCode],
    );

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      "Timestamp",
      "Country",
      "City",
      "Device",
      "Browser",
      "OS",
      "Referrer",
    ];
    const csvLines = [headers.join(",")];

    for (const row of clickRows) {
      csvLines.push(
        [
          escapeCsv(row.clicked_at ? new Date(row.clicked_at).toISOString() : ""),
          escapeCsv(row.country || "Unknown"),
          escapeCsv(row.city || "Unknown"),
          escapeCsv(row.device_type || "desktop"),
          escapeCsv(row.browser || "Unknown"),
          escapeCsv(row.os || "Unknown"),
          escapeCsv(row.referrer || "direct"),
        ].join(","),
      );
    }

    const csvContent = csvLines.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="lynq-${shortCode}-analytics.csv"`,
    );
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};

