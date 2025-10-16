/* =========================================================
   LOGIC.JS — Logique de la bibliothèque POPFLIX (enrichi)
   ========================================================= */

/* =========================
   0) CONSTANTES TMDb + ASSETS
   ========================= */
const TMDB_KEY  = "186e91ca5cf68f37adff53da8ea51136"; // ⚠️ mettre côté backend en prod
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const PLACEHOLDER = "data/images/placeholder_poster.png";

// ⚠️ partage propre avec auth.js (pas de re-déclaration const)
if (!window.API_BASE) window.API_BASE = window.location.origin;

/* =========================
   1) ÉTAT GLOBAL EN MÉMOIRE
   ========================= */
let items = []; // rempli après lecture du CSV

/* =========================
   2) LISTE DES GENRES (pour <select>)
   ========================= */
const GENRES = [
  "action","animation","aventure","biopic","comédie","comédie musicale","crime","documentaire",
  "drame","fantastique","fantasy","guerre","historique","horreur","mystère","romance",
  "science-fiction","sport","télé-réalité","thriller","western"
];

/* =========================================================
   3) NORMALISATIONS & TRANSFORMATIONS
   ========================================================= */
const toFrType = (t) => {
  const v = (t || "").toString().toLowerCase().trim();
  if (v === "serie" || v === "série" || v === "tv" || v === "show") return "Série";
  if (v === "film"  || v === "movie") return "Film";
  return v.startsWith("s") ? "Série" : "Film";
};

function isBad(val) {
  const v = (val || "").toString().trim().toLowerCase();
  return !v || v === "nan" || v === "null" || v === "none" || v === "undefined";
}

const norm = s =>
  (s || "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/* =========================================================
   4) APPELS TMDb (recherche d’affiches)
   ========================================================= */
async function tmdbSearchPoster(title, year, isTv) {
  const kind = isTv ? "tv" : "movie";
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    query: title || "",
    include_adult: "false",
    language: "fr-FR"
  });
  if (year) params.set(isTv ? "first_air_date_year" : "year", String(year));

  // 1) essai avec année
  let url = `${TMDB_BASE}/search/${kind}?${params.toString()}`;
  let r = await fetch(url);
  if (r.ok) {
    const data = await r.json();
    if (data.results?.[0]?.poster_path) return TMDB_IMG + data.results[0].poster_path;
  }

  // 2) essai sans année
  params.delete(isTv ? "first_air_date_year" : "year");
  url = `${TMDB_BASE}/search/${kind}?${params.toString()}`;
  r = await fetch(url);
  if (r.ok) {
    const data = await r.json();
    if (data.results?.[0]?.poster_path) return TMDB_IMG + data.results[0].poster_path;
  }

  return "";
}

// Petit cache local (affiches)
function cacheGet(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } }
function cacheSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

/* =========================================================
   5) MAPPING DU CSV -> MODÈLE INTERNE (ENRICHI)
   ========================================================= */
function ensureId(row, counters) {
  const raw = (row.id || "").toString().trim();
  if (/^[fs]\d+$/i.test(raw)) return raw.toLowerCase();
  const isSerie = toFrType(row.type) === "Série";
  if (isSerie) { counters.s += 1; return `s${String(counters.s).padStart(3, "0")}`; }
  counters.f += 1; return `f${String(counters.f).padStart(3, "0")}`;
}

