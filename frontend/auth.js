// frontend/auth.js
// Adapte si ton Flask tourne ailleurs :
const API_BASE = window.location.origin;


let ACCESS_TOKEN = null;

// -------------- Bootstrap: récupérer un token au chargement via le cookie refresh
async function initAuth() {
  // Essaye d'obtenir un access token au démarrage (silencieux)
  try {
    const r = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (r.ok) {
      const data = await r.json();
      ACCESS_TOKEN = data.accessToken;
    }
  } catch (_) {}
}

// -------------- Wrapper fetch: ajoute le Bearer + auto-refresh si 401
async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  if (ACCESS_TOKEN) headers["Authorization"] = `Bearer ${ACCESS_TOKEN}`;
  options.headers = { "Content-Type": "application/json", ...headers };
  options.credentials = "include"; // IMPORTANT pour envoyer/recevoir le cookie refresh

  let res = await fetch(`${API_BASE}${path}`, options);

  // Si token expiré → tente un refresh puis rejoue la requête
  if (res.status === 401) {
    const rr = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (rr.ok) {
      const data = await rr.json();
      ACCESS_TOKEN = data.accessToken;
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
  ACCESS_TOKEN = data.accessToken; // en mémoire (le cookie gère la persistance)
  return data;
}

async function logout() {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  ACCESS_TOKEN = null;
}

async function me() {
  const r = await apiFetch(`/me`);
  if (!r.ok) return null;
  return r.json();
}

// -------------- Logging d'événements
async function logEvent(type, payload = {}) {
  const r = await apiFetch(`/events`, {
    method: "POST",
    body: JSON.stringify({ type, payload }),
  });
  return r.ok;
}

// -------------- Garde pour pages protégées
async function requireAuth() {
  if (!ACCESS_TOKEN) await initAuth(); // tente d'abord de récupérer via cookie
  const user = await me();
  if (!user) {
    // redirige vers ta page de compte/login
    window.location.href = "compte.html";
    return null;
  }
  return user;
}

// -------------- Auto-init au chargement de la page
document.addEventListener("DOMContentLoaded", initAuth);


