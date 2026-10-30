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
  // Internetdan ko'rinadigan manzil: "auto" = Cloudflare tunnel'dan avtomatik
  publicUrl: process.env.PUBLIC_URL || 'auto',
  tunnelMetricsUrl: process.env.TUNNEL_METRICS_URL || 'http://localhost:2000',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    fromNumber: process.env.TWILIO_FROM_NUMBER,
  },
  dialerIntervalMs: Number(process.env.DIALER_INTERVAL_MS || 5000),
};
