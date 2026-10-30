import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, fmtDate, fmtDuration } from '../api.js';

const PAGE = 50;
const CHANNEL = { browser: 'Brauzer', twilio: 'Telefon', sip: 'SIP' };

export default function Calls() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState('');
  const offset = Number(params.get('offset') || 0);

  useEffect(() => {
    api('/agents').then(setAgents).catch(() => {});
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(params);
    q.set('limit', PAGE);
    api(`/calls?${q}`).then(setData).catch((e) => setError(e.message));
  }, [params]);

  const setFilter = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    next.delete('offset');
    setParams(next);
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Qo‘ng‘iroqlar</h1>
          {data && <p className="muted">{data.total} ta qo‘ng‘iroq</p>}
        </div>
        <div className="row">
          <select value={params.get('agent_id') || ''} onChange={(e) => setFilter('agent_id', e.target.value)} aria-label="Agent">
            <option value="">Barcha agentlar</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select value={params.get('direction') || ''} onChange={(e) => setFilter('direction', e.target.value)} aria-label="Yo‘nalish">
            <option value="">Har ikki yo‘nalish</option>
            <option value="inbound">Kiruvchi</option>
            <option value="outbound">Chiquvchi</option>
          </select>
        </div>
      </header>
      {error && <div className="error">{error}</div>}
      {data && data.items.length === 0 && (
        <div className="empty">Qo‘ng‘iroq yo‘q. Agent kartasidagi “Sinab ko‘rish” bilan birinchisini qiling.</div>
      )}
      {data && data.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Vaqt</th>
                <th>Agent</th>
                <th>Kim bilan</th>
                <th>Kanal</th>
                <th className="num">Davomiylik</th>
                <th>Natija</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/calls/${c.id}`}>{fmtDate(c.started_at)}</Link>
                  </td>
                  <td>{c.agent_name}</td>
                  <td className="mono-num">
                    {c.direction === 'outbound' ? '↗ ' : '↘ '}
                    {(c.direction === 'outbound' ? c.to_number : c.from_number) || '—'}
                  </td>
                  <td>{CHANNEL[c.channel]}</td>
                  <td className="num">
                    {c.status === 'in_progress' ? <span className="live-dot live">Jonli</span> : fmtDuration(c.duration_sec)}
                  </td>
                  <td className="result-cell">
                    {c.status === 'failed' && <span className="tag bad">Xato</span>}
                    {Object.entries(c.result || {})
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(', ') || <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > PAGE && (
        <div className="pager">
          <button className="btn ghost" disabled={offset === 0} onClick={() => setFilter('offset', String(Math.max(0, offset - PAGE)))}>
            Oldingi
          </button>
          <span className="muted">
            {offset + 1}–{Math.min(offset + PAGE, data.total)} / {data.total}
          </span>
          <button className="btn ghost" disabled={offset + PAGE >= data.total} onClick={() => {
            const next = new URLSearchParams(params);
            next.set('offset', String(offset + PAGE));
            setParams(next);
          }}>
            Keyingi
          </button>
        </div>
      )}
    </>
  );
}
