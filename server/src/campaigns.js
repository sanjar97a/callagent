import { Router } from 'express';
import { config } from './config.js';
import { one, query } from './db.js';
import { placeCall, twilioConfigured, validTwilioSignature } from './twilio.js';

export const campaignsRouter = Router();

async function campaignWithStats(id) {
  const c = await one(
    `SELECT c.*, a.name AS agent_name FROM campaigns c JOIN agents a ON a.id = c.agent_id WHERE c.id = ?`,
    [id],
  );
  if (!c) return null;
  const rows = await query(
    'SELECT status, COUNT(*) AS n FROM campaign_contacts WHERE campaign_id = ? GROUP BY status',
    [id],
  );
  const stats = { pending: 0, calling: 0, done: 0, failed: 0 };
  for (const r of rows) stats[r.status] = Number(r.n);
  return { ...c, stats, total: Object.values(stats).reduce((a, b) => a + b, 0) };
}

/** "998901234567, Ali" ko'rinishidagi qatorlarni o'qiydi. */
export function parseContacts(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    const [rawPhone, ...rest] = line.split(/[,;\t]/);
    let phone = (rawPhone || '').replace(/[^\d+]/g, '');
    if (!phone) continue;
    if (!phone.startsWith('+')) phone = '+' + phone;
    if (!/^\+\d{9,15}$/.test(phone) || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ phone, name: rest.join(',').trim().slice(0, 120) });
  }
  return out;
}

campaignsRouter.get('/', async (_req, res) => {
  const list = await query('SELECT id FROM campaigns ORDER BY created_at DESC');
  res.json(await Promise.all(list.map((c) => campaignWithStats(c.id))));
});

campaignsRouter.get('/:id', async (req, res) => {
  const c = await campaignWithStats(req.params.id);
  if (!c) return res.status(404).json({ error: 'Kampaniya topilmadi' });
  const contacts = await query(
    'SELECT * FROM campaign_contacts WHERE campaign_id = ? ORDER BY id LIMIT 1000',
    [req.params.id],
  );
  res.json({ ...c, contacts, twilio_configured: twilioConfigured() });
});

campaignsRouter.post('/', async (req, res) => {
  const { name, agent_id, concurrency = 2, max_attempts = 2, contacts_text = '' } = req.body;
  if (!name || !agent_id) return res.status(400).json({ error: 'Nom va agent tanlanishi shart' });
  const agent = await one('SELECT id FROM agents WHERE id = ?', [agent_id]);
  if (!agent) return res.status(400).json({ error: 'Agent topilmadi' });
  const r = await query(
    'INSERT INTO campaigns (name, agent_id, concurrency, max_attempts) VALUES (?, ?, ?, ?)',
    [name, agent_id, Math.min(Math.max(Number(concurrency) || 1, 1), 20), Math.min(Math.max(Number(max_attempts) || 1, 1), 5)],
  );
  const contacts = parseContacts(contacts_text);
  if (contacts.length) {
    await query('INSERT INTO campaign_contacts (campaign_id, phone, name) VALUES ?', [
      contacts.map((c) => [r.insertId, c.phone, c.name]),
    ]);
  }
  res.status(201).json(await campaignWithStats(r.insertId));
});

campaignsRouter.post('/:id/contacts', async (req, res) => {
  const contacts = parseContacts(req.body.contacts_text);
  if (!contacts.length) return res.status(400).json({ error: 'Yaroqli raqam topilmadi' });
  await query('INSERT INTO campaign_contacts (campaign_id, phone, name) VALUES ?', [
    contacts.map((c) => [req.params.id, c.phone, c.name]),
  ]);
  res.json(await campaignWithStats(req.params.id));
});

campaignsRouter.post('/:id/:action(start|pause)', async (req, res) => {
  if (req.params.action === 'start' && !twilioConfigured())
    return res.status(400).json({ error: 'Twilio sozlanmagan (.env dagi TWILIO_* qiymatlari)' });
  const status = req.params.action === 'start' ? 'running' : 'paused';
  await query('UPDATE campaigns SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json(await campaignWithStats(req.params.id));
});

campaignsRouter.delete('/:id', async (req, res) => {
  await query('DELETE FROM campaigns WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Twilio status webhook ----------
export const webhooksRouter = Router();

webhooksRouter.post('/twilio/status', async (req, res) => {
  if (!validTwilioSignature(req)) return res.status(403).send('bad signature');
  const contactId = Number(req.query.contact_id);
  const status = req.body.CallStatus;
  const contact = await one(
    `SELECT cc.*, c.max_attempts FROM campaign_contacts cc JOIN campaigns c ON c.id = cc.campaign_id WHERE cc.id = ?`,
    [contactId],
  );
  if (contact && contact.status === 'calling') {
    if (['busy', 'no-answer', 'failed', 'canceled'].includes(status)) {
      const next = contact.attempts < contact.max_attempts ? 'pending' : 'failed';
      await query('UPDATE campaign_contacts SET status = ?, last_error = ? WHERE id = ?', [next, status, contactId]);
    } else if (status === 'completed') {
      // agent hisobot bermagan bo'lsa ham kontaktni yopamiz
      await query("UPDATE campaign_contacts SET status = 'done' WHERE id = ?", [contactId]);
    }
  }
  res.type('text/xml').send('<Response/>');
});

// ---------- Dialer: ishlayotgan kampaniyalar bo'yicha raqam teradi ----------
let ticking = false;

export async function dialerTick() {
  if (ticking) return;
  ticking = true;
  try {
    // 10 daqiqadan beri "calling" holatida qolganlarni qayta navbatga qo'yamiz
    await query(
      `UPDATE campaign_contacts cc JOIN campaigns c ON c.id = cc.campaign_id
       SET cc.status = IF(cc.attempts < c.max_attempts, 'pending', 'failed'), cc.last_error = 'timeout'
       WHERE cc.status = 'calling' AND cc.updated_at < NOW() - INTERVAL 10 MINUTE`,
    );
    const campaigns = await query("SELECT * FROM campaigns WHERE status = 'running'");
    for (const c of campaigns) {
      const [{ calling, pending }] = await query(
        `SELECT SUM(status = 'calling') AS calling, SUM(status = 'pending') AS pending
         FROM campaign_contacts WHERE campaign_id = ?`,
        [c.id],
      );
      if (!Number(pending) && !Number(calling)) {
        await query("UPDATE campaigns SET status = 'done' WHERE id = ?", [c.id]);
        continue;
      }
      const free = c.concurrency - Number(calling || 0);
      if (free <= 0) continue;
      const batch = await query(
        "SELECT * FROM campaign_contacts WHERE campaign_id = ? AND status = 'pending' ORDER BY attempts, id LIMIT ?",
        [c.id, free],
      );
      for (const contact of batch) {
        await query(
          "UPDATE campaign_contacts SET status = 'calling', attempts = attempts + 1, last_error = NULL WHERE id = ?",
          [contact.id],
        );
        try {
          await placeCall({ to: contact.phone, agentId: c.agent_id, campaignId: c.id, contactId: contact.id });
        } catch (e) {
          const next = contact.attempts + 1 < c.max_attempts ? 'pending' : 'failed';
          await query('UPDATE campaign_contacts SET status = ?, last_error = ? WHERE id = ?', [
            next,
            String(e.message).slice(0, 250),
            contact.id,
          ]);
        }
      }
    }
  } catch (e) {
    console.error('Dialer xatosi:', e.message);
  } finally {
    ticking = false;
  }
}

export function startDialer() {
  setInterval(dialerTick, config.dialerIntervalMs);
}
