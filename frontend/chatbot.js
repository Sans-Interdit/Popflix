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
    userMsg.classList.add("message", "user");
    userMsg.textContent = input.value;
    messages.appendChild(userMsg);


    fetch("http://localhost:5000/chat", {
        headers: { 'Content-Type': 'application/json' },
        method: "POST",
        body: JSON.stringify({
            message : input.value
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

    input.value = "";
    messages.scrollTop = messages.scrollHeight;
  }
});
