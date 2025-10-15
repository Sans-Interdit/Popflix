// ===============================
// POPFLIX — carte.js (corrigé + enrichi)
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

const wishedState = { false: "Ajouter à la wishlist", true: "☑ Dans votre wishlist" };
const watchedState = { false: "J'ai vu cette œuvre",   true: "☑ Œuvre regardée !" };

const appState = {
  oeuvre: null,
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
  // Overview = synopsis long prioritaire / fallback synopsis / overview API
  setText('[data-field="overview"]',     o.overview || o.synopsis_long || o.synopsis || "");
  // Nouveaux champs
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
    // accepte clés côté front (items) ET côté API
    id: src.id,
    type: src.type, // "Film" | "Série"
    title: src.title,
    release_date: src.year || src.release_date || "",
    genres: src.genre || src.genres || "",
    // Priorité aux contenus enrichis
    overview: src.synopsis_long || src.synopsis || src.overview || "",
    synopsis_long: src.synopsis_long || "",
    synopsis_short: src.synopsis_short || "",
    director: src.director || "",
    actors: src.actors || "",
    poster: src.poster || ""
  };
}

document.addEventListener('DOMContentLoaded', async function () {
  const qs = new URLSearchParams(document.location.search);
  const id = qs.get("id");

  // 1) Afficher immédiatement depuis sessionStorage (garanti par le clic)
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
    // Vide si rien en sessionStorage (évite des valeurs codées en dur)
    renderOeuvre({ type: "", title: "", release_date: "", genres: "", overview: "" });
    setPoster("./data/images/placeholder_poster.png");
  }

  // 2) Essayer de récupérer les données “officielles” via l’API (si id présent)
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
      // API non dispo / CORS / mixed content, on reste sur frontOeuvre
      console.warn("API non disponible ou bloquée:", e);
    }
  }

  // 3) Si l’API répond, on écrase/complète et on rerender
  if (apiOeuvre) {
    appState.oeuvre = { ...appState.oeuvre, ...apiOeuvre };
    renderOeuvre(appState.oeuvre);
    if (apiOeuvre.poster) setPoster(apiOeuvre.poster);
  }

  // 4) Améliorer l’affiche via TMDb (si pas d’affiche déjà fiable)
  const posterEl = document.querySelector('#poster');
  if (!posterEl?.src || posterEl.src.endsWith("placeholder_poster.png")) {
    const tmdbUrl = await fetchTmdbPoster(appState.oeuvre || {});
    if (tmdbUrl) setPoster(tmdbUrl);
  }
});

// ===============================
// Interactions UI (wishlist/watchlist + étoiles)
// ===============================
if (wishedBtn && wishedText) {
  wishedBtn.addEventListener("click", () => {
    isWished = !isWished;
    switchButton(wishedBtn, wishedText, wishedState, isWished);
  });
}

if (watchedBtn && watchedText) {
  watchedBtn.addEventListener("click", () => {
    isWatched = !isWatched;
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
  console.log('Note enregistrée:', rating + '/5');
  showNotification(`Note enregistrée : ${rating}/5 étoiles`);
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
style.textContent = `
  .star { cursor: pointer; user-select: none; transition: all 0.2s ease; }
`;
document.head.appendChild(style);

// Retour watchlist
const returnBtn = document.querySelector('.return-btn');
if (returnBtn) {
  returnBtn.addEventListener('click', function () {
    showNotification('Retour à la watchlist...');
    window.location.href = './watchlist.html';
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
