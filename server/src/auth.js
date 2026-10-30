import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from './config.js';
import { one, query } from './db.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Kirish talab qilinadi' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Sessiya tugagan, qayta kiring' });
  }
}

export function requireInternal(req, res, next) {
  const token = req.headers['x-internal-token'] || '';
  const a = Buffer.from(String(token));
  const b = Buffer.from(config.internalToken);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'internal token noto‘g‘ri' });
  }
  next();
}

export async function login(email, password) {
  const user = await one('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return null;
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, config.jwtSecret, {
    expiresIn: '7d',
  });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

/** Birinchi ishga tushishda .env dagi ADMIN_EMAIL/ADMIN_PASSWORD bilan admin yaratadi. */
export async function ensureAdmin() {
  const [{ n }] = await query('SELECT COUNT(*) AS n FROM users');
  if (n > 0 || !config.adminEmail || !config.adminPassword) return;
  const hash = await bcrypt.hash(config.adminPassword, 10);
  await query('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)', [
    config.adminEmail,
    'Admin',
    hash,
  ]);
  console.log(`Admin yaratildi: ${config.adminEmail}`);
}

/** Brauzer test ulanishi uchun qisqa muddatli ticket (agent ishchisi tekshiradi). */
export function makeTicket(agentId, ttlSec = 120) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = crypto
    .createHmac('sha256', config.internalToken)
    .update(`${agentId}.${exp}`)
    .digest('hex');
  return `${exp}.${sig}`;
}
