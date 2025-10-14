// ------- Données de test (12 éléments : 8 films, 4 séries) -------
const items = [
  // SÉRIES (4)
  { id: "s1", title: "Friends", poster : "../data/images/friends.webp", year: 1994, type: "Série", genre: "Comédie", synopsis: "Six amis partagent leur quotidien à New York entre amour, travail et rires." },
  { id: "s2", title: "Breaking Bad", poster : "../data/images/breaking_bad.webp",year: 2008, type: "Série", genre: "Crime", synopsis: "Un prof de chimie devient fabricant de méthamphétamine." },
  { id: "s3", title: "Severance", year: 2022, type: "Série", genre: "Thriller", synopsis: "Des employés voient leur vie professionnelle séparée de leur vie personnelle." },
  { id: "s4", title: "Dark", year: 2017, type: "Série", genre: "Mystère", synopsis: "Une disparition d’enfant révèle un réseau de mystères temporels." },

  // FILMS (8)
  { id: "f1", title: "Inception", poster : "../data/images/inception.jpg",year: 2010, type: "Film", genre: "Science-fiction", synopsis: "Des voleurs pénètrent les rêves pour implanter des idées." },
  { id: "f2", title: "The Dark Knight", year: 2008, type: "Film", genre: "Action", synopsis: "Batman affronte le Joker dans une lutte pour l’âme de Gotham." },
  { id: "f3", title: "Seven", year: 1995, type: "Film", genre: "Thriller", synopsis: "Deux détectives traquent un tueur en série inspiré des sept péchés capitaux." },
  { id: "f4", title: "The Grand Budapest Hotel", year: 2014, type: "Film", genre: "Comédie", synopsis: "Un concierge légendaire et son protégé se retrouvent au cœur d’une intrigue rocambolesque." },
  { id: "f5", title: "La La Land", year: 2016, type: "Film", genre: "Romance", synopsis: "Un pianiste de jazz et une actrice tombent amoureux à Los Angeles." },
  { id: "f6", title: "Mad Max: Fury Road", year: 2015, type: "Film", genre: "Action", synopsis: "Dans un désert post-apocalyptique, des survivants fuient un tyran motorisé." },
  { id: "f7", title: "Dune", year: 2021, type: "Film", genre: "Science-fiction", synopsis: "Un jeune noble découvre son destin sur la planète désertique Arrakis." },
  { id: "f8", title: "Whiplash", year: 2014, type: "Film", genre: "Drame", synopsis: "Un jeune batteur affronte la brutalité d’un professeur tyrannique." },
];


function toCardHTML(item) {
  return `
    <article class="carte">
      <div class="card" data-id="${item.id}">
        <div class="poster">
          <img
            class="poster-img"
            src="${item.poster}">
        </div>

        <div class="card-body">
            <div class="container">
                <span class="type">${item.type}</span></div>
          <h3>${item.title}</h3>
          <ul class="meta">
            <li>${item.year}</li>
            <li>${item.genre}</li>
          </ul>
          <div class="synopsis-label">Un bref synopsis :</div>
          <div class="synopsis">${item.synopsis}</div>
        </div>
      </div>
      <button class="btn">Ajouter à ma wishlist</button>
    </article>
  `;
}


function renderCards() {
  const container = document.getElementById("cards");
  if (!container) return;
  container.innerHTML = items
    .slice(0, 12) 
    .map(toCardHTML)
    .join("");
}

document.addEventListener("DOMContentLoaded", renderCards);
