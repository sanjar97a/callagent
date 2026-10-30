import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const RATE = 16000;

// Mikrofondan kelgan audioni 16 kHz Int16 ga aylantirib, ~20 ms bo'laklarda yuboradigan worklet
const WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; this.ratio = sampleRate / ${RATE}; this.pos = 0; }
  process(inputs) {
    const ch = inputs[0][0];
    if (!ch) return true;
    for (; this.pos < ch.length; this.pos += this.ratio) {
      const s = Math.max(-1, Math.min(1, ch[Math.floor(this.pos)]));
      this.buf.push(s < 0 ? s * 0x8000 : s * 0x7fff);
    }
    this.pos -= ch.length;
    if (this.buf.length >= ${RATE / 50}) {
      this.port.postMessage(Int16Array.from(this.buf).buffer, []);
      this.buf = [];
    }
    return true;
  }
}
registerProcessor('capture', Capture);
`;

export default function TestCall({ agent, onClose }) {
  const [status, setStatus] = useState('idle'); // idle | connecting | live | ended | error
  const [error, setError] = useState('');
  const [lines, setLines] = useState([]);
  const refs = useRef({});
  const logRef = useRef(null);

  useEffect(() => () => hangup(true), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [lines]);

  function playPcm(buffer) {
    const r = refs.current;
    const pcm = new Int16Array(buffer);
    if (!pcm.length) return;
    const audio = r.ctx.createBuffer(1, pcm.length, RATE);
    const data = audio.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i] / 0x8000;
    const src = r.ctx.createBufferSource();
    src.buffer = audio;
    src.connect(r.ctx.destination);
    const at = Math.max(r.ctx.currentTime + 0.02, r.playAt || 0);
    src.start(at);
    r.playAt = at + audio.duration;
    r.sources.add(src);
    src.onended = () => r.sources.delete(src);
  }

  function stopPlayback() {
    const r = refs.current;
    r.sources?.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* allaqachon to'xtagan */
      }
    });
    r.sources?.clear();
    r.playAt = 0;
  }

  async function start() {
    setStatus('connecting');
    setError('');
    setLines([]);
    try {
      const { ws_url } = await api(`/agents/${agent.id}/test-session`, { method: 'POST' });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const ctx = new AudioContext();
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(url);
      const node = new AudioWorkletNode(ctx, 'capture');
      ctx.createMediaStreamSource(stream).connect(node);

      const ws = new WebSocket(ws_url);
      ws.binaryType = 'arraybuffer';
      refs.current = { ctx, stream, ws, node, sources: new Set(), playAt: 0 };

      node.port.onmessage = (e) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
      };
      ws.onopen = () => setStatus('live');
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return playPcm(e.data);
        const msg = JSON.parse(e.data);
        if (msg.type === 'clear') stopPlayback();
        if (msg.type === 'transcript') setLines((l) => [...l, msg]);
      };
      ws.onclose = (e) => {
        if (e.code !== 1000 && e.code !== 1005 && e.reason) {
          setError(`Ulanish yopildi: ${e.reason}`);
          setStatus('error');
        } else {
          setStatus((s) => (s === 'error' ? s : 'ended'));
        }
        cleanup();
      };
      ws.onerror = () => {
        setError('Agent serveriga ulanib bo‘lmadi. Agent ishchisi ishlayotganini tekshiring.');
        setStatus('error');
      };
    } catch (e) {
      setError(
        e.name === 'NotAllowedError' ? 'Mikrofonga ruxsat berilmadi. Brauzer sozlamasida ruxsat bering.' : e.message,
      );
      setStatus('error');
      cleanup();
    }
  }

  function cleanup() {
    const r = refs.current;
    r.stream?.getTracks().forEach((t) => t.stop());
    r.node?.disconnect();
    r.ctx?.state !== 'closed' && r.ctx?.close();
  }

  function hangup(silent = false) {
    const r = refs.current;
    if (r.ws?.readyState === WebSocket.OPEN) {
      r.ws.send(JSON.stringify({ type: 'hangup' }));
      setTimeout(() => r.ws.close(1000), 300);
    }
    cleanup();
    if (!silent) setStatus('ended');
  }

  const live = status === 'live' || status === 'connecting';

  return (
    <div className="modal-bg" onClick={(e) => e.target === e.currentTarget && !live && onClose()}>
      <div className="modal" role="dialog" aria-label={`${agent.name} bilan sinov qo‘ng‘irog‘i`}>
        <header className="modal-head">
          <div>
            <h2>{agent.name}</h2>
            <p className="muted small">Mikrofon orqali sinov. Qo‘ng‘iroq tarixda saqlanadi.</p>
          </div>
          <button className="link" onClick={() => (live ? hangup() : onClose())}>
            Yopish
          </button>
        </header>

        <div className="call-log" ref={logRef}>
          {lines.length === 0 && (
            <p className="muted">
              {status === 'live' ? 'Gapiring, agent tinglayapti…' : 'Qo‘ng‘iroqni boshlang va agent bilan gaplashing.'}
            </p>
          )}
          {lines.map((l, i) => (
            <div key={i} className={`bubble ${l.role}`}>
              {l.text}
            </div>
          ))}
        </div>

        {error && <div className="error">{error}</div>}

        <div className="call-actions">
          <span className={`live-dot ${status}`}>
            {
              {
                idle: 'Tayyor',
                connecting: 'Ulanmoqda…',
                live: 'Jonli',
                ended: 'Tugadi',
                error: 'Xato',
              }[status]
            }
          </span>
          {live ? (
            <button className="btn danger" onClick={() => hangup()}>
              Tugatish
            </button>
          ) : (
            <button className="btn primary" onClick={start}>
              {status === 'idle' ? 'Qo‘ng‘iroqni boshlash' : 'Qayta boshlash'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
