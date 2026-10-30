import cors from 'cors';
import express from 'express';
import { agentsRouter } from './agents.js';
import { ensureAdmin, login, requireAuth, requireInternal } from './auth.js';
import { callsRouter, statsRouter } from './calls.js';
import { campaignsRouter, startDialer, webhooksRouter } from './campaigns.js';
import { config } from './config.js';
import { internalRouter } from './internal.js';
import { publicUrl } from './public-url.js';
import { twilioConfigured } from './twilio.js';

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

// async xatolarni umumiy handlerga yo'naltirish
const wrap = (router) => {
  for (const layer of router.stack) {
    for (const l of layer.route?.stack || []) {
      const fn = l.handle;
      l.handle = (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
    }
  }
  return router;
};

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const result = await login(req.body.email || '', req.body.password || '');
    if (!result) return res.status(401).json({ error: 'Email yoki parol noto‘g‘ri' });
    res.json(result);
  } catch (e) {
    next(e);
  }
});
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

app.use('/api/agents', requireAuth, wrap(agentsRouter));
app.use('/api/calls', requireAuth, wrap(callsRouter));
app.use('/api/campaigns', requireAuth, wrap(campaignsRouter));
app.use('/api/stats', requireAuth, wrap(statsRouter));
app.get('/api/system', requireAuth, async (_req, res, next) => {
  try {
    const url = await publicUrl();
    res.json({
      public_url: url,
      twilio_configured: twilioConfigured(),
      twilio_webhook: url ? `${url}/twilio/incoming` : null,
    });
  } catch (e) {
    next(e);
  }
});
app.use('/internal', requireInternal, wrap(internalRouter));
app.use('/webhooks', wrap(webhooksRouter));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Bu telefon raqam boshqa agentga biriktirilgan' });
  res.status(500).json({ error: 'Server xatosi' });
});

async function main() {
  await ensureAdmin();
  startDialer();
  app.listen(config.port, () => console.log(`CallAgent API: http://localhost:${config.port}`));
}

main().catch((e) => {
  console.error('Ishga tushmadi:', e);
  process.exit(1);
});
