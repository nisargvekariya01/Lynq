import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import crypto from "crypto";
import client from "../config/redis.js";

/**
 * Helper to generate a unique device hash using IP (IPv6-safe) and User-Agent.
 * Uses express-rate-limit's ipKeyGenerator to normalize IPv6 addresses.
 */
const generateDeviceKey = (req) => {
  const ip = ipKeyGenerator(req.ip); // IPv6-safe helper from express-rate-limit
  const userAgent = req.headers["user-agent"] || "";
  return crypto.createHash("md5").update(`${ip}-${userAgent}`).digest("hex");
};

/**
 * Build a RedisStore only when the Redis client is ready.
 * Calling this before connectRedis() causes a ClientClosedError,
 * so we use a factory exported and called AFTER Redis connects.
 */
const makeRedisStore = (prefix) =>
  new RedisStore({
    sendCommand: (...args) => client.sendCommand(args),
    prefix: prefix,
  });

/**
 * Factory — called once from server.js AFTER connectRedis() resolves.
 * Returns { apiLimiter, shortenLimiter } ready to register as middleware.
 */
export const createLimiters = () => {
  const isLoadTest = process.env.LOAD_TEST_MODE === "true";

  /**
   * General API rate limiter: 60 requests per minute per device.
   * Set LOAD_TEST_MODE=true in .env to disable during k6 load tests.
   */
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isLoadTest ? 100_000 : 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req, res) => process.env.LOAD_TEST_MODE === "true",
    keyGenerator: generateDeviceKey,
    store: makeRedisStore("rl_api:"),
    message: {
      success: false,
      error: "Too many requests. Please slow down and try again in a minute.",
    },
  });

  /**
   * Strict limiter for the shorten endpoint: 10 per minute per device.
   * Set LOAD_TEST_MODE=true in .env to disable during k6 load tests.
   */
  const shortenLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isLoadTest ? 100_000 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateDeviceKey,
    store: makeRedisStore("rl_shorten:"),
    message: {
      success: false,
      error:
        "Too many shorten requests. Please wait a minute before trying again.",
    },
  });

  /**
   * Bulk CSV upload limiter: 1 request per hour per device.
   * Set LOAD_TEST_MODE=true in .env to disable during k6 load tests.
   */
  const bulkLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: isLoadTest ? 100_000 : 1,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateDeviceKey,
    store: makeRedisStore("rl_bulk:"),
    message: {
      success: false,
      error: "Bulk upload limit reached. You can upload a CSV once per hour.",
    },
  });

  return { apiLimiter, shortenLimiter, bulkLimiter };
};
