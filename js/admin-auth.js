
async function attemptLogin(username, password) {
  try {
    const res = await fetch(SLNA_CONFIG.API_BASE_URL + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    if (!res.ok) return false;
    const data = await res.json();
    sessionStorage.setItem('slna_admin_token', data.token);
    sessionStorage.setItem('slna_admin_session', JSON.stringify(data.user));
    return true;
  } catch (err) { console.error('Login request failed:', err); return false; }
}
function getSession() { const raw = sessionStorage.getItem('slna_admin_session'); if (!raw) return null; try { return JSON.parse(raw); } catch (e) { return null; } }
function getToken() { return sessionStorage.getItem('slna_admin_token'); }
function logout() { sessionStorage.removeItem('slna_admin_token'); sessionStorage.removeItem('slna_admin_session'); window.location.href = 'admin-login.html'; }
function requireAuth() { const session = getSession(); const token = getToken(); if (!session || !token) { window.location.href = 'admin-login.html'; return null; } return session; }
