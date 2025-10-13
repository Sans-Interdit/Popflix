// Gestion du système d'étoiles de notation
document.addEventListener('DOMContentLoaded', function() {
    const stars = document.querySelectorAll('.star');
    let currentRating = 0;
    const watchedBtn = document.querySelector(".watched-btn");
    const watchedText = watchedBtn.querySelector(".watched-text");
    const watchedCheck = watchedBtn.querySelector(".watched-check");

    let isWatched = false;

    watchedBtn.addEventListener("click", () => {
        isWatched = !isWatched;

        if (isWatched) {
        // Changement de style + animation
        watchedBtn.classList.add("active");
        watchedText.textContent = "VU";
        watchedText.style.background = "linear-gradient(135deg, #1e824c 0%, #2ecc71 100%)";
        } else {
        // Retour à l’état initial
        watchedBtn.classList.remove("active");
        watchedText.textContent = "NON VU";
        watchedText.style.background = "linear-gradient(135deg, #47a7eb 0%, #3b8dc9 100%)";
        }
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

    // Fonction pour illuminer les étoiles
    function highlightStars(count) {
        stars.forEach((star, index) => {
            if (index < count) {
                star.style.color = '#e8f4fc';
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

    console.log('Popflix chargé avec succès! 🎬');
});