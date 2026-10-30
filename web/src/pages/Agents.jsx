import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, fmtDuration } from '../api.js';
import TestCall from '../components/TestCall.jsx';

export default function Agents() {
  const [agents, setAgents] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(null);

  async function load() {
    try {
      const [a, s] = await Promise.all([api('/agents'), api('/stats')]);
      setAgents(a);
      setStats(s);
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle(agent) {
    const next = !agent.is_active;
    setAgents((list) => list.map((a) => (a.id === agent.id ? { ...a, is_active: next } : a)));
    try {
      await api(`/agents/${agent.id}`, { method: 'PUT', body: { is_active: next } });
    } catch (e) {
      setError(e.message);
      load();
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Agentlar</h1>
          {stats && (
            <p className="muted">
              {stats.active_agents} ta ishlayapti, jami {stats.agents} ta · bugun {stats.calls_today} ta
              qo‘ng‘iroq · o‘rtacha {fmtDuration(stats.avg_duration)}
            </p>
          )}
        </div>
        <Link className="btn primary" to="/agents/new">
          Yangi agent
        </Link>
      </header>

      {error && <div className="error">{error}</div>}
      {agents && agents.length === 0 && (
        <div className="empty">
          Hali agent yo‘q. Birinchisini yarating: unga vazifa, ovoz va yig‘iladigan ma’lumotlarni berasiz.
        </div>
      )}

      <div className="agent-grid">
        {agents?.map((a) => (
          <article key={a.id} className={`agent-card ${a.is_active ? 'on' : 'off'}`}>
            <div className="agent-top">
              <span className="wave" aria-hidden="true">
                <i /><i /><i /><i /><i />
              </span>
              <div className="agent-title">
                <h2>{a.name}</h2>
                <p className="muted small">
                  {a.calls_count} qo‘ng‘iroq
                  {a.last_call_at ? ` · oxirgisi ${fmtDate(a.last_call_at)}` : ''}
                </p>
              </div>
            </div>
            {a.description && <p className="agent-desc">{a.description}</p>}
            <div className="chips">
              <span className={`chip ${a.inbound_enabled ? 'chip-on' : ''}`}>Kiruvchi</span>
              <span className={`chip ${a.outbound_enabled ? 'chip-on' : ''}`}>Chiquvchi</span>
              {a.phone_number && <span className="chip mono-num">{a.phone_number}</span>}
              <span className="chip">Ovoz: {a.voice}</span>
            </div>
            <footer className="agent-foot">
              <Link to={`/agents/${a.id}`}>Sozlash</Link>
              <button className="link" onClick={() => setTesting(a)}>
                Sinab ko‘rish
              </button>
              <label className="switch">
                <span>{a.is_active ? 'Ishlayapti' : 'O‘chiq'}</span>
                <input type="checkbox" checked={a.is_active} onChange={() => toggle(a)} />
                <span className="track" aria-hidden="true" />
              </label>
            </footer>
          </article>
        ))}
      </div>

      {testing && (
        <TestCall
          agent={testing}
          onClose={() => {
            setTesting(null);
            load();
          }}
        />
      )}
    </>
  );
}
