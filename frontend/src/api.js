const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const h = { ...headers };
  if (token)
    h.Authorization = `Bearer ${token}`;
  if (body instanceof FormData) { }
  else if (body) {
    h['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, { method, headers: h, body });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data.detail || message;
    }
    catch { }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}
