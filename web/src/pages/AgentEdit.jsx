import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

const EMPTY = {
  name: '',
  description: '',
  system_prompt: '',
  first_message: '',
  voice: 'nigora',
  voice_role: '',
  speed: 1,
  language: 'uz-UZ',
  inbound_enabled: true,
  outbound_enabled: false,
  is_active: true,
  phone_number: '',
  end_call_enabled: true,
  result_fields: [],
};

const VOICES = [
  { id: 'nigora', label: 'Nigora', roles: [] },
  { id: 'zamira', label: 'Zamira', roles: ['neutral', 'strict', 'friendly'] },
  { id: 'yulduz', label: 'Yulduz', roles: ['neutral', 'strict', 'friendly', 'whisper'] },
];
const ROLE_LABEL = { neutral: 'Neytral', strict: 'Jiddiy', friendly: 'Do‘stona', whisper: 'Shivirlab' };

export default function AgentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isNew = !id;

  useEffect(() => {
    if (!isNew) api(`/agents/${id}`).then((a) => setForm({ ...EMPTY, ...a, phone_number: a.phone_number || '' })).catch((e) => setError(e.message));
  }, [id, isNew]);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };
  const voice = VOICES.find((v) => v.id === form.voice) || VOICES[0];

  function setField(i, k, v) {
    setForm((f) => ({
      ...f,
      result_fields: f.result_fields.map((r, j) => (j === i ? { ...r, [k]: v } : r)),
    }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body = {
      ...form,
      speed: Number(form.speed),
      voice_role: voice.roles.includes(form.voice_role) ? form.voice_role : '',
      result_fields: form.result_fields.filter((r) => r.name.trim()),
    };
    delete body.id;
    delete body.created_at;
    delete body.updated_at;
    delete body.calls_count;
    delete body.last_call_at;
    try {
      if (isNew) await api('/agents', { method: 'POST', body });
      else await api(`/agents/${id}`, { method: 'PUT', body });
      navigate('/agents');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm(`“${form.name}” agentini o‘chirasizmi? Uning qo‘ng‘iroqlar tarixi ham o‘chadi.`)) return;
    await api(`/agents/${id}`, { method: 'DELETE' });
    navigate('/agents');
  }

  return (
    <form className="edit" onSubmit={save}>
      <header className="page-head">
        <h1>{isNew ? 'Yangi agent' : form.name || 'Agent'}</h1>
        <div className="row">
          {!isNew && (
            <button type="button" className="btn ghost" onClick={remove}>
              O‘chirish
            </button>
          )}
          <button className="btn primary" disabled={saving}>
            {saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </header>
      {error && <div className="error">{error}</div>}

      <section className="panel">
        <h2>Kim va nima uchun</h2>
        <div className="grid2">
          <label>
            Nomi
            <input value={form.name} onChange={set('name')} placeholder="Aziza - NPS aniqlovchi" required />
          </label>
          <label>
            Qisqa tavsif
            <input value={form.description} onChange={set('description')} placeholder="Mijoz qoniqishini so‘raydi" />
          </label>
        </div>
        <label>
          Vazifa (prompt)
          <textarea
            rows={8}
            value={form.system_prompt}
            onChange={set('system_prompt')}
            required
            placeholder="Sen Aziza, kompaniyaning operatorisan. Mijozdan xizmatimizni 1 dan 10 gacha baholashini so‘ra…"
          />
          <span className="hint">
            Agent kim, nima qiladi, nimani bilmasa nima deydi — shularni yozing. Ovozli suhbat qoidalari avtomatik qo‘shiladi.
          </span>
        </label>
        <label>
          Birinchi gap
          <input
            value={form.first_message}
            onChange={set('first_message')}
            placeholder="Assalomu alaykum! Men Aziza…"
          />
          <span className="hint">Bo‘sh qolsa, agent o‘zi salomlashadi.</span>
        </label>
      </section>

      <section className="panel">
        <h2>Ovoz</h2>
        <div className="grid3">
          <label>
            Ovoz
            <select value={form.voice} onChange={set('voice')}>
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ohang
            <select value={form.voice_role} onChange={set('voice_role')} disabled={!voice.roles.length}>
              <option value="">Standart</option>
              {voice.roles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tezlik: {Number(form.speed).toFixed(1)}
            <input type="range" min="0.7" max="1.5" step="0.1" value={form.speed} onChange={set('speed')} />
          </label>
        </div>
      </section>

      <section className="panel">
        <h2>Yo‘nalish</h2>
        <div className="checks">
          <label className="check">
            <input type="checkbox" checked={form.inbound_enabled} onChange={set('inbound_enabled')} />
            Kiruvchi qo‘ng‘iroqlarga javob beradi
          </label>
          <label className="check">
            <input type="checkbox" checked={form.outbound_enabled} onChange={set('outbound_enabled')} />
            Kampaniyalarda o‘zi qo‘ng‘iroq qiladi
          </label>
          <label className="check">
            <input type="checkbox" checked={form.end_call_enabled} onChange={set('end_call_enabled')} />
            Suhbat tugagach go‘shakni o‘zi qo‘yadi
          </label>
        </div>
        <label className="narrow">
          Kiruvchi raqam
          <input value={form.phone_number} onChange={set('phone_number')} placeholder="+998901234567" />
          <span className="hint">Shu raqamga kelgan qo‘ng‘iroqqa aynan shu agent javob beradi.</span>
        </label>
      </section>

      <section className="panel">
        <h2>Yig‘iladigan ma’lumotlar</h2>
        <p className="muted small">
          Agent suhbat davomida aniqlab, qo‘ng‘iroq natijasiga yozadi. Nom lotin harflarda, bo‘sh joysiz.
        </p>
        {form.result_fields.map((r, i) => (
          <div className="field-row" key={i}>
            <input
              value={r.name}
              onChange={(e) => setField(i, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
              placeholder="nps"
              aria-label="Maydon nomi"
            />
            <input
              value={r.description || ''}
              onChange={(e) => setField(i, 'description', e.target.value)}
              placeholder="Mijoz bergan baho, 1 dan 10 gacha"
              aria-label="Maydon tavsifi"
            />
            <button
              type="button"
              className="link"
              onClick={() => setForm((f) => ({ ...f, result_fields: f.result_fields.filter((_, j) => j !== i) }))}
            >
              Olib tashlash
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn ghost"
          onClick={() => setForm((f) => ({ ...f, result_fields: [...f.result_fields, { name: '', description: '' }] }))}
        >
          Maydon qo‘shish
        </button>
      </section>
    </form>
  );
}