function parseEpisodes(v){
  const s = (v ?? "").toString().trim().toLowerCase();
  if (!s || s === "nan" || s === "none") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function mapRow(row, counters) {
  return {
    id: ensureId(row, counters),
    title: (row.title || "").toString().trim(),
    poster: "", // hydraté plus tard via TMDb
    year: Number(row.year) || "",
    type: toFrType(row.type), // "Film" | "Série"
    genre: (row.genre || "").toString().trim(),

    // synopses
    synopsis_long: (row.synopsis_long || row.synopsis || "").toString().trim(),
    synopsis_short: (row.synopsis_short || "").toString().trim(),
    synopsis: (row.synopsis || row.synopsis_long || "").toString().trim(),

    // crédits
    director: (row.director || "").toString().trim(),
    actors: (row.actors || "").toString().trim(),

    number_of_episodes: parseEpisodes(row.number_of_episodes),
    state: ((row.state || "").toString().trim() || "not_started"),
  };
}

/* =========================================================
   6) OUTILS LIÉS AU GENRE
   ========================================================= */
function getItemGenres(it) {
  const raw = (it.genre || "").toString();
  if (!raw) return [];
  return raw
    .split(/[,/|•;]+/g)
    .map(s => norm(s.trim()))
    .filter(Boolean);
}

/* =========================================================
   7) RENDU DES CARTES (ENRICHI)
   ========================================================= */
function cleanPoster(url) {
  let u = (url || "").toString().trim();
  if (!u) return PLACEHOLDER;
  if (u.startsWith("/data/")) return u;
  if (u.startsWith("/") && !u.startsWith("//")) return TMDB_IMG + u;
  return u.replace(/^http:\/\//i, "https://").replace(/\s+/g, " ");
}

function toCardHTML(item) {
  const poster   = cleanPoster(item.poster);
  const title    = (item.title || "").toString().trim();
  const typeFr   = (item.type || "").toString().trim();  // "Film" | "Série"
  const isSerie  = typeFr.toLowerCase().startsWith('s');
  const type     = isSerie ? 'serie' : 'film';
  const year     = item.year || "";
  const genre    = (item.genre || "").toString().trim();
  const synopsisShort = (item.synopsis_short || item.synopsis_long || item.synopsis || "").toString().trim();

  return `
    <article class="carte ${type}" data-type="${type}">
      <div class="card" data-id="${item.id}">
        <div class="poster">
          <img
            class="poster-img"
            src="${poster}"
            alt="Affiche de ${title}"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null; this.src='${PLACEHOLDER}';"
          >
        </div>
        <div class="card-body">
          <div class="container"><span class="type">${isSerie ? 'Série' : 'Film'}</span></div>
          <h3 class="title">${title}</h3>
          <ul class="meta">
            ${year     ? `<li class="year">${year}</li>`   : ''}
            ${genre    ? `<li class="genre">${genre}</li>` : ''}
          </ul>
          ${synopsisShort ? `<div class="synopsis">${synopsisShort}</div>` : ''}
        </div>
      </div>

      <div class="boutons">
        <button type="button" class="btn btn-watchlist">Ajouter à ma watchlist</button>
        <button type="button" class="btn btn-wishlist">Ajouter à ma wishlist</button>
      </div>
    </article>
  `;
}

function sortAlphabetically(list) {
  return (list || []).slice().sort((a, b) =>
    (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' })
  );
}

// === Local lists (lecture seule) + normalisation titre ===
function readList(name){ try { return JSON.parse(localStorage.getItem(name) || '[]'); } catch { return []; } }
const normalizeTitle = s => norm(s || '');

// Priorité "done" > autres
function computeLocalStateIndex(){
  const all = [...readList('watchlist'), ...readList('wishlist')];
  const idx = new Map();
  for (const it of all){
    const id = (it?.id || '').toString().trim();
    const keyId = id ? `id:${id}` : null;
    const keyTitle = `t:${normalizeTitle(it?.title)}`;
    const st = (it?.state || 'not_started').toLowerCase();

    const choose = prev => (prev === 'done' ? 'done' : (st === 'done' ? 'done' : st));
    if (keyId) idx.set(keyId, choose(idx.get(keyId)));
    idx.set(keyTitle, choose(idx.get(keyTitle)));
  }
  return idx;
}

function mergeLocalStates(list){
  const idx = computeLocalStateIndex();
  return (list || []).map(it => {
    const idKey = it.id ? `id:${it.id}` : null;
    const tKey  = `t:${normalizeTitle(it.title)}`;
    const st = (idKey && idx.get(idKey)) || idx.get(tKey);
    if (st) it.state = st;
    return it;
  });
}

function mergeWithLocalLists(csvItems) {
  const wishlist  = readList('wishlist');
  const watchlist = readList('watchlist');

  const byKey = new Map();
  const put = (it) => {
    const key = it?.id ? `id:${it.id}` : `t:${normalizeTitle(it?.title)}`;
    if (!byKey.has(key)) byKey.set(key, it);
  };

  csvItems.forEach(put);
  [...wishlist, ...watchlist].forEach(raw => {
    put({
      id: raw.id,
      title: raw.title,
      poster: raw.poster || raw.image || "",
      year: raw.year || "",
      type: (raw.type || "").toLowerCase() === 'serie' ? 'Série' : 'Film',
      genre: raw.genre || "",
      synopsis_long: raw.synopsis || raw.synopsis_long || "",
      synopsis_short: raw.synopsis_short || "",
      synopsis: raw.synopsis || "",
      director: raw.director || "",
      actors: raw.actors || "",
      number_of_episodes: raw.number_of_episodes ?? null,
      state: raw.state || "not_started",
    });
  });

  return [...byKey.values()];
}

function renderCards(list) {
  const container = document.getElementById("catalog");
  if (!container) return;
  const sorted = sortAlphabetically(list);
  container.innerHTML = sorted.map(toCardHTML).join("");
}

/* =========================================================
   8) FILTRES (état + application)
   ========================================================= */
const filterState = {
  type: null,          // "series" | "films" | null
  statut: null,        // "not_started" | "started" | "done" | null
  genres: new Set(),   // 0 ou 1 entrée via le <select>
  query: ""            // texte
};

function applyFilters() {
  const q = norm(filterState.query);

  const filtered = (items || []).filter(it => {
    if (filterState.type) {
      const t = norm(it.type);
      const wantSeries = filterState.type === "series";
      if (wantSeries && t !== "série" && t !== "serie") return false;
      if (!wantSeries && filterState.type === "films" && t !== "film") return false;
    }
    if (filterState.statut) {
      if (norm(it.state) !== norm(filterState.statut)) return false;
    }
    if (filterState.genres.size) {
      const g = [...filterState.genres][0];
      const itemGenres = getItemGenres(it);
      if (!itemGenres.includes(g)) return false;
    }
    if (q) {
      const hay = [it.title, it.genre, it.director, it.actors, it.synopsis_long, it.synopsis_short]
        .map(x => norm(x)).join(" ");
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' }));
  renderCards(filtered);
}

/* =========================================================
   9) LISTES LOCALES (watchlist / wishlist)
   ========================================================= */
function saveToList(listName, item) {
  try {
    const list = JSON.parse(localStorage.getItem(listName) || '[]');
    const normf = s => (s||'').toString().trim().toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu,'');
    const idx = list.findIndex(i => (i.id && item.id && i.id === item.id) || normf(i.title) === normf(item.title));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item };
      localStorage.setItem(listName, JSON.stringify(list));
      return false; // déjà présent
    }
    list.push(item);
    localStorage.setItem(listName, JSON.stringify(list));
    return true;
  } catch { return false; }
}

function setButtonLabel(el, text) {
  if (!el) return;
  if (el.tagName === 'INPUT') el.value = text;
  else el.textContent = text;
}

function onCatalogClick(e) {
  const btn = e.target.closest('.btn-watchlist, .btn-wishlist');
  if (btn) {
    if (btn.dataset.lock === '1') return;
    btn.dataset.lock = '1';

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

    const article = btn.closest('article.carte');
    if (!article) { btn.dataset.lock = '0'; return; }

    const idEl = article.querySelector('.card[data-id]');
    const id   = idEl?.dataset?.id;
    if (!id) { btn.dataset.lock = '0'; return; }

    const it = items.find(x => x.id === id);
    if (!it) { btn.dataset.lock = '0'; return; }

    const payload = {
      id: it.id,
      title: it.title,
      image: cleanPoster(it.poster) || PLACEHOLDER,
      type: (it.type || '').toLowerCase().startsWith('s') ? 'serie' : 'film',
      year: it.year || '',
      genre: it.genre || '',
      synopsis: it.synopsis_long || it.synopsis || '',
      synopsis_short: it.synopsis_short || '',
      director: it.director || '',
      actors: it.actors || '',
      state: "not_started"
    };

    const key = btn.classList.contains('btn-wishlist') ? 'wishlist' : 'watchlist';
    const added = saveToList(key, payload);

    btn.setAttribute('aria-live', 'polite');
    if (added) {
      setButtonLabel(btn, 'Ajouté ✓');
      btn.classList.add('is-added');
      btn.setAttribute('aria-label', 'Ajouté à la liste');
    } else {
      setButtonLabel(btn, 'Déjà ajouté');
      btn.classList.add('is-added');
      btn.setAttribute('aria-label', 'Déjà présent dans la liste');
    }

    setTimeout(() => { btn.dataset.lock = '0'; }, 350);
    return;
  }

  // === Navigation si clic ailleurs sur la carte ===
  const card = e.target.closest('.card[data-id]');
  if (!card) return;

  const id = card.dataset.id;
  if (!id) return;

  const it = items.find(x => x.id === id);
  if (it) {
    const payload = {
      id: it.id,
      type: it.type,
      title: it.title,
      year: it.year,
      genre: it.genre,
      synopsis_long: it.synopsis_long || it.synopsis || "",
      synopsis_short: it.synopsis_short || "",
      synopsis: it.synopsis || "",
      director: it.director || "",
      actors: it.actors || "",
      poster: cleanPoster(it.poster) || PLACEHOLDER
    };
    sessionStorage.setItem('popflix:selected', JSON.stringify(payload));
  }

  window.location.href = `carte.html?id=${encodeURIComponent(id)}`;
}

/* =========================================================
   10) FILTRES (UI) — câblage des <select> et <input>
   ========================================================= */
function populateGenreSelect(){
  const sel = document.getElementById("genre-select");
  if(!sel) return;
  sel.innerHTML =
    `<option value="">Tous les genres</option>` +
    GENRES.map(g => {
      const label = g.charAt(0).toUpperCase() + g.slice(1);
      return `<option value="${norm(g)}">${label}</option>`;
    }).join("");
  sel.addEventListener("change", () => {
    filterState.genres.clear();
    const v = sel.value;
    if (v) filterState.genres.add(v);
    applyFilters();
  });
}

function initFilters() {
  const typeSel = document.getElementById("type-select");
  if (typeSel) {
    typeSel.addEventListener("change", () => {
      filterState.type = typeSel.value || null;
      applyFilters();
    });
  }

  const stSel = document.getElementById("statut-select");
  if (stSel) {
    stSel.addEventListener("change", () => {
      filterState.statut = stSel.value || null;
      applyFilters();
    });
  }

  populateGenreSelect();

  const input = document.getElementById("q");
  if (input) {
    let t;
    input.addEventListener("input", (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        filterState.query = e.target.value || "";
        applyFilters();
      }, 200);
    });
  }

  const clearBtn = document.getElementById("filters-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      filterState.type = null;
      filterState.statut = null;
      filterState.genres.clear();
      filterState.query = "";

      if (typeSel) typeSel.value = "";
      if (stSel)   stSel.value = "";
      const gSel = document.getElementById("genre-select");
      if (gSel) gSel.value = "";
      const input = document.getElementById("q");
      if (input) input.value = "";

      applyFilters();
    });
  }
}

