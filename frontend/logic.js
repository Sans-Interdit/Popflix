// ---------- TMDb ----------
const TMDB_KEY = "186e91ca5cf68f37adff53da8ea51136";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500"; // tu peux changer w342/w500/w780
const PLACEHOLDER = "/data/images/placeholder_poster.png"; // vérifie que le fichier existe

// ------- Données (chargées dynamiquement) -------
let items = []; // sera rempli après lecture du CSV

// Utilitaire pour normaliser "film"/"serie" -> "Film"/"Série"
const toFrType = (t) => {
  const v = (t || "").toString().toLowerCase().trim();
  if (v === "serie" || v === "série" || v === "tv" || v === "show") return "Série";
  if (v === "film" || v === "movie") return "Film";
  // fallback : si inconnu, on tente de deviner
  return v.startsWith("s") ? "Série" : "Film";
};

function isBad(val) {
  const v = (val || "").toString().trim().toLowerCase();
  return !v || v === "nan" || v === "null" || v === "none" || v === "undefined";
}

async function tmdbSearchPoster(title, year, isTv) {
  const kind = isTv ? "tv" : "movie";
  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    query: title || "",
    include_adult: "false",
    language: "fr-FR"
  });
  // Essai avec année si dispo
  if (year) params.set(isTv ? "first_air_date_year" : "year", String(year));

  // 1) avec année
  let url = `${TMDB_BASE}/search/${kind}?${params.toString()}`;
  let r = await fetch(url);
  if (r.ok) {
    const data = await r.json();
    if (data.results && data.results[0] && data.results[0].poster_path) {
      return TMDB_IMG + data.results[0].poster_path;
    }
  }
  // 2) sans année
  params.delete(isTv ? "first_air_date_year" : "year");
  url = `${TMDB_BASE}/search/${kind}?${params.toString()}`;
  r = await fetch(url);
  if (r.ok) {
    const data = await r.json();
    if (data.results && data.results[0] && data.results[0].poster_path) {
      return TMDB_IMG + data.results[0].poster_path;
    }
  }
  return ""; // rien trouvé
}

// petit cache local pour ne pas réinterroger TMDb
function cacheGet(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}
function cacheSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}


// Génère un id f001… / s001… si le CSV n’en a pas au bon format
function ensureId(row, counters) {
  const raw = (row.id || "").toString().trim();
  if (/^[fs]\d+$/i.test(raw)) return raw.toLowerCase();
  const isSerie = toFrType(row.type) === "Série";
  if (isSerie) {
    counters.s += 1;
    return `s${String(counters.s).padStart(3, "0")}`;
  } else {
    counters.f += 1;
    return `f${String(counters.f).padStart(3, "0")}`;
  }
}

// Parse + map une ligne CSV -> ton modèle
function mapRow(row, counters) {
  return {
    id: ensureId(row, counters),
    title: (row.title || "").toString().trim(),
    poster: "", // on remplira après via TMDb
    year: Number(row.year) || "",
    type: toFrType(row.type),
    genre: (row.genre || "").toString().trim(),
    synopsis: (row.synopsis || "").toString().trim(),
    state: (row.state || "").toString().trim() || undefined,
  };
}


