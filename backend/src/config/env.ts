import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dataSource: (process.env.DATA_SOURCE || 'mock') as 'mock' | 'live',
  broker: (process.env.BROKER || 'mock') as 'mock' | 'zerodha' | 'angel',

  // ──── Storage Backend ────
  // 'memory'   → InMemoryStorage (default, no deps)
  // 'postgres' → PostgreSQLStorage (requires DATABASE_URL)
  // 'mongodb'  → MongoDBStorage (requires MONGODB_URI + MONGODB_DB_NAME)
  storageBackend: (process.env.STORAGE_BACKEND || 'memory') as 'memory' | 'postgres' | 'mongodb',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/toroloom',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  mongodbDbName: process.env.MONGODB_DB_NAME || 'toroloom',

  // ──── Zerodha Kite Connect ────
  // To get credentials: https://kite.trade/connect/login
  zerodha: {
    apiKey: process.env.ZERODHA_API_KEY || '',
    apiSecret: process.env.ZERODHA_API_SECRET || '',
    accessToken: process.env.ZERODHA_ACCESS_TOKEN || '',
    // If you don't have an access_token, provide the request_token
    // from the redirect URL after Kite login:
    requestToken: process.env.ZERODHA_REQUEST_TOKEN || '',
  },

  // ──── Angel One SmartAPI ────
  // To get credentials: https://smartapi.angelbroking.com/
  angel: {
    clientId: process.env.ANGEL_CLIENT_ID || '',
    apiKey: process.env.ANGEL_API_KEY || '',
    accessToken: process.env.ANGEL_ACCESS_TOKEN || '',
    // Required for generateSession (if accessToken not provided):
    password: process.env.ANGEL_PASSWORD || '',
    totp: process.env.ANGEL_TOTP || '',
  },

  get isDev() {
    return this.nodeEnv === 'development';
  },
  get isMock() {
    return this.dataSource === 'mock';
  },
};
