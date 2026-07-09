import env from '../config/env.js';
import { shortenUrl, resolveUrl, getUrlInfo, verifyUrlPassword, editUrlDestination, deleteUrl, checkAliasAvailability } from '../services/urlService.js';
import { checkSecurity } from '../services/securityService.js';

/**
 * POST /api/shorten
 * Body: { url: string, customAlias?: string, password?: string, expiresInDays?: number }
 */
export const handleShorten = async (req, res, next) => {
  try {
    const { url, customAlias, password, expiresInDays, maxClicks, title, tags } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required.' });
    }

    // Security Check
    const securityCheck = checkSecurity(url, customAlias, title);
    if (!securityCheck.isSafe) {
      return res.status(403).json({ success: false, error: securityCheck.reason });
    }

    const result = await shortenUrl(url, customAlias || null, password || null, expiresInDays || null, maxClicks || null, title || null, tags || null);

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
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/shorten/:shortCode
 * Body: { newUrl: string, editToken: string }
 */
export const handleEditUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const { newUrl, editToken } = req.body;

    if (!newUrl || !editToken) {
      return res.status(400).json({ success: false, error: 'newUrl and editToken are required.' });
    }

    const result = await editUrlDestination(shortCode, newUrl, editToken);
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
      return res.status(400).json({ success: false, error: 'editToken is required.' });
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
    const ip = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const result = await resolveUrl(shortCode, ip, userAgent);

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
 * POST /api/verify/:shortCode
 * Verifies password and returns original URL.
 */
export const handleVerifyPassword = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required.' });
    }

    const ip = req.ip || req.connection?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const originalUrl = await verifyUrlPassword(shortCode, password, ip, userAgent);
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