/* =========================================================
   11) CHARGEMENT CSV (fallback) + HYDRATATION
   ========================================================= */
async function loadCatalogueCSV() {
  const CANDIDATES = [
    "data/base_de_donnees/films_series_200_filled_episodes.csv",
    "data/base_de_donnees/films_series_200_filled.csv"
  ];

  for (const url of CANDIDATES) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const text = await res.text();
      return await new Promise((resolve, reject) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          transformHeader: h => h.trim(),
          complete: (r) => resolve(r.data || []),
          error: reject
        });
      });
    } catch {
      // essaie le suivant
    }
  }
  return [];
}

async function loadCSVAndBoot() {
  try {
    const rows = await loadCatalogueCSV();

    const counters = { f: 0, s: 0 };
    const mapped = rows.map(row => mapRow(row, counters));

    // 1) Applique les statuts locaux sur le CSV…
    let merged = mergeLocalStates(mapped);
    // …et ajoute les éléments présents UNIQUEMENT dans les listes locales
    merged = mergeWithLocalLists(merged);

    items = merged;

    renderCards(items.map(it => ({ ...it, poster: PLACEHOLDER })));
    await hydratePosters(items);
    applyFilters();

    initFilters();
  } catch (e) {
    console.error("Erreur de chargement CSV :", e);
    renderCards([]);
  }
}

