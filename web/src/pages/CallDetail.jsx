import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate, fmtDuration } from '../api.js';

export default function CallDetail() {
  const { id } = useParams();
  const [call, setCall] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/calls/${id}`).then(setCall).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="error">{error}</div>;
  if (!call) return null;
  const result = Object.entries(call.result || {});

  return (
    <>
      <header className="page-head">
        <div>
          <Link to="/calls" className="small">
            Qo‘ng‘iroqlar
          </Link>
          <h1>{call.agent_name}</h1>
          <p className="muted">
            {fmtDate(call.started_at)} · {call.direction === 'outbound' ? 'Chiquvchi' : 'Kiruvchi'} ·{' '}
            {fmtDuration(call.duration_sec)} · {call.ended_by === 'agent' ? 'agent tugatdi' : 'mijoz tugatdi'}
          </p>
        </div>
      </header>

      <div className="detail">
        <section className="panel">
          <h2>Suhbat</h2>
          <div className="call-log tall">
            {call.transcript.length === 0 && <p className="muted">Transkript yo‘q.</p>}
            {call.transcript.map((t, i) => (
              <div key={i} className={`bubble ${t.role}`}>
                {t.text}
              </div>
            ))}
          </div>
        </section>
        <aside className="panel">
          <h2>Natija</h2>
          {result.length === 0 ? (
            <p className="muted">Agent ma’lumot yig‘madi.</p>
          ) : (
            <dl className="kv">
              {result.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          )}
          <h2>Tafsilotlar</h2>
          <dl className="kv">
            <div>
              <dt>Kimdan</dt>
              <dd className="mono-num">{call.from_number || '—'}</dd>
            </div>
            <div>
              <dt>Kimga</dt>
              <dd className="mono-num">{call.to_number || '—'}</dd>
            </div>
            <div>
              <dt>Holat</dt>
              <dd>{{ completed: 'Yakunlangan', failed: 'Xato bilan tugagan', in_progress: 'Davom etmoqda' }[call.status]}</dd>
            </div>
            {call.campaign_id && (
              <div>
                <dt>Kampaniya</dt>
                <dd>
                  <Link to={`/campaigns/${call.campaign_id}`}>#{call.campaign_id}</Link>
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </div>
    </>
  );
}
