// frontend/auth.js

// API base partagée (évite les doubles déclarations entre fichiers)
window.API_BASE = window.API_BASE || window.location.origin;

let ACCESS_TOKEN = null;
window.ACCESS_TOKEN = null; // ✅ exposé pour les autres scripts (logic.js, etc.)

function setToken(token) {
  ACCESS_TOKEN = token;
  window.ACCESS_TOKEN = token; // ✅ garde en sync
}

// -------------- Bootstrap: récupérer un token au chargement via le cookie refresh
async function initAuth() {
  try {
    const r = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (r.ok) {
      const data = await r.json();
      setToken(data.accessToken);
    }
  } catch (_) {}
}

// -------------- Wrapper fetch: ajoute le Bearer + auto-refresh si 401
async function apiFetch(path, options = {}) {
  // ⬅️ IMPORTANT : s'assurer d'avoir un token avant chaque appel
  if (!ACCESS_TOKEN) await initAuth();

  const headers = options.headers || {};
  if (ACCESS_TOKEN) headers["Authorization"] = `Bearer ${ACCESS_TOKEN}`;
  options.headers = { "Content-Type": "application/json", ...headers };
  options.credentials = "include"; // cookie refresh

  let res = await fetch(`${API_BASE}${path}`, options);

  if (res.status === 401) {
    // token expiré → refresh → rejoue la requête
    const rr = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (rr.ok) {
      const data = await rr.json();
      setToken(data.accessToken);
      const headers2 = options.headers || {};
      headers2["Authorization"] = `Bearer ${ACCESS_TOKEN}`;
      options.headers = headers2;
      res = await fetch(`${API_BASE}${path}`, options);
    }
  }
  return res;
}

// -------------- Auth de base
async function register(email, password) {
  const r = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error("Inscription échouée");
  return r.json();
}

async function login(email, password, remember = true) {
  const r = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, remember }),
  });
  if (!r.ok) throw new Error("Login échoué");
  const data = await r.json();
  setToken(data.accessToken); // ✅
  return data;
}

async function logout() {
  await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
  setToken(null); // ✅
}

async function me() {
  const r = await apiFetch(`/me`);
  if (!r.ok) return null;
  return r.json();
}

// -------------- Logging d'événements générique
async function logEvent(type, payload = {}) {
  const r = await apiFetch(`/events`, {
    method: "POST",
    body: JSON.stringify({ type, payload }),
  });
  return r.ok;
}

// -------------- Garde pour pages protégées
async function requireAuth() {
  if (!ACCESS_TOKEN) await initAuth();
  const user = await me();
  if (!user) {
    window.location.href = "compte.html";
    return null;
  }
  return user;
}

// -------------- Auto-init au chargement de la page
document.addEventListener("DOMContentLoaded", initAuth);

// ====== Tracking "vu" utilisable depuis n'importe quel JS ======
window.trackMovieWatched = async (title, genre) => {
  try {
    const res = await apiFetch('/events', {
      method: 'POST',
      body: JSON.stringify({ type: 'movie_watched', payload: { title, genre } })
    });
    if (!res.ok) console.warn('trackMovieWatched failed', res.status, await res.text());
  } catch(e){ console.error('trackMovieWatched error', e); }
};

window.trackEpisodeWatched = async (series_title, season, episode, genre) => {
  try {
    const res = await apiFetch('/events', {
      method: 'POST',
      body: JSON.stringify({ type: 'episode_watched', payload: { series_title, season, episode, genre } })
    });
    if (!res.ok) console.warn('trackEpisodeWatched failed', res.status, await res.text());
  } catch(e){ console.error('trackEpisodeWatched error', e); }
};

// Point d’entrée unique si tu veux juste "marquer vu" en JS
window.markAsWatched = async (item) => {
  try {
    if (!ACCESS_TOKEN) await initAuth();
    if (item.type === 'movie' || item.kind === 'movie') {
      await window.trackMovieWatched(item.title || '', item.genre || '');
    } else if (item.type === 'episode' || item.kind === 'episode') {
      await window.trackEpisodeWatched(
        item.series_title || '',
        Number(item.season || 0),
        Number(item.episode || 0),
        item.genre || ''
      );
    } else {
      console.warn('markAsWatched: type inconnu', item);
    }
  } catch (e) {
    console.error('markAsWatched error', e);
  }
};
