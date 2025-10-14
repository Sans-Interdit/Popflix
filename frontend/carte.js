const stars = document.querySelectorAll('.star');
let currentRating = 0;

const wishedBtn = document.querySelector(".wished-btn");
const wishedText = wishedBtn.querySelector(".wished-text");
let isWished = false;

const watchedBtn = document.querySelector(".watched-btn");
const watchedText = watchedBtn.querySelector(".watched-text");
let isWatched = false;

const wishedState = {
  false: "Ajouter à la wishlist",
  true: "☑ Dans votre wishlist"
};

const watchedState = {
  false: "J'ai vu cette œuvre",
  true: "☑ Œuvre regardée !"
};



document.addEventListener('DOMContentLoaded', async function() {
    const oeuvre = {
        type: "Série",
        title: "Game of Thrones",
        number_of_episodes: 73,
        release_date : "2011-04-17",
        overview : "Des maisons nobles se disputent le pouvoir, tandis qu’une menace surgit au nord.",
        poster_path : "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
        genres : "Sci-Fi & Fantasy, Drama, Action & Adventure",
        type : "Série"
    };

    // const oeuvre = {
    //     title : "Inception",
    //     release_date : "2010-07-15",
    //     overview : "Cobb, un voleur qualifié qui commet un espionnage d'entreprise en infiltrant le subconscient de ses cibles se fait la possibilité de retrouver son ancienne vie de paiement d'une tâche considérée comme impossible: 'Inception', l'implantation de l'idée d'une autre personne dans le subconscient d'une cible.",
    //     poster_path : "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    //     genres : "Action, Science Fiction, Adventure",
    //     type : "Film",
    // }

    const container = document.querySelector(".movie-container");
    
    const info_values = document.querySelectorAll(".info-value");
    for (let info_value of info_values) {
        const field = info_value.dataset.field;
        info_value.textContent = oeuvre[field];
    }

    if (oeuvre["type"] == "Série" && oeuvre["number_of_episodes"] > 0) {
        const episodesSection = document.createElement("div");
        episodesSection.classList.add("episodes-section");
        episodesSection.innerHTML = `
            <h2 class="full-row">Episodes visionnés</h2>
            ${Array.from({ length: oeuvre.number_of_episodes }, (_, i) => `
                <button class="watched-episode-btn">
                    <span class="watched-episode-text">Épisode ${i + 1}</span>
                </button>
            `).join("")}
        `;
        container.appendChild(episodesSection);

        const episodeButtons = episodesSection.querySelectorAll(".watched-episode-btn");
        episodeButtons.forEach((btn, index) => {
            let isWatched = false;

            btn.addEventListener("click", () => {
                isWatched = !isWatched;
                switchButton(
                    btn,
                    btn.querySelector(".watched-episode-text"),
                    {
                        false: `Épisode ${index + 1}`,
                        true: `☑ Épisode ${index + 1} vu !`
                    },
                    isWatched
                );
            });
        });
    }
})

wishedBtn.addEventListener("click", () => {
    isWished = !isWished;
    switchButton(wishedBtn, wishedText, wishedState, isWished);
});

watchedBtn.addEventListener("click", () => {
    isWatched = !isWatched;
    switchButton(watchedBtn, watchedText, watchedState, isWatched);
});

// Système de notation par étoiles
stars.forEach((star, index) => {
    // Survol des étoiles
    star.addEventListener('mouseenter', function() {
        highlightStars(index + 1);
    });

    // Clic sur une étoile
    star.addEventListener('click', function() {
        currentRating = index + 1;
        setRating(currentRating);
        saveRating(currentRating);
    });
});

// Container des étoiles - réinitialiser au survol
const starsContainer = document.querySelector('.stars');
starsContainer.addEventListener('mouseleave', function() {
    setRating(currentRating);
});


function switchButton(button, text, state, value) {
    if (value) {
        // Changement de style + animation
        button.classList.add("active");
        text.textContent = state.true;
        text.style.background = "linear-gradient(135deg, #1e824c 0%, #2ecc71 100%)";
    } else {
        // Retour à l’état initial
        button.classList.remove("active");
        text.textContent = state.false;
        text.style.background = "linear-gradient(135deg, #47a7eb 0%, #3b8dc9 100%)";
    }
}

// Fonction pour illuminer les étoiles
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

// Fonction pour définir la notation
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

// Sauvegarder la notation (simulation - peut être connecté à une API)
function saveRating(rating) {
    console.log('Note enregistrée:', rating + '/5');
    showNotification(`Note enregistrée : ${rating}/5 étoiles`);
}

// Système de notification
function showNotification(message) {
    // Supprimer les anciennes notifications
    const oldNotification = document.querySelector('.notification');
    if (oldNotification) {
        oldNotification.remove();
    }

    // Créer une nouvelle notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #47a7eb 0%, #3b8dc9 100%);
        color: #ffffff;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(71, 167, 235, 0.4);
        font-family: 'Roboto', sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        animation: slideIn 0.3s ease, slideOut 0.3s ease 2.7s;
        border: 1px solid rgba(232, 244, 252, 0.2);
    `;

    document.body.appendChild(notification);

    // Supprimer la notification après 3 secondes
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Ajouter les animations CSS
const style = document.createElement('style');
style.textContent = `
    .star {
        cursor: pointer;
        user-select: none;
        transition: all 0.2s ease;
    }
`;
document.head.appendChild(style);

// Bouton retour
const returnBtn = document.querySelector('.return-btn');
returnBtn.addEventListener('click', function() {
    // Simulation de retour à la watchlist
    showNotification('Retour à la watchlist...');
    console.log('Redirection vers la watchlist');
    // window.location.href = 'watchlist.html'; // Décommenter pour vraie navigation
});

// Animation au clic sur l'affiche
const poster = document.querySelector('.poster-section img');
if (poster) {
    poster.addEventListener('click', function() {
        this.style.transform = 'scale(1.05)';
        setTimeout(() => {
            this.style.transform = 'scale(1)';
        }, 200);
    });
}

// Animation d'apparition au chargement
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