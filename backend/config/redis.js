import { createClient } from "redis";
import env from "./env.js";

/**
 * Singleton Redis client using Redis Cloud credentials from .env
 */
const client = createClient({
  username: env.redis.username,
  password: env.redis.password,
  pingInterval: 5000, // Keep connection alive on Redis Cloud, prevents ECONNRESET
  socket: {
    host: env.redis.host,
    port: env.redis.port,
    tls: false,
    keepAlive: 10000, // Enable TCP keep-alive probes
    noDelay: true,
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      // Exponential backoff: 1s, 1.5s, 2.25s, ... capped at 10s with randomized jitter
      const delay = Math.min(1000 * Math.pow(1.5, Math.min(retries, 6)), 10000);
      const jitter = Math.floor(Math.random() * 400);
      return delay + jitter;
    },
  },
});

let lastErrorLogTime = 0;
let lastReconnectLogTime = 0;
let isOfflineLogged = false;

client.on("connect", () => {
  console.log("✅ Redis: Connecting...");
});

client.on("ready", () => {
  console.log("✅ Redis: Connected and ready");
  isOfflineLogged = false;
});

client.on("error", (err) => {
  // Silence expected network reset during cloud auto-reconnect
  if (err.code === "ECONNRESET" || err.message?.includes("ECONNRESET")) {
    return;
  }
  const now = Date.now();
  // Throttle error logging to once every 20s to prevent spamming
  if (now - lastErrorLogTime > 20000 || !isOfflineLogged) {
    lastErrorLogTime = now;
    isOfflineLogged = true;
    console.warn(`⚠️ Redis notice (${err.code || "Error"}): ${err.message}. Operating in database-fallback mode.`);
  }
});

client.on("reconnecting", () => {
  const now = Date.now();
  // Throttle reconnect notices to once every 20s
  if (now - lastReconnectLogTime > 20000) {
    lastReconnectLogTime = now;
    console.log("🔄 Redis: Attempting reconnection...");
  }
});

client.on("end", () => {
  console.log("🔌 Redis: Connection closed");
});

/**
 * Connect to Redis — call once at server startup.
 * Non-blocking: will not crash server if Redis is temporarily unreachable.
 */
export const connectRedis = async () => {
  if (!client.isOpen) {
    try {
      await client.connect();
    } catch (err) {
      console.warn("⚠️ Initial Redis connection delayed, auto-reconnect active:", err.message);
    }
  }
};

export default client;
