const BASE = import.meta.env.VITE_API_URL || '';

export function getToken() {
  return localStorage.getItem('ca_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('ca_token', token);
  else localStorage.removeItem('ca_token');
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && path !== '/auth/login') {
    setToken(null);
    window.location.href = '/login';
    return;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `So‘rov bajarilmadi (${res.status})`);
  return data;
}

export const fmtDuration = (s) => {
  s = Number(s) || 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
