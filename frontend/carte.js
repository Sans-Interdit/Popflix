// ===============================
// POPFLIX — carte.js (watchlist / wishlist + épisodes)
// ===============================

// ----- Étoiles / états boutons -----
const stars = document.querySelectorAll('.star');
let currentRating = 0;

const wishedBtn  = document.querySelector(".wished-btn");
const wishedText = wishedBtn ? wishedBtn.querySelector(".wished-text") : null;
let isWished = false;

const watchedBtn  = document.querySelector(".watched-btn");
const watchedText = watchedBtn ? watchedBtn.querySelector(".watched-text") : null;
let isWatched = false;

const wishedState  = { false: "Ajouter à la wishlist", true: "☑ Dans votre wishlist" };
const watchedState = { false: "J'ai vu cette œuvre",   true: "☑ Œuvre regardée !" };

const appState = {
  // { id, type, title, release_date, genres, overview, director, actors, poster, number_of_episodes }
  oeuvre: null,
  // [bool] pour séries
  episodesWatched: []
};

// ----- Helpers DOM -----
function setText(selector, text) {
  const el = document.querySelector(selector);
  if (el) el.textContent = text ?? "";
}

function renderOeuvre(o) {
  if (!o) return;
  setText('[data-field="type"]',         o.type || "");
  setText('[data-field="title"]',        o.title || "");
  setText('[data-field="release_date"]', o.release_date || "");
  setText('[data-field="genres"]',       o.genres || "");
  setText('[data-field="overview"]',     o.overview || o.synopsis_long || o.synopsis || "");
  setText('[data-field="director"]',     o.director || "");
  setText('[data-field="actors"]',       o.actors || "");
}

function setPoster(src) {
  const posterEl = document.querySelector('#poster');
  if (!posterEl) return;
  posterEl.src = src || "./data/images/placeholder_poster.png";
}

