import { Router } from 'express';
import { makeTicket } from './auth.js';
import { one, parseJson, query } from './db.js';

const FIELDS = [
  'name',
  'description',
  'system_prompt',
  'first_message',
  'language',
  'voice',
  'voice_role',
  'speed',
  'inbound_enabled',
  'outbound_enabled',
  'is_active',
  'phone_number',
  'result_fields',
  'end_call_enabled',
];
const VOICES = ['nigora', 'zamira', 'yulduz'];

export function serializeAgent(a) {
  if (!a) return a;
  return {
    ...a,
    speed: Number(a.speed),
    inbound_enabled: !!a.inbound_enabled,
    outbound_enabled: !!a.outbound_enabled,
    is_active: !!a.is_active,
    end_call_enabled: !!a.end_call_enabled,
    result_fields: parseJson(a.result_fields, []),
  };
}

function validate(body, partial = false) {
  const errors = [];
  if (!partial || 'name' in body) {
    if (!body.name || String(body.name).trim().length < 2) errors.push('Agent nomi kamida 2 harf');
  }
  if (!partial || 'system_prompt' in body) {
    if (!body.system_prompt || String(body.system_prompt).trim().length < 10)
      errors.push('Prompt kamida 10 belgi bo‘lishi kerak');
  }
  if ('voice' in body && !VOICES.includes(body.voice)) errors.push('Ovoz: nigora, zamira yoki yulduz');
  if ('speed' in body && (Number(body.speed) < 0.5 || Number(body.speed) > 2))
    errors.push('Tezlik 0.5 dan 2 gacha');
  if ('result_fields' in body) {
    const rf = body.result_fields;
    if (!Array.isArray(rf) || rf.some((f) => !/^[a-zA-Z_][a-zA-Z0-9_]{0,39}$/.test(f?.name || '')))
      errors.push('Natija maydoni nomi lotin harf, raqam va _ dan iborat bo‘lsin');
  }
  return errors;
}

function pick(body) {
  const out = {};
  for (const k of FIELDS) {
    if (!(k in body)) continue;
    let v = body[k];
    if (k === 'result_fields') v = JSON.stringify(v || []);
    if (typeof v === 'boolean') v = v ? 1 : 0;
    if (k === 'phone_number') v = v ? String(v).replace(/\s+/g, '') : null;
    out[k] = v;
  }
  return out;
}

export const agentsRouter = Router();

agentsRouter.get('/', async (_req, res) => {
  const rows = await query(`
    SELECT a.*,
      (SELECT COUNT(*) FROM calls c WHERE c.agent_id = a.id) AS calls_count,
      (SELECT MAX(started_at) FROM calls c WHERE c.agent_id = a.id) AS last_call_at
    FROM agents a ORDER BY a.created_at DESC`);
  res.json(rows.map((r) => ({ ...serializeAgent(r), calls_count: Number(r.calls_count) })));
});

agentsRouter.get('/:id', async (req, res) => {
  const a = await one('SELECT * FROM agents WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Agent topilmadi' });
  res.json(serializeAgent(a));
});

agentsRouter.post('/', async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  const data = pick(req.body);
  if (!data.result_fields) data.result_fields = '[]';
  const r = await query('INSERT INTO agents SET ?', [data]);
  res.status(201).json(serializeAgent(await one('SELECT * FROM agents WHERE id = ?', [r.insertId])));
});

agentsRouter.put('/:id', async (req, res) => {
  const errors = validate(req.body, true);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });
  const data = pick(req.body);
  if (Object.keys(data).length) await query('UPDATE agents SET ? WHERE id = ?', [data, req.params.id]);
  const a = await one('SELECT * FROM agents WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Agent topilmadi' });
  res.json(serializeAgent(a));
});

agentsRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM agents WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/** Dashboarddan mikrofon orqali sinash uchun WebSocket manzili. */
agentsRouter.post('/:id/test-session', async (req, res) => {
  const a = await one('SELECT id FROM agents WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Agent topilmadi' });
  const ticket = makeTicket(a.id);
  // Brauzer dashboard qaysi manzildan ochilgan bo'lsa, o'sha manzilning /ws/ yo'liga ulanadi
  res.json({
    ws_path: `/ws/browser?agent_id=${a.id}&ticket=${encodeURIComponent(ticket)}&sample_rate=16000`,
  });
});
