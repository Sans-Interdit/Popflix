/* =========================================================
   LOGIC.JS — Logique de la bibliothèque POPFLIX
   - Chargement CSV
   - Requêtes TMDb pour les affiches
   - Rendu des cartes
   - Filtres + tri A→Z
   - Ajout à watchlist / wishlist (localStorage)
   ========================================================= */

/* =========================
   0) CONSTANTES TMDb + ASSETS
   ========================= */
const TMDB_KEY  = "186e91ca5cf68f37adff53da8ea51136";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG  = "https://image.tmdb.org/t/p/w500";
const PLACEHOLDER = "/data/images/placeholder_poster.png";

/* =========================
   1) ÉTAT GLOBAL EN MÉMOIRE
   - items : liste des contenus chargés depuis le CSV
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
   - toFrType : "film"/"serie" -> "Film"/"Série"
   - isBad    : détecte une valeur vide/non exploitable
   - norm     : normalise texte (minuscule + sans accent)
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
   - tmdbSearchPoster : cherche une affiche via /search/movie|tv
   - cache localStorage simple pour éviter de re-querier
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
   5) MAPPING DU CSV -> MODÈLE INTERNE
   - ensureId : f001/s001 auto si id manquant
   - mapRow   : normalise chaque ligne du CSV en item
   ========================================================= */
function ensureId(row, counters) {
  const raw = (row.id || "").toString().trim();
  if (/^[fs]\d+$/i.test(raw)) return raw.toLowerCase();
  const isSerie = toFrType(row.type) === "Série";
  if (isSerie) { counters.s += 1; return `s${String(counters.s).padStart(3, "0")}`; }
  counters.f += 1; return `f${String(counters.f).padStart(3, "0")}`;
}

function mapRow(row, counters) {
  return {
    id: ensureId(row, counters),
    title: (row.title || "").toString().trim(),
    poster: "", // hydraté plus tard via TMDb
    year: Number(row.year) || "",
    type: toFrType(row.type), // "Film" | "Série"
    genre: (row.genre || "").toString().trim(),
    synopsis: (row.synopsis || "").toString().trim(),
    state: (row.state || "").toString().trim() || undefined,
  };
}

/* =========================================================
   6) OUTILS LIÉS AU GENRE
   - getItemGenres : "Action, Drame" -> ["action","drame"] normalisés
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
   7) RENDU DES CARTES
   - cleanPoster  : sécurise l’URL de l’affiche (+ placeholder)
   - toCardHTML   : génère le HTML d’une carte
   - sortAlphabetically : tri A→Z par titre
   - renderCards  : injecte les cartes triées dans #catalog
   ========================================================= */
