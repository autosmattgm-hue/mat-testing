import { apiFetch, isProUser } from "./api.js";

let busy = false;

function createPanel() {
  if (document.getElementById("quickAiPanel")) return document.getElementById("quickAiPanel");
  const panel = document.createElement("section");
  panel.id = "quickAiPanel";
  panel.className = "quick-ai-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", "quickAiTitle");
  panel.innerHTML = `
    <header class="quick-ai-header">
      <div><span class="quick-ai-kicker">MAT LEADS AI</span><h2 id="quickAiTitle">Ask your agent</h2><p>Account-aware guidance, right where you work.</p></div>
      <button type="button" class="icon-button" data-ai-quick-close aria-label="Close AI Agent">x</button>
    </header>
    <div class="quick-ai-messages" data-ai-quick-messages aria-live="polite">
      <div class="quick-ai-welcome"><strong>What should we work on?</strong><span>Ask about your saved leads, follow-ups, conversion rate, or next best action.</span></div>
    </div>
    <div class="quick-ai-prompts"><button type="button" data-ai-prompt="Which lead should I contact first?">Contact priority</button><button type="button" data-ai-prompt="What are my most important actions today?">Today's actions</button></div>
    <form class="quick-ai-form" data-ai-quick-form><textarea data-ai-quick-input rows="1" placeholder="Ask the AI Agent..." required></textarea><button class="quick-ai-send" type="submit" aria-label="Send message">→</button></form>
    <footer><a href="/ai-agent.html">Open full AI Agent</a><span>AI never sends messages or changes records automatically.</span></footer>
  `;
  document.body.append(panel);
  return panel;
}

function appendMessage(panel, text, role) {
  const message = document.createElement("div");
  message.className = `quick-ai-message quick-ai-message--${role}`;
  message.textContent = text;
  panel.querySelector("[data-ai-quick-messages]").append(message);
  const list = panel.querySelector("[data-ai-quick-messages]");
  list.scrollTop = list.scrollHeight;
  return message;
}

function setOpen(panel, open) {
  panel.hidden = !open;
  document.querySelectorAll("[data-ai-quick-toggle]").forEach((button) => button.setAttribute("aria-expanded", String(open)));
  document.body.classList.toggle("quick-ai-open", open);
  if (open) panel.querySelector("[data-ai-quick-input]")?.focus();
}

async function sendMessage(panel, text) {
  if (busy || !text) return;
  const input = panel.querySelector("[data-ai-quick-input]");
  const send = panel.querySelector(".quick-ai-send");
  busy = true;
  if (input) input.disabled = true;
  if (send) send.disabled = true;
  panel.querySelector(".quick-ai-welcome")?.remove();
  appendMessage(panel, text, "user");
  const pending = appendMessage(panel, "Analysing your account...", "pending");
  try {
    const session = await apiFetch("/api/auth/me");
    const user = session?.user || {};
    if (!isProUser(user)) throw new Error("AI Agent is available on Pro or Admin plans. Open the full Agent page to upgrade.");
    const status = await apiFetch("/api/ai/status");
    if (!status.configured) throw new Error(status.hint || "AI is not configured on this deployment.");
    const result = await apiFetch("/api/ai/agent", { method: "POST", body: JSON.stringify({ prompt: text }) });
    pending.remove();
    appendMessage(panel, String(result.content || "The agent returned no response. Please try again."), "agent");
  } catch (error) {
    pending.remove();
    appendMessage(panel, String(error?.message || "The agent could not respond. Please try again."), "error");
  } finally {
    busy = false;
    if (input) { input.disabled = false; input.focus(); }
    if (send) send.disabled = false;
  }
}

function init() {
  const panel = createPanel();
  let launcher = document.querySelector("[data-ai-quick-toggle]");
  if (!launcher) {
    launcher = document.createElement("button");
    launcher.className = "ai-quick-launcher";
    launcher.type = "button";
    launcher.dataset.aiQuickToggle = "";
    launcher.setAttribute("aria-controls", "quickAiPanel");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-label", "Open AI Agent");
    launcher.title = "Ask AI Agent";
    launcher.innerHTML = "<span aria-hidden=\"true\">AI</span>";
    document.body.append(launcher);
  }
  document.querySelectorAll("[data-ai-quick-toggle]").forEach((button) => button.addEventListener("click", () => setOpen(panel, !panel.hidden)));
  panel.querySelector("[data-ai-quick-close]")?.addEventListener("click", () => setOpen(panel, false));
  panel.querySelectorAll("[data-ai-prompt]").forEach((button) => button.addEventListener("click", () => sendMessage(panel, button.dataset.aiPrompt || "")));
  panel.querySelector("[data-ai-quick-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = panel.querySelector("[data-ai-quick-input]");
    const text = input?.value.trim();
    if (!text) return;
    input.value = "";
    sendMessage(panel, text);
  });
  panel.querySelector("[data-ai-quick-input]")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      panel.querySelector("[data-ai-quick-form]")?.requestSubmit();
    }
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) setOpen(panel, false); });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