// ---------- Utils ----------
const norm = s => (s || "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

// ---------- Rendu ----------
function cleanPoster(url) {
  let u = (url || "").toString().trim();
  if (!u) return PLACEHOLDER;
  // s'il s'agit d'un path TMDb
  if (/^\/[A-Za-z0-9]/.test(u) && /\.(jpg|png|webp)$/i.test(u)) {
    u = TMDB_IMG + u;
  }
  u = u.replace(/^http:\/\//i, "https://");
  u = u.replace(/\s+/g, " ");
  return u;
}


function toCardHTML(item) {
  const poster = cleanPoster(item.poster);
  const title = (item.title || "").toString().trim();
  const type = (item.type || "").toString().trim();
  const year = item.year || "";
  const genre = (item.genre || "").toString().trim();
  const synopsis = (item.synopsis || "").toString().trim();

  return `
    <article class="carte">
      <div class="card" data-id="${item.id}">
        <div class="poster">
          <img
            class="poster-img"
            src="${poster}"
            alt="Affiche de ${title}"
            loading="lazy"
            decoding="async"
            onerror="this.onerror=null; this.src='/data/images/placeholder_poster.png';"
          >
        </div>
        <div class="card-body">
          <div class="container"><span class="type">${type}</span></div>
          <h3>${title}</h3>
          <ul class="meta">
            <li>${year}</li>
            <li>${genre}</li>
          </ul>
          <div class="synopsis-label">Synopsis :</div>
          <div class="synopsis">${synopsis}</div>
        </div>
      </div>
      <div class="boutons">
        <button class="btn btn-watchlist">Ajouter à ma watchlist</button>
        <button class="btn btn-wishlist">Ajouter à ma wishlist</button>
      </div>
    </article>
  `;
}



function renderCards(list) {
  const container = document.getElementById("catalog");
  if (!container) return;
  container.innerHTML = (list || []).map(toCardHTML).join("");
}

// ---------- Filtres ----------
const state = { type: null, prog: null, query: "" };

function applyFilters() {
  const q = norm(state.query);
  const filtered = (items || []).filter(it => {
    if (state.type) {
      const t = norm(it.type); // "film" / "série"
      const wantSeries = state.type === "series";
      if (wantSeries && t !== "série" && t !== "serie") return false;
      if (!wantSeries && state.type === "films" && t !== "film") return false;
    }
    if (state.prog) {
      if (norm(it.state) !== norm(state.prog)) return false;
    }
    if (q && !norm(it.title).includes(q)) return false;
    return true;
  });
  renderCards(filtered);
}

// ---------- Watchlist / Wishlist (localStorage) ----------

function saveToList(listName, item) {
  try {
    const list = JSON.parse(localStorage.getItem(listName)) || [];
    const exists = list.some(i =>
      (i.id && item.id && i.id === item.id) || i.title === item.title
    );
    if (exists) return false;
    list.push(item);
    localStorage.setItem(listName, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function onCatalogClick(e) {
  const btn = e.target.closest('.btn-watchlist, .btn-wishlist');
  if (!btn) return; // on ignore tout le reste (nav incluse)

  // Empêche un éventuel <a href="#"> ou submit
  e.preventDefault();

  // On est dans <article class="carte"> ... <div class="card" data-id="..."> ... <div class="boutons"> <button ...>
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
    type: item.type,
    year: item.year
  };

  const key = btn.classList.contains('btn-wishlist') ? 'wishlist' : 'watchlist';
  const added = saveToList(key, payload);

  // petit feedback visuel
  if (added) {
    const original = btn.textContent;
    btn.textContent = 'Ajouté ✓';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 900);
  }
}

// brancher la délégation une seule fois quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
  const catalog = document.getElementById('catalog');
  if (catalog) {
    catalog.addEventListener('click', onCatalogClick);
  }
});


function initFilters() {
  document.querySelectorAll(".filtre").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const prog = btn.dataset.state;
      if (type) state.type = (state.type === type) ? null : type;
      if (prog) state.prog = (state.prog === prog) ? null : prog;
      document.querySelectorAll(`[data-type]`).forEach(b => b.classList.toggle("active", state.type === b.dataset.type));
      document.querySelectorAll(`[data-state]`).forEach(b => b.classList.toggle("active", state.prog === b.dataset.state));
      applyFilters();
    });
  });

  const input = document.getElementById("q");
  if (input) {
    input.addEventListener("input", (e) => {
      state.query = e.target.value || "";
      applyFilters();
    });
  }
}

// ---------- Chargement CSV & Boot ----------
async function loadCSVAndBoot() {
  const csvUrl = "/data/base_de_donnees/films_series_200_filled.csv"; // ou ton CSV sans 'poster'
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

    // 1) affiche vite un squelette (avec placeholders)
    renderCards(items.map(it => ({ ...it, poster: PLACEHOLDER })));

    // 2) hydrate les posters via TMDb puis rerender
    await hydratePosters(items);
    applyFilters(); // rend avec les vraies affiches

    initFilters();
  } catch (e) {
    console.error("Erreur de chargement CSV :", e);
    renderCards([]);
  }
}


document.addEventListener("DOMContentLoaded", loadCSVAndBoot);

async function hydratePosters(list, concurrency = 6) {
  const queue = [...list];
  const workers = [];
  async function worker() {
    while (queue.length) {
      const it = queue.shift();
      if (!it) break;
      // clef de cache: titre + année + type
      const key = `tmdb:poster:${(it.title||"").toLowerCase()}|${it.year||""}|${it.type}`;
      const cached = cacheGet(key);
      if (cached) {
        it.poster = cached;
        continue;
      }
      const isTv = (it.type === "Série");
      let posterUrl = await tmdbSearchPoster(it.title, it.year, isTv);
      if (isBad(posterUrl)) posterUrl = ""; // pour laisser PLACEHOLDER prendre le relais
      it.poster = posterUrl;
      cacheSet(key, posterUrl);
      // petite pause pour rester cool avec TMDb
      await new Promise(r => setTimeout(r, 120));
    }
  }
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
}
