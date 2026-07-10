import { createClient } from "redis";
import env from "./env.js";

/**
 * Singleton Redis client using Redis Cloud credentials from .env
 */
const client = createClient({
  username: env.redis.username,
  password: env.redis.password,
  socket: {
    host: env.redis.host,
    port: env.redis.port,
    tls: false,
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.error("❌ Redis: Too many reconnect attempts, giving up.");
        return new Error("Redis reconnect limit reached");
      }
      return Math.min(retries * 200, 2000); // exponential backoff
    },
  },
});

client.on("connect", () => console.log("✅ Redis: Connecting..."));
client.on("ready", () => console.log("✅ Redis: Connected and ready"));
client.on("error", (err) => console.error("❌ Redis Error:", err.message));
client.on("reconnecting", () => console.log("🔄 Redis: Reconnecting..."));
client.on("end", () => console.log("🔌 Redis: Connection closed"));

/**
 * Connect to Redis — call once at server startup.
 */
export const connectRedis = async () => {
  if (!client.isOpen) {
    await client.connect();
  }
};

export default client;
