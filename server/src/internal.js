/** Agent ishchisi (Python) uchun ichki API. X-Internal-Token bilan himoyalangan. */
import { Router } from 'express';
import { serializeAgent } from './agents.js';
import { one, query } from './db.js';

export const internalRouter = Router();

internalRouter.get('/agents/by-number', async (req, res) => {
  const number = String(req.query.number || '').replace(/\s+/g, '');
  const a = await one(
    'SELECT * FROM agents WHERE phone_number = ? AND is_active = 1 AND inbound_enabled = 1',
    [number],
  );
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(serializeAgent(a));
});

internalRouter.get('/agents/:id', async (req, res) => {
  const a = await one('SELECT * FROM agents WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(serializeAgent(a));
});

internalRouter.post('/calls', async (req, res) => {
  const b = req.body;
  const r = await query(
    `INSERT INTO calls (agent_id, campaign_id, direction, channel, from_number, to_number, provider_call_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      b.agent_id,
      b.campaign_id || null,
      b.direction === 'outbound' ? 'outbound' : 'inbound',
      ['browser', 'twilio', 'sip'].includes(b.channel) ? b.channel : 'sip',
      b.from_number || '',
      b.to_number || '',
      b.provider_call_id || null,
    ],
  );
  if (b.contact_id) {
    await query('UPDATE campaign_contacts SET call_id = ? WHERE id = ?', [r.insertId, b.contact_id]);
  }
  res.status(201).json({ id: r.insertId });
});

internalRouter.patch('/calls/:id', async (req, res) => {
  const b = req.body;
  await query(
    `UPDATE calls SET status = ?, duration_sec = ?, transcript = ?, result = ?, ended_by = ?, ended_at = NOW()
     WHERE id = ?`,
    [
      b.status === 'failed' ? 'failed' : 'completed',
      Number(b.duration_sec) || 0,
      JSON.stringify(b.transcript || []),
      JSON.stringify(b.result || {}),
      b.ended_by || null,
      req.params.id,
    ],
  );
  if (b.contact_id) {
    await query("UPDATE campaign_contacts SET status = ? WHERE id = ? AND status = 'calling'", [
      b.status === 'failed' ? 'failed' : 'done',
      b.contact_id,
    ]);
  }
  res.json({ ok: true });
});
