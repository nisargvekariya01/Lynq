import 'dotenv/config';

/**
 * Centralised environment config with sensible defaults.
 * Always import this instead of reading process.env directly.
 */
const env = {
  port: parseInt(process.env.PORT, 10) || 5000,
  baseUrl: process.env.BASE_URL || 'http://localhost:5000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    username: process.env.REDIS_USERNAME || 'default',
    password: process.env.REDIS_PASSWORD || '',
  },
  shortCodeLength: parseInt(process.env.SHORT_CODE_LENGTH, 10) || 6,
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};

export default env;
