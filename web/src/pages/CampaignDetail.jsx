import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fmtDate } from '../api.js';
import { Progress, STATUS } from './Campaigns.jsx';

const CONTACT = { pending: 'Navbatda', calling: 'Qo‘ng‘iroqda', done: 'Bajarildi', failed: 'Bo‘lmadi' };

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [more, setMore] = useState('');

  const load = () => api(`/campaigns/${id}`).then(setC).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // jarayonni jonli kuzatish
    return () => clearInterval(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function action(a) {
    setError('');
    try {
      await api(`/campaigns/${id}/${a}`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function addContacts(e) {
    e.preventDefault();
    try {
      await api(`/campaigns/${id}/contacts`, { method: 'POST', body: { contacts_text: more } });
      setMore('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    if (!confirm('Kampaniyani o‘chirasizmi?')) return;
    await api(`/campaigns/${id}`, { method: 'DELETE' });
    navigate('/campaigns');
  }

  if (!c) return error ? <div className="error">{error}</div> : null;

  return (
    <>
      <header className="page-head">
        <div>
          <Link to="/campaigns" className="small">
            Kampaniyalar
          </Link>
          <h1>{c.name}</h1>
          <p className="muted">
            {c.agent_name} · bir vaqtda {c.concurrency} ta · {c.max_attempts} urinish ·{' '}
            <span className={`tag st-${c.status}`}>{STATUS[c.status]}</span>
          </p>
        </div>
        <div className="row">
          {c.status === 'running' ? (
            <button className="btn ghost" onClick={() => action('pause')}>
              To‘xtatish
            </button>
          ) : (
            c.stats.pending > 0 && (
              <button className="btn primary" onClick={() => action('start')}>
                {c.status === 'paused' ? 'Davom ettirish' : 'Boshlash'}
              </button>
            )
          )}
          <button className="btn ghost" onClick={remove}>
            O‘chirish
          </button>
        </div>
      </header>
      {error && <div className="error">{error}</div>}
      {!c.twilio_configured && (
        <div className="notice">Telefon liniyasi ulanmagan: serverdagi TWILIO_* sozlamalarini to‘ldiring, shunda kampaniya boshlanadi.</div>
      )}

      <section className="panel">
        <div className="stats-line">
          <span><b>{c.stats.done}</b> bajarildi</span>
          <span><b>{c.stats.calling}</b> hozir qo‘ng‘iroqda</span>
          <span><b>{c.stats.pending}</b> navbatda</span>
          <span><b>{c.stats.failed}</b> bo‘lmadi</span>
        </div>
        <Progress stats={c.stats} total={c.total} />
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Raqam</th>
              <th>Ism</th>
              <th>Holat</th>
              <th className="num">Urinish</th>
              <th>Izoh</th>
              <th>Yangilangan</th>
            </tr>
          </thead>
          <tbody>
            {c.contacts.map((k) => (
              <tr key={k.id}>
                <td className="mono-num">{k.call_id ? <Link to={`/calls/${k.call_id}`}>{k.phone}</Link> : k.phone}</td>
                <td>{k.name || '—'}</td>
                <td>
                  <span className={`tag ct-${k.status}`}>{CONTACT[k.status]}</span>
                </td>
                <td className="num">{k.attempts}</td>
                <td className="muted small">{k.last_error || ''}</td>
                <td className="small">{fmtDate(k.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form className="panel" onSubmit={addContacts}>
        <h2>Raqam qo‘shish</h2>
        <textarea rows={3} value={more} onChange={(e) => setMore(e.target.value)} placeholder="+998901234567, Ism" aria-label="Yangi raqamlar" />
        <button className="btn ghost" disabled={!more.trim()}>
          Qo‘shish
        </button>
      </form>
    </>
  );
}
