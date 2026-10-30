import mysql from 'mysql2/promise';
import { config } from './config.js';

export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: 'Z', // bazada hammasi UTC; brauzer mahalliy vaqtga o'giradi
});

// Har bir ulanishda sessiya vaqt zonasini UTC qilamiz, server TZ qanday bo'lishidan qat'i nazar
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/** MySQL JSON ustunlari ba'zan string bo'lib keladi — bir xil ko'rinishga keltiramiz. */
export function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}
