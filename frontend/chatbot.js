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
    userMsg.classList.add("user");
    userMsg.textContent = "🧑 " + text;
    messages.appendChild(userMsg);

    // Message bot (démo)
    const botMsg = document.createElement("div");
    botMsg.classList.add("bot");
    botMsg.textContent = "🤖 " + "Je suis un chatbot démo.";
    setTimeout(() => messages.appendChild(botMsg), 500);

    input.value = "";
    messages.scrollTop = messages.scrollHeight;
  });
}

// État initial du bouton
refreshOpenBtn();