/* =========================================================
   12) INITIALISATION AU CHARGEMENT DE LA PAGE
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const catalog = document.getElementById('catalog');
  if (catalog) catalog.addEventListener('click', onCatalogClick);

  if (document.body?.dataset?.page === 'bibliotheque') {
    loadCSVAndBoot();
  }

  // 🔁 Backfill "vu" depuis les listes locales (une seule fois)
  // attend que auth.js ait exposé markAsWatched
  setTimeout(() => { 
    if (typeof window.markAsWatched === 'function') backfillWatchedOnce();
  }, 500);
});

/* =========================================================
   13) HYDRATATION ASYNCHRONE DES AFFICHES (TMDb)
   ========================================================= */
async function hydratePosters(list, concurrency = 6) {
  const queue = [...list];
  const workers = [];

  async function worker() {
    while (queue.length) {
      const it = queue.shift();
      if (!it) break;

      const key = `tmdb:poster:${(it.title||"").toLowerCase()}|${it.year||""}|${it.type}`;
      const cached = cacheGet(key);
      if (cached) { it.poster = cached; continue; }

      const isTv = (it.type === "Série");
      let posterUrl = await tmdbSearchPoster(it.title, it.year, isTv);
      if (isBad(posterUrl)) posterUrl = "";

      it.poster = posterUrl;
      cacheSet(key, posterUrl);

      await new Promise(r => setTimeout(r, 120));
    }
  }

  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
}

