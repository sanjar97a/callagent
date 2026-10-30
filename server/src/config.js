import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'callagent',
  },
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  internalToken: process.env.INTERNAL_TOKEN || 'change-me',
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  // Brauzer ulanadigan agent ishchisi manzili, masalan wss://agent.example.uz
  agentPublicWsUrl: process.env.AGENT_PUBLIC_WS_URL || 'ws://localhost:8000',
  // Backendning ommaviy manzili (Twilio status webhook uchun)
  publicApiUrl: process.env.PUBLIC_API_URL || 'http://localhost:4000',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  },
  dialerIntervalMs: Number(process.env.DIALER_INTERVAL_MS || 5000),
};