function cleanPoster(url) {
  let u = (url || "").toString().trim();
  if (!u) return PLACEHOLDER;
  if (/^\/[A-Za-z0-9]/.test(u) && /\.(jpg|png|webp)$/i.test(u)) u = TMDB_IMG + u;
  u = u.replace(/^http:\/\//i, "https://").replace(/\s+/g, " ");
  return u;
}


  function toCardHTML(item) {
    const poster   = cleanPoster(item.poster);
    const title    = (item.title || "").toString().trim();
    const typeFr   = (item.type || "").toString().trim();  // "Film" | "Série"
    const isSerie  = typeFr.toLowerCase().startsWith('s');
    const type     = isSerie ? 'serie' : 'film';            // normalisé pour data/class
    const year     = item.year || "";
    const genre    = (item.genre || "").toString().trim();
    const synopsis = (item.synopsis || "").toString().trim();



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
            ${year  ? `<li class="year">${year}</li>`   : ''}
            ${genre ? `<li class="genre">${genre}</li>` : ''}
          </ul>
          ${synopsis ? `
            <div class="synopsis-label">Synopsis :</div>
            <div class="synopsis">${synopsis}</div>
          ` : ''}
        </div>
      </div>

      <!-- Boutons d’action (ajouts vers listes locales) -->
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

function renderCards(list) {
  const container = document.getElementById("catalog");
  if (!container) return;
  const sorted = sortAlphabetically(list);        // tri A→Z par défaut
  container.innerHTML = sorted.map(toCardHTML).join("");
}

/* =========================================================
   8) FILTRES (état + application)
   - filterState : type/statut/genre/texte
   - applyFilters: applique les filtres + tri A→Z -> renderCards
   ========================================================= */
const filterState = {
  type: null,          // "series" | "films" | null
  statut: null,        // "started" | "done"  | null
  genres: new Set(),   // 0 ou 1 entrée via le <select>
  query: ""            // texte
};

function applyFilters() {
  const q = norm(filterState.query);

  const filtered = (items || []).filter(it => {
    // TYPE
    if (filterState.type) {
      const t = norm(it.type); // "film" / "série"
      const wantSeries = filterState.type === "series";
      if (wantSeries && t !== "série" && t !== "serie") return false;
      if (!wantSeries && filterState.type === "films" && t !== "film") return false;
    }
    // STATUT
    if (filterState.statut) {
      if (norm(it.state) !== norm(filterState.statut)) return false;
    }
    // GENRE
    if (filterState.genres.size) {
      const g = [...filterState.genres][0];
      const itemGenres = getItemGenres(it);
      if (!itemGenres.includes(g)) return false;
    }
    // TITRE
    if (q && !norm(it.title).includes(q)) return false;

    return true;
  });

  // Tri A→Z avant rendu
  filtered.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' }));

  renderCards(filtered);
}

/* =========================================================
   9) LISTES LOCALES (watchlist / wishlist)
   - saveToList      : ajoute si absent (clé: id ou titre)
   - setButtonLabel  : utilitaire UI
   - onCatalogClick  : gestion des clics "Ajouter à ..."
   ========================================================= */
function saveToList(listName, item) {
  try {
    const list = JSON.parse(localStorage.getItem(listName)) || [];
    const exists = list.some(i => (i.id && item.id && i.id === item.id) || i.title === item.title);
    if (exists) return false;
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
  // 1) Boutons watchlist / wishlist (inchangé)
  const btn = e.target.closest('.btn-watchlist, .btn-wishlist');
  if (btn) {
    e.preventDefault();

    const article = btn.closest('article.carte');
    if (!article) return;

    const idEl = article.querySelector('.card[data-id]');
    const id = idEl?.dataset?.id;
    if (!id) return;

    const item = items.find(it => it.id === id);
    if (!item) return;

    const payload = {
      id: item.id,
      title: item.title,
      image: cleanPoster(item.poster) || PLACEHOLDER,
      type: (item.type || '').toLowerCase().startsWith('s') ? 'serie' : 'film',
      year: item.year || '',
      genre: item.genre || '',
      synopsis: item.synopsis || ''
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
    return; // ⚠️ ne pas propager au clic de navigation
  }

  // 2) Navigation vers la page carte au clic sur la carte
  const card = e.target.closest('.card[data-id]');
  if (!card) return;

  const id = card.dataset.id;
  if (!id) return;

  // Redirige vers carte.html avec l'ID en query string
  window.location.href = `carte.html?id=${encodeURIComponent(id)}`;
}


/* =========================================================
   10) FILTRES (UI) — câblage des <select> et <input>
   - populateGenreSelect : remplit le select des genres
   - initFilters         : abonne les listeners + bouton reset
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
  // TYPE
  const typeSel = document.getElementById("type-select");
  if (typeSel) {
    typeSel.addEventListener("change", () => {
      filterState.type = typeSel.value || null;
      applyFilters();
    });
  }

  // STATUT
  const stSel = document.getElementById("statut-select");
  if (stSel) {
    stSel.addEventListener("change", () => {
      filterState.statut = stSel.value || null;
      applyFilters();
    });
  }

  // GENRE
  populateGenreSelect();

  // TITRE (input avec léger debounce)
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

  // RESET (vide les filtres, remet le rendu)
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
      if (input) input.value = "";

      applyFilters();
    });
  }
}

/* =========================================================
   11) BOOTSTRAP : chargement CSV + hydratation affiches
   - loadCSVAndBoot : charge CSV, mappe items, rend avec placeholders,
                      hydrate affiches TMDb (concurrence), puis applique filtres
   ========================================================= */
async function loadCSVAndBoot() {
  const csvUrl = "/data/base_de_donnees/films_series_200_filled.csv";
  try {
    const res = await fetch(csvUrl, { cache: "no-store" });
    const csvText = await res.text();

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });

    const counters = { f: 0, s: 0 };
    items = parsed.data.map(row => mapRow(row, counters));

    // 1) Affiche vite avec placeholders
    renderCards(items.map(it => ({ ...it, poster: PLACEHOLDER })));

    // 2) Hydrate posters TMDb puis rend + filtre (tri A→Z)
    await hydratePosters(items);
    applyFilters();

    // 3) Câblage des filtres (après 1er rendu OK)
    initFilters();
  } catch (e) {
    console.error("Erreur de chargement CSV :", e);
    renderCards([]);
  }
}

/* =========================================================
   12) INITIALISATION AU CHARGEMENT DE LA PAGE
   - branche le handler de clics sur #catalog
   - ne boote la biblio que si on est sur la page correspondante
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const catalog = document.getElementById('catalog');
  if (catalog) catalog.addEventListener('click', onCatalogClick);

  if (document.body?.dataset?.page === 'bibliotheque') {
    loadCSVAndBoot();
  }
});

/* =========================================================
   13) HYDRATATION ASYNCHRONE DES AFFICHES (TMDb)
   - hydratePosters : workers concurrents qui remplissent item.poster
                      + cache localStorage pour éviter les re-queries
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

      // Petit throttle pour TMDb
      await new Promise(r => setTimeout(r, 120));
    }
  }

  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
}