/* =========================================================
   14) BACKFILL des éléments déjà "vus" (localStorage -> /events)
   ========================================================= */
async function backfillWatchedOnce() {
  const KEY = 'popflix_synced_events_v1';
  const synced = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
  const saveSynced = () => localStorage.setItem(KEY, JSON.stringify([...synced]));

  const names = ['watchlist','wishlist'];
  let changed = false;

  for (const name of names) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(name) || '[]'); } catch { list = []; }
    for (const it of list) {
      const done = (it.state === 'done') || it.watched === true || it.status === 'done';
      if (!done) continue;

      // Films
      if ((it.type === 'film') || (it.type === 'movie') || (it.type || '').toLowerCase() === 'film') {
        const key = `m:${it.title}`;
        if (synced.has(key)) continue;
        await window.markAsWatched({ type: 'movie', title: it.title || '', genre: it.genre || '' });
        synced.add(key); changed = true;
      }

      // Épisodes
      if (it.type === 'episode' || it.kind === 'episode') {
        const key = `e:${it.series_title}:${it.season}:${it.episode}`;
        if (synced.has(key)) continue;
        await window.markAsWatched({
          type: 'episode',
          series_title: it.series_title || '',
          season: Number(it.season || 0),
          episode: Number(it.episode || 0),
          genre: it.genre || ''
        });
        synced.add(key); changed = true;
      }
    }
  }

  if (changed) saveSynced();
}
