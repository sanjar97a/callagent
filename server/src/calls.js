import { Router } from 'express';
import { one, parseJson, query } from './db.js';

export function serializeCall(c) {
  return {
    ...c,
    transcript: parseJson(c.transcript, []),
    result: parseJson(c.result, {}),
  };
}

export const callsRouter = Router();

callsRouter.get('/', async (req, res) => {
  const where = [];
  const params = [];
  for (const key of ['agent_id', 'campaign_id', 'direction', 'status']) {
    if (req.query[key]) {
      where.push(`c.${key} = ?`);
      params.push(req.query[key]);
    }
  }
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await query(
    `SELECT c.id, c.agent_id, a.name AS agent_name, c.campaign_id, c.direction, c.channel,
            c.from_number, c.to_number, c.status, c.ended_by, c.duration_sec, c.result,
            c.started_at, c.ended_at
     FROM calls c JOIN agents a ON a.id = c.agent_id
     ${sqlWhere} ORDER BY c.started_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM calls c ${sqlWhere}`, params);
  res.json({ items: rows.map((r) => ({ ...r, result: parseJson(r.result, {}) })), total: Number(total) });
});

callsRouter.get('/:id', async (req, res) => {
  const c = await one(
    `SELECT c.*, a.name AS agent_name FROM calls c JOIN agents a ON a.id = c.agent_id WHERE c.id = ?`,
    [req.params.id],
  );
  if (!c) return res.status(404).json({ error: 'Qo‘ng‘iroq topilmadi' });
  res.json(serializeCall(c));
});

export const statsRouter = Router();

statsRouter.get('/', async (_req, res) => {
  const [s] = await query(`
    SELECT
      (SELECT COUNT(*) FROM agents) AS agents,
      (SELECT COUNT(*) FROM agents WHERE is_active = 1) AS active_agents,
      (SELECT COUNT(*) FROM calls) AS calls,
      (SELECT COUNT(*) FROM calls WHERE started_at >= CURDATE()) AS calls_today,
      (SELECT COALESCE(ROUND(AVG(duration_sec)), 0) FROM calls WHERE status = 'completed') AS avg_duration`);
  res.json(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v)])));
});