// ----- TMDb fetch poster -----
async function fetchTmdbPoster({ title, type, release_date }) {
  try {
    if (!title) return null;
    const TMDB_BASE = "https://api.themoviedb.org/3";
    const kind = (type || "").toLowerCase().startsWith("s") ? "tv" : "movie";
    const tmdbParams = new URLSearchParams({
      api_key: "186e91ca5cf68f37adff53da8ea51136",
      query: title,
      include_adult: "false",
      language: "fr-FR"
    });
    const y = String(release_date || "").slice(0, 4);
    if (/^\d{4}$/.test(y)) tmdbParams.set(kind === "tv" ? "first_air_date_year" : "year", y);

    const url = `${TMDB_BASE}/search/${kind}?${tmdbParams.toString()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const path = data?.results?.[0]?.poster_path;
    return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
  } catch {
    return null;
  }
}

// ----- Mapping util -----
function mapToOeuvre(src) {
  if (!src) return null;
  return {
    id: src.id,
    type: src.type, // "Film" | "Série"
    title: src.title,
    release_date: src.year || src.release_date || "",
    genres: src.genre || src.genres || "",
    overview: src.synopsis_long || src.synopsis || src.overview || "",
    synopsis_long: src.synopsis_long || "",
    synopsis_short: src.synopsis_short || "",
    director: src.director || "",
    actors: src.actors || "",
    poster: src.poster || "",
    number_of_episodes: src.number_of_episodes || 0
  };
}

// Merge qui évite d’écraser par des valeurs vides
function mergeNonEmpty(base, incoming) {
  const clean = Object.fromEntries(
    Object.entries(incoming || {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  return { ...base, ...clean };
}

// ======= LocalStorage helpers =======
function readList(key){ try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }
function writeList(key, arr){ try { localStorage.setItem(key, JSON.stringify(arr)); } catch {} }
function normKey(s){
  try {
    return (s || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  } catch {
    return (s || '').toString().toLowerCase().trim();
  }
}

// Construit un item watchlist depuis l'écran
function buildWatchlistItem(defaultState = "not_started") {
  const o = appState.oeuvre || {};
  const posterEl = document.getElementById('poster');
  const posterSrc = posterEl?.getAttribute('src') || o.poster || "";
  const isSerie = (o.type || "").toLowerCase().startsWith('s');
  return {
    id: o.id || undefined,
    title: o.title || "",
    image: posterSrc,
    poster: posterSrc, // compat
    type: isSerie ? 'serie' : 'film',
    year: o.release_date || "",
    genre: o.genres || "",
    synopsis: o.overview || "",
    synopsis_short: o.synopsis_short || "",
    director: o.director || "",
    actors: o.actors || "",
    state: defaultState // "not_started" | "done"
  };
}

// Upsert dans une liste (watchlist/wishlist) en forçant un state
function upsertWithState(listName, item, forcedState){
  const list = readList(listName);
  const byIdIndex = item.id ? list.findIndex(i => i.id === item.id) : -1;
  const titleIndex = byIdIndex === -1 ? list.findIndex(i => normKey(i.title) === normKey(item.title)) : -1;

  const base = { ...item, state: forcedState };
  if (byIdIndex >= 0) {
    list[byIdIndex] = { ...list[byIdIndex], ...base };
  } else if (titleIndex >= 0) {
    list[titleIndex] = { ...list[titleIndex], ...base };
  } else {
    list.push(base);
  }
  writeList(listName, list);
}

// ======= Persistance d'état (boutons + étoiles) =======
function stateStorageKey(){
  const o = appState.oeuvre || {};
  const type = (o.type || 'unknown').toLowerCase();
  return o.id ? `mediaState:${type}:${o.id}` : 'mediaState:global';
}

function loadUIState(){
  try {
    const raw = localStorage.getItem(stateStorageKey());
    if (!raw) return;
    const s = JSON.parse(raw);
    if (typeof s.isWatched !== 'undefined') isWatched = !!s.isWatched;
    if (typeof s.isWished  !== 'undefined') isWished  = !!s.isWished;
    if (typeof s.currentRating !== 'undefined') currentRating = Number(s.currentRating) || 0;
  } catch {}
}

function saveUIState(){
  try {
    const payload = { isWatched, isWished, currentRating };
    localStorage.setItem(stateStorageKey(), JSON.stringify(payload));
  } catch {}
}

// ----- Bootstrap -----
document.addEventListener('DOMContentLoaded', async function () {
  const qs = new URLSearchParams(document.location.search);
  const id = qs.get("id");

  // 1) Afficher immédiatement depuis sessionStorage
  let selected = null;
  try {
    const saved = sessionStorage.getItem('popflix:selected');
    if (saved) {
      const it = JSON.parse(saved);
      if (!id || it.id === id) selected = it;
    }
  } catch {}

  const frontOeuvre = mapToOeuvre(selected);
  if (frontOeuvre) {
    appState.oeuvre = frontOeuvre;
    renderOeuvre(appState.oeuvre);
    setPoster(appState.oeuvre.poster || "./data/images/placeholder_poster.png");
  } else {
    renderOeuvre({ type: "", title: "", release_date: "", genres: "", overview: "" });
    setPoster("./data/images/placeholder_poster.png");
  }

  // 2) Optionnel: API back (si dispo)
  let apiOeuvre = null;
  if (id) {
    const urlBack = "http://127.0.0.1:5000/get_event?id=" + encodeURIComponent(id);
    try {
      const r = await fetch(urlBack, { headers: { 'Content-Type': 'application/json' } });
      if (r.ok) {
        const json = await r.json();
        apiOeuvre = mapToOeuvre(json);
      }
    } catch (e) {
      console.warn("API non disponible ou bloquée:", e);
    }
  }

  // 3) Si l’API répond, on complète et on rerender
  if (apiOeuvre) {
    appState.oeuvre = mergeNonEmpty(appState.oeuvre || {}, apiOeuvre);
    renderOeuvre(appState.oeuvre);
    if (apiOeuvre.poster && apiOeuvre.poster !== "nan") setPoster(apiOeuvre.poster);
  }

  // 4) Améliorer l’affiche via TMDb (si placeholder)
  const posterEl = document.querySelector('#poster');
  if (!posterEl?.src || posterEl.src.endsWith("placeholder_poster.png")) {
    const tmdbUrl = await fetchTmdbPoster(appState.oeuvre || {});
    if (tmdbUrl) setPoster(tmdbUrl);
  }

  // Épisodes (si série)
  addEpisodes();

  // Charger état UI persistant
  loadUIState();
  switchButton(wishedBtn, wishedText, wishedState, isWished);
  switchButton(watchedBtn, watchedText, watchedState, isWatched);
  setRating(currentRating);
});

function addEpisodes() {
  const container = document.querySelector(".movie-container");
  if (!container || !appState.oeuvre) return;

  const isSerie = (appState.oeuvre.type || "").toLowerCase().startsWith("s");
  const nb = Number(appState.oeuvre.number_of_episodes) || 0;

  if (isSerie && nb > 0) {
    const episodesSection = document.createElement("div");
    episodesSection.classList.add("episodes-section");
    episodesSection.innerHTML = `
      <h2 class="full-row">Episodes visionnés</h2>
      ${Array.from({ length: nb }, (_, i) => `
        <button class="watched-episode-btn">
          <span class="watched-episode-text">Épisode ${i + 1}</span>
        </button>
      `).join("")}
    `;
    container.appendChild(episodesSection);

    const episodeButtons = episodesSection.querySelectorAll(".watched-episode-btn");
    appState.episodesWatched = Array(nb).fill(false);
    episodeButtons.forEach((btn, index) => {
      btn.addEventListener("click", () => {
        appState.episodesWatched[index] = !appState.episodesWatched[index];
        switchButton(
          btn,
          btn.querySelector(".watched-episode-text"),
          { false: `Épisode ${index + 1}`, true: `✔ Épisode ${index + 1} vu !` },
          appState.episodesWatched[index]
        );
        // si tous vus → isWatched = true
        const allWatched = appState.episodesWatched.every(Boolean);
        if (isWatched !== allWatched) {
          isWatched = allWatched;
          switchButton(watchedBtn, watchedText, watchedState, isWatched);
        }
      });
    });
  }
}

// ===============================
// Interactions UI (wishlist/watchlist + étoiles)
// ===============================
if (wishedBtn && wishedText) {
  wishedBtn.addEventListener("click", () => {
    isWished = !isWished;
    switchButton(wishedBtn, wishedText, wishedState, isWished);

    const item = buildWatchlistItem("not_started");
    upsertWithState("wishlist", item, "not_started");

    saveUIState();
  });
}

if (watchedBtn && watchedText) {
  watchedBtn.addEventListener("click", () => {
    isWatched = !isWatched;

    // synchroniser tous les épisodes avec l’état global
    appState.episodesWatched = appState.episodesWatched.map(() => isWatched);
    const episodeButtons = document.querySelectorAll(".watched-episode-btn");
    episodeButtons.forEach((btn, index) => {
      switchButton(
        btn,
        btn.querySelector(".watched-episode-text"),
        { false: `Épisode ${index + 1}`, true: `✔ Épisode ${index + 1} vu !` },
        appState.episodesWatched[index]
      );
    });

    switchButton(watchedBtn, watchedText, watchedState, isWatched);

    // mettre à jour les listes
    if (isWatched) {
      const item = buildWatchlistItem("done");
      upsertWithState("watchlist", item, "done");
      upsertWithState("wishlist",  item, "done");
      showNotification("Ajouté/mis à jour : watchlist (terminé).");
    } else {
      const item = buildWatchlistItem("not_started");
      upsertWithState("watchlist", item, "not_started");
      showNotification("Statut repassé à « pas commencé ».");
    }

    saveUIState();
  });
}

function switchButton(button, text, state, value) {
  if (!button || !text) return;
  if (value) {
    button.classList.add("active");
    text.textContent = state.true;
    text.style.background = "linear-gradient(135deg, #1e824c 0%, #2ecc71 100%)";
  } else {
    button.classList.remove("active");
    text.textContent = state.false;
    text.style.background = "linear-gradient(135deg, #47a7eb 0%, #3b8dc9 100%)";
  }
}

// Étoiles
stars.forEach((star, index) => {
  star.addEventListener('mouseenter', () => highlightStars(index + 1));
  star.addEventListener('click', () => {
    currentRating = index + 1;
    setRating(currentRating);
    saveRating(currentRating);
  });
});

const starsContainer = document.querySelector('.stars');
if (starsContainer) {
  starsContainer.addEventListener('mouseleave', () => setRating(currentRating));
}

function highlightStars(count) {
  stars.forEach((star, index) => {
    if (index < count) {
      star.style.color = '#e8f4fcff';
      star.style.textShadow = '0 0 20px rgba(71, 167, 235, 0.8)';
    } else {
      star.style.color = '#47a7eb';
      star.style.textShadow = '0 0 10px rgba(71, 167, 235, 0.4)';
    }
  });
}

function setRating(rating) {
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('filled');
      star.style.color = '#e8f4fc';
      star.style.textShadow = '0 0 20px rgba(71, 167, 235, 0.8)';
    } else {
      star.classList.remove('filled');
      star.style.color = '#47a7eb';
      star.style.textShadow = '0 0 10px rgba(71, 167, 235, 0.4)';
    }
  });
}

function saveRating(rating) {
  currentRating = Number(rating) || 0;
  saveUIState();
  showNotification(`Note enregistrée : ${currentRating}/5 étoiles`);
}

// Notifications
function showNotification(message) {
  const oldNotification = document.querySelector('.notification');
  if (oldNotification) oldNotification.remove();

  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    background: linear-gradient(135deg, #47a7eb 0%, #3b8dc9 100%);
    color: #ffffff; padding: 15px 25px; border-radius: 8px;
    box-shadow: 0 4px 20px rgba(71, 167, 235, 0.4);
    font-family: 'Roboto', sans-serif; font-size: 14px; font-weight: 500;
    z-index: 1000; animation: slideIn 0.3s ease, slideOut 0.3s ease 2.7s;
    border: 1px solid rgba(232, 244, 252, 0.2);
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
}

// Ajout style pour étoiles
const style = document.createElement('style');
style.textContent = `.star { cursor: pointer; user-select: none; transition: all 0.2s ease; }`;
document.head.appendChild(style);

// Retour watchlist (sécurisé)
const returnBtn = document.querySelector('.return-btn');
if (returnBtn) {
  returnBtn.addEventListener('click', function() {
    window.location.href = 'watchlist.html';
  });
}

// Effets visuels
const poster = document.querySelector('.poster-section img');
if (poster) {
  poster.addEventListener('click', function () {
    this.style.transform = 'scale(1.05)';
    setTimeout(() => { this.style.transform = 'scale(1)'; }, 200);
  });
}

const infoSection = document.querySelector('.info-section');
if (infoSection) {
  infoSection.style.opacity = '0';
  infoSection.style.transform = 'translateY(20px)';
  setTimeout(() => {
    infoSection.style.transition = 'all 0.6s ease';
    infoSection.style.opacity = '1';
    infoSection.style.transform = 'translateY(0)';
  }, 100);
}
