/**
 * Tizimning internetdan ko'rinadigan manzili (Twilio shu manzilga ulanadi).
 *
 * PUBLIC_URL=https://sizning-domen.uz  — o'z domeningiz bo'lsa
 * PUBLIC_URL=auto (standart)            — Cloudflare tunnel manzili avtomatik o'qiladi.
 *   Tunnel manzili har ishga tushganda o'zgaradi, shuning uchun uni har safar
 *   cloudflared metrikasidan olamiz.
 */
import { config } from './config.js';

let cached = null;
let cachedAt = 0;

export async function publicUrl() {
  const fixed = (config.publicUrl || '').trim();
  if (fixed && fixed !== 'auto') return fixed.replace(/\/$/, '');
  if (cached && Date.now() - cachedAt < 60_000) return cached;
  try {
    const res = await fetch(`${config.tunnelMetricsUrl}/metrics`, { signal: AbortSignal.timeout(3000) });
    const text = await res.text();
    const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m) {
      cached = m[0];
      cachedAt = Date.now();
      return cached;
    }
  } catch {
    /* tunnel hali ishga tushmagan */
  }
  return null;
}

export const toWs = (url) => url.replace(/^http/, 'ws');
