import axios from "axios";

const getDeviceId = () => {
  let deviceId = localStorage.getItem("lynq_device_id");
  if (!deviceId) {
    deviceId = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15);
    localStorage.setItem("lynq_device_id", deviceId);
  }
  return deviceId;
};

/**
 * Axios instance — routes through Vite proxy (/api → localhost:5000)
 * in development, and directly to BASE_URL in production.
 */
const api = axios.create({
  // Use production URL if defined in Vercel env vars, otherwise default to Vite local proxy
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

/**
 * Shorten a URL.
 * @param {string} url
 * @param {string|null} customAlias
 * @returns {Promise<object>}
 */
export const shortenUrl = async (
  url,
  customAlias = null,
  password = null,
  expiresInDays = null,
  maxClicks = null,
  title = null,
  tags = null,
) => {
  const deviceId = getDeviceId();
  const { data } = await api.post("/shorten", {
    url,
    customAlias,
    password,
    expiresInDays,
    maxClicks,
    title,
    tags,
    deviceId,
  });
  return data;
};

/**
 * Check if a custom alias is available.
 * @param {string} alias
 * @returns {Promise<{ available: boolean }>}
 */
export const checkAlias = async (alias) => {
  const { data } = await api.get(`/check-alias/${encodeURIComponent(alias)}`);
  return data; // { success, available }
};

/**
 * Fetch analytics info for a short code.
 * @param {string} shortCode
 * @returns {Promise<object>}
 */
export const getUrlInfo = async (shortCode) => {
  const { data } = await api.get(`/info/${shortCode}`);
  return data;
};

/**
 * Verify password for a protected short URL.
 * @param {string} shortCode
 * @param {string} password
 * @returns {Promise<object>}
 */
export const verifyPassword = async (shortCode, password) => {
  const { data } = await api.post(`/verify/${shortCode}`, { password });
  return data;
};

/**
 * Edit destination URL of a shortened link.
 * @param {string} shortCode
 * @param {string} newUrl
 * @param {string} editToken
 * @returns {Promise<object>}
 */
export const editUrl = async (shortCode, newUrl, editToken) => {
  const { data } = await api.put(`/shorten/${shortCode}`, {
    newUrl,
    editToken,
  });
  return data;
};

/**
 * Delete a shortened link.
 * @param {string} shortCode
 * @param {string} editToken
 * @returns {Promise<object>}
 */
export const deleteUrl = async (shortCode, editToken) => {
  const { data } = await api.delete(`/shorten/${shortCode}`, {
    data: { editToken },
  });
  return data;
};

/**
 * Get AI suggestions for a URL.
 * @param {string} url
 * @returns {Promise<object>}
 */
export const suggestAi = async (url) => {
  const { data } = await api.post("/ai/suggest", { url });
  return data.data; // { title, tags, customAlias }
};

/**
 * Check live status of a short URL's destination.
 * @param {string} shortCode
 * @returns {Promise<object>}
 */
export const checkStatus = async (shortCode) => {
  const { data } = await api.get(`/status/${shortCode}`);
  return data;
};

/**
 * Bulk shorten a list of URL rows.
 * @param {Array<{url, title?, alias?}>} rows
 * @returns {Promise<object>}
 */
export const bulkShortenUrls = async (rows) => {
  const deviceId = getDeviceId();
  const { data } = await api.post("/bulk-shorten", { rows, deviceId });
  return data; // { success, results }
};

/**
 * Check backend health status (Redis & Postgres connection).
 * @returns {Promise<object>}
 */
export const checkHealth = async () => {
  const { data } = await api.get("/health");
  return data; // { status, db, redis, ts }
};

/**
 * Resolve a short URL, trigger analytics, and get the destination (client-side redirect fallback).
 * @param {string} shortCode 
 * @returns {Promise<object>}
 */
export const resolveAndTrack = async (shortCode) => {
  const { data } = await api.get(`/resolve/${shortCode}`);
  return data; // { success, result: { requiresPassword, originalUrl } }
};

export default api;
