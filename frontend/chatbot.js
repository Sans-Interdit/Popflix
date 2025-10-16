// Récupération des éléments
const openBtn   = document.getElementById("chatbot-open-btn");
const chatbot   = document.getElementById("chatbot-container");
const toggleBtn = document.getElementById("chatbot-toggle");
const input     = document.getElementById("chatbot-input");
const messages  = document.getElementById("chatbot-messages");

// Affiche/masque le bouton d’ouverture selon l’état du panneau
function refreshOpenBtn() {
  if (!openBtn || !chatbot) return;
  openBtn.style.display = chatbot.classList.contains("chatbot-collapsed") ? "block" : "none";
}

// Clic sur le bouton “ouvrir” : toggle du panneau
if (openBtn && chatbot) {
  openBtn.addEventListener("click", () => {
    console.log(chatbot.classList.contains("chatbot-collapsed"));
    chatbot.classList.toggle("chatbot-collapsed");
    refreshOpenBtn();
  });
}

// Clic sur le bouton “réduire”
if (toggleBtn && chatbot) {
  toggleBtn.addEventListener("click", () => {
    chatbot.classList.add("chatbot-collapsed");
    refreshOpenBtn();
  });
}

// Envoi d’un message (Enter)
if (input && messages) {
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const text = input.value.trim();
    if (!text) return;

    // Message utilisateur
    const userMsg = document.createElement("div");
    userMsg.classList.add("message", "user");
    userMsg.textContent = input.value;
    messages.appendChild(userMsg);

    fetch("http://localhost:5000/chat", {
      headers: { 
        'Content-Type': 'application/json' 
      },
      method: "POST",
      body: JSON.stringify({
          message : input.value,
          mode : "detection"
      })
    })
    .then(res => {
        if (!res.ok) {
            return Promise.reject("Échec de la requête");
        } else {
            return res.json()
        }
    })
    .then(data => {
      console.log(data)
      if (data.response == "oui") {
        recommendationWay(input.value)
      }
      else {
        fetch("http://localhost:5000/chat", {
          headers: { 
              'Content-Type': 'application/json' 
            },
          method: "POST",
          body: JSON.stringify({
              message : input.value,
              mode : "casual"
          })
        })
        .then(res => {
            if (!res.ok) {
                return Promise.reject("Échec de la requête");
            } else {
                return res.json()
            }
        })
        .then(data => {
            console.log(data)
            const botMsg = document.createElement("div");
            botMsg.classList.add("message", "bot");
            botMsg.textContent = data.response;
            messages.appendChild(botMsg);
        });
      }
    });

    input.value = "";
    messages.scrollTop = messages.scrollHeight;
  })
};


function recommendationWay(input) {
  const watchlistStr = localStorage.getItem("watchlist");
  const watchlist = JSON.parse(watchlistStr);

  // Extraire uniquement les titres
  const titles = watchlist.map(item => item.title);


  // Exemple d’envoi via fetch :
  fetch("http://localhost:5000/recommend", {
    headers: { 
      'Content-Type': 'application/json' 
    },
    method: "POST",
    body: JSON.stringify({ list: titles })
  })
  .then(res => {
    if (!res.ok) throw new Error("Échec de la requête");
    return res.json();
  })
  .then(data => {
    fetch("http://localhost:5000/chat", {
      headers: { 
        'Content-Type': 'application/json' 
      },
      method: "POST",
      body: JSON.stringify({
        message : input,
        mode : "recommendation",
        result: data
      })
    })
    .then(res => {
      if (!res.ok) {
        return Promise.reject("Échec de la requête");
      } else {
        return res.json()
      }
    })
    .then(data => {
      const botMsg = document.createElement("div");
      botMsg.classList.add("message", "bot");
      botMsg.textContent = data.response;
      messages.appendChild(botMsg);
    });
  })
  .catch(err => console.error(err));
}

  // fetch("http://localhost:5000/recommend", {
  //   headers: { 
  //     'Content-Type': 'application/json' 
  //   },
  //   method: "POST",
  //   body: JSON.stringify({
  //     list : localStorage.getItem("watchlist"),
  //   })
  // })
  // .then(res => {
  //   if (!res.ok) {
  //     return Promise.reject("Échec de la requête");
  //   } else {
  //     return res.json()
  //   }
  // })
  // .then(data => {
  //   data
  //   fetch("http://localhost:5000/chat", {
  //     headers: { 
  //       'Content-Type': 'application/json' 
  //     },
  //     method: "POST",
  //     body: JSON.stringify({
  //       message : input.value,
  //       mode : "recommendation"
  //     })
  //   })
  //   .then(res => {
  //     if (!res.ok) {
  //       return Promise.reject("Échec de la requête");
  //     } else {
  //       return res.json()
  //     }
  //   })
  //   .then(data => {
  //     const botMsg = document.createElement("div");
  //     botMsg.classList.add("message", "bot");
  //     botMsg.textContent = data.response;
  //     messages.appendChild(botMsg);
  //   });
  // });