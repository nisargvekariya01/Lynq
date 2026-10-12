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
    keepAlive: 5000, // Enable TCP keep-alive probes
    noDelay: true,
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      // Exponential backoff capped at 3000ms; keeps reconnecting on transient cloud drops
      return Math.min(retries * 150, 3000);
    },
  },
});

client.on("connect", () => console.log("✅ Redis: Connecting..."));
client.on("ready", () => {
  console.log("✅ Redis: Connected and ready");
  if (!client._heartbeatTimer) {
    client._heartbeatTimer = setInterval(async () => {
      try {
        if (client.isReady) {
          await client.ping();
        }
      } catch {
        // Handled by auto-reconnect
      }
    }, 10000);
  }
});
client.on("error", (err) => {
  if (err.code === "ECONNRESET" || err.message?.includes("ECONNRESET")) {
    return; // Reconnecting automatically, silence noisy log
  }
  console.error("❌ Redis Error:", err.message);
});
client.on("reconnecting", () => console.log("🔄 Redis: Reconnecting..."));
client.on("end", () => {
  if (client._heartbeatTimer) {
    clearInterval(client._heartbeatTimer);
    client._heartbeatTimer = null;
  }
  console.log("🔌 Redis: Connection closed");
});

/**
 * Connect to Redis — call once at server startup.
 */
export const connectRedis = async () => {
  if (!client.isOpen) {
    await client.connect();
  }
};

export default client;
