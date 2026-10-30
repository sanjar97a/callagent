import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export const STATUS = { draft: 'Qoralama', running: 'Ishlayapti', paused: 'To‘xtatilgan', done: 'Tugagan' };

export function Progress({ stats, total }) {
  const pct = (n) => (total ? (n / total) * 100 : 0);
  return (
    <div className="progress" title={`${stats.done} bajarildi, ${stats.failed} xato, ${stats.calling} hozir, ${stats.pending} navbatda`}>
      <i className="p-done" style={{ width: `${pct(stats.done)}%` }} />
      <i className="p-failed" style={{ width: `${pct(stats.failed)}%` }} />
      <i className="p-calling" style={{ width: `${pct(stats.calling)}%` }} />
    </div>
  );
}

export default function Campaigns() {
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [agents, setAgents] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', agent_id: '', concurrency: 2, max_attempts: 2, contacts_text: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api('/campaigns').then(setList).catch((e) => setError(e.message));
    api('/agents').then((a) => setAgents(a.filter((x) => x.outbound_enabled))).catch(() => {});
  }, []);

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      const c = await api('/campaigns', { method: 'POST', body: form });
      navigate(`/campaigns/${c.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Kampaniyalar</h1>
          <p className="muted">Agent ro‘yxatdagi raqamlarga o‘zi qo‘ng‘iroq qiladi.</p>
        </div>
        {!creating && (
          <button className="btn primary" onClick={() => setCreating(true)}>
            Yangi kampaniya
          </button>
        )}
      </header>
      {error && <div className="error">{error}</div>}

      {creating && (
        <form className="panel" onSubmit={create}>
          <h2>Yangi kampaniya</h2>
          {agents.length === 0 && (
            <p className="error">Chiquvchi qo‘ng‘iroq yoqilgan agent yo‘q. Agent sozlamasida “Kampaniyalarda o‘zi qo‘ng‘iroq qiladi”ni yoqing.</p>
          )}
          <div className="grid2">
            <label>
              Nomi
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Oktyabr NPS so‘rovi" required />
            </label>
            <label>
              Agent
              <select value={form.agent_id} onChange={(e) => setForm({ ...form, agent_id: e.target.value })} required>
                <option value="">Tanlang</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bir vaqtda nechta qo‘ng‘iroq
              <input type="number" min="1" max="20" value={form.concurrency} onChange={(e) => setForm({ ...form, concurrency: e.target.value })} />
            </label>
            <label>
              Javob bermasa necha marta urinish
              <input type="number" min="1" max="5" value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: e.target.value })} />
            </label>
          </div>
          <label>
            Raqamlar
            <textarea
              rows={6}
              value={form.contacts_text}
              onChange={(e) => setForm({ ...form, contacts_text: e.target.value })}
              placeholder={'+998901234567, Ali Valiyev\n998937654321, Malika'}
            />
            <span className="hint">Har qatorda bitta raqam, vergul bilan ism. Excel’dan nusxa olib qo‘yish mumkin.</span>
          </label>
          <div className="row">
            <button className="btn primary">Kampaniyani yaratish</button>
            <button type="button" className="btn ghost" onClick={() => setCreating(false)}>
              Bekor qilish
            </button>
          </div>
        </form>
      )}

      {list && list.length === 0 && !creating && <div className="empty">Kampaniya yo‘q.</div>}
      {list && list.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nomi</th>
                <th>Agent</th>
                <th>Holat</th>
                <th>Jarayon</th>
                <th className="num">Bajarildi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/campaigns/${c.id}`}>{c.name}</Link>
                  </td>
                  <td>{c.agent_name}</td>
                  <td>
                    <span className={`tag st-${c.status}`}>{STATUS[c.status]}</span>
                  </td>
                  <td className="progress-cell">
                    <Progress stats={c.stats} total={c.total} />
                  </td>
                  <td className="num">
                    {c.stats.done} / {c.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
