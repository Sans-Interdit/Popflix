const openBtn = document.getElementById("chatbot-open-btn");
const chatbot = document.getElementById("chatbot-container");
const toggleBtn = document.getElementById("chatbot-toggle");
const input = document.getElementById("chatbot-input");
const messages = document.getElementById("chatbot-messages");

openBtn.addEventListener("click", () => {
  console.log(chatbot.classList.contains("chatbot-collapsed") )
  chatbot.classList.toggle("chatbot-collapsed");
  openBtn.style.display = chatbot.classList.contains("chatbot-collapsed") ? "block" : "none";
});

toggleBtn.addEventListener("click", () => {
  chatbot.classList.add("chatbot-collapsed");
  openBtn.style.display = "block";
});

// Simulation de réponse basique
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && input.value.trim() !== "") {
    const userMsg = document.createElement("div");
    userMsg.classList.add("user");
    userMsg.textContent = "🧑 " + input.value;
    messages.appendChild(userMsg);


    userMsg.classList.toggle(".bot")
    const botMsg = document.createElement("div");
    botMsg.textContent = "🤖 " + "Je suis un chatbot démo.";
    setTimeout(() => messages.appendChild(botMsg), 500);

    input.value = "";
    messages.scrollTop = messages.scrollHeight;
  }
});
const openBtn = document.getElementById("chatbot-open-btn");
const chatbot = document.getElementById("chatbot-container");
const toggleBtn = document.getElementById("chatbot-toggle");
const input = document.getElementById("chatbot-input");
const messages = document.getElementById("chatbot-messages");

openBtn.addEventListener("click", () => {
  console.log(chatbot.classList.contains("chatbot-collapsed") )
  chatbot.classList.toggle("chatbot-collapsed");
  openBtn.style.display = chatbot.classList.contains("chatbot-collapsed") ? "block" : "none";
});

toggleBtn.addEventListener("click", () => {
  chatbot.classList.add("chatbot-collapsed");
  openBtn.style.display = "block";
});

// Simulation de réponse basique
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && input.value.trim() !== "") {
    const userMsg = document.createElement("div");
    userMsg.classList.add("user");
    userMsg.textContent = "🧑 " + input.value;
    messages.appendChild(userMsg);


    userMsg.classList.toggle(".bot")
    const botMsg = document.createElement("div");
    botMsg.textContent = "🤖 " + "Je suis un chatbot démo.";
    setTimeout(() => messages.appendChild(botMsg), 500);

    input.value = "";
    messages.scrollTop = messages.scrollHeight;
  }
});
