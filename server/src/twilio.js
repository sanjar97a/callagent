import crypto from 'node:crypto';
import { config } from './config.js';
import { publicUrl, toWs } from './public-url.js';

const esc = (s) =>
  String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

export function twilioConfigured() {
  const t = config.twilio;
  return Boolean(t.accountSid && t.authToken && t.fromNumber);
}

/** Chiquvchi qo'ng'iroq: Twilio raqamni teradi va ovozni agent ishchisiga stream qiladi. */
export async function placeCall({ to, agentId, campaignId, contactId }) {
  const { accountSid, authToken, fromNumber } = config.twilio;
  const base = await publicUrl();
  if (!base) throw new Error('Ommaviy manzil yo‘q: tunnel hali ishga tushmagan');
  const streamUrl = toWs(base) + '/ws/twilio';
  const params = {
    direction: 'outbound',
    agent_id: agentId,
    campaign_id: campaignId,
    contact_id: contactId,
    from_number: fromNumber,
    to_number: to,
  };
  const twiml =
    `<Response><Connect><Stream url="${esc(streamUrl)}">` +
    Object.entries(params)
      .map(([k, v]) => `<Parameter name="${k}" value="${esc(v)}"/>`)
      .join('') +
    `</Stream></Connect></Response>`;

  const body = new URLSearchParams({
    To: to,
    From: fromNumber,
    Twiml: twiml,
    StatusCallback: `${base}/webhooks/twilio/status?contact_id=${contactId}`,
    StatusCallbackEvent: 'completed',
    Timeout: '30',
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Twilio xatosi ${res.status}`);
  return data.sid;
}

/** X-Twilio-Signature tekshiruvi (https://www.twilio.com/docs/usage/security). */
export async function validTwilioSignature(req) {
  const { authToken } = config.twilio;
  const base = await publicUrl();
  if (!authToken || !base) return false;
  const url = base + req.originalUrl;
  const params = req.body || {};
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  const expected = crypto.createHmac('sha1', authToken).update(data).digest('base64');
  const got = req.headers['x-twilio-signature'] || '';
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
