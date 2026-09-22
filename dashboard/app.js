/* ============================================================
   EURINHASH COMMAND CENTER — app.js
   Rendu dynamique + polling des données EURINHASH réelles.
   Lit /api/state (workers, circuit, quota, budget, mode, audit).
   ============================================================ */

const POLL_MS = 5000;

// ─── Helpers ───────────────────────────────────────────────────

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function fmtTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function fmtTime(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

// ─── Status language (status-language.md) ──────────────────────
const STATUS_GLYPH = {
  ok: "●", active: "●", running: "▶", thinking: "◐", idle: "○",
  warning: "⚠", error: "✗", rate_limited: "⌛", unknown: "?",
  disconnected: "⊘", blocked: "✗", fail: "✗", success: "✓",
};

function statusClass(state) {
  switch (state) {
    case "ok": case "active": case "success": case "running": return "success";
    case "warning": case "rate_limited": case "thinking": return "warning";
    case "error": case "fail": case "blocked": case "disconnected": return "error";
    default: return "muted";
  }
}

function statusGlyph(state) {
  return STATUS_GLYPH[state] || "?";
}

// ─── Rendu Workers ─────────────────────────────────────────────

function renderWorkers(workers) {
  const grid = $("#worker-grid");
  if (!grid) return;
  const msg = $("#workers-msg");
  if (!workers || workers.length === 0) { msg.style.display = "none"; return; }

  msg.style.display = "flex";
  grid.innerHTML = workers.map((w) => `
    <div class="worker-card">
      <div class="worker-name">${w.name}</div>
      <div class="worker-model">${w.model || "—"}</div>
      <div class="worker-status">
        <span class="${statusClass(w.state)}">${statusGlyph(w.state)}</span>
        <span class="${statusClass(w.state)}">${(w.state || "unknown").toUpperCase()}</span>
      </div>
      <div class="worker-latency">${w.latency ? w.latency + "ms" : "latence N/A"}</div>
    </div>
  `).join("");
}

// ─── Rendu Activity (audit trail) ──────────────────────────────

const ACTIVITY_ICON = {
  file: "📄", read: "📖", search: "⌕", exec: "▶", mcp: "🔌",
  tool: "🔧", agent: "◈", system: "⚙", policy: "🛡", guard: "🛡",
  proof: "✓", risk: "⚠", classify: "🏷",
};

function renderActivity(entries) {
  const list = $("#activity-list");
  if (!list || !entries || entries.length === 0) return;

  const items = entries.slice(0, 6).map((e) => {
    const icon = ACTIVITY_ICON[e.category] || "◈";
    const title = e.title || e.event || "Event";
    const detail = e.detail || "";
    const time = e.time ? fmtTime(e.time) : "";
    return `
      <div class="activity-item">
        <span class="activity-icon">${icon}</span>
        <div class="activity-body">
          <div class="activity-title">${title}</div>
          <div class="activity-detail">${detail}</div>
        </div>
        <span class="activity-time">${time}</span>
      </div>
    `;
  }).join("");
  list.innerHTML = items;
}

// ─── Rendu Terminal (audit log) ────────────────────────────────

function renderTerminal(logs) {
  const body = $("#terminal-body");
  if (!body || !logs || logs.length === 0) return;

  const lines = logs.slice(0, 12).map((l) => {
    const level = (l.level || "info").toUpperCase();
    const cls = level === "SUCCESS" ? "term-success"
      : level === "ERROR" ? "term-error"
      : level === "WARN" ? "term-warning"
      : "term-info";
    return `<div class="term-line"><span class="${cls}">[${level}]</span> <span class="term-muted">${l.message || ""}</span></div>`;
  }).join("");

  body.innerHTML = lines + body.innerHTML;
}

// ─── Rendu Status Bar ──────────────────────────────────────────

function renderStatusBar(state) {
  const modeBadge = $("#mode-badge");
  if (modeBadge) {
    const mode = state.mode || "free";
    modeBadge.textContent = mode.toUpperCase();
    modeBadge.className = mode === "pro" ? "mode-pro" : "mode-free";
  }

  const repos = $("#repos-connected");
  if (repos) repos.textContent = `${state.reposConnected ?? 3} repos connected`;

  const clock = $("#clock");
  if (clock) {
    const d = new Date();
    clock.textContent = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  const date = $("#date");
  if (date) {
    const d = new Date();
    const months = ["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
    date.textContent = `${String(d.getDate()).padStart(2,"0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}

// ─── Rendu Agent Status ────────────────────────────────────────

function renderAgentStatus(state) {
  const capsule = $(".status-capsule");
  if (!capsule || !state.agent) return;
  const a = state.agent;
  capsule.className = "status-capsule " + (a.status || "running");
  capsule.textContent = (a.status === "running" ? "▶ " : a.status === "thinking" ? "◐ " : "● ") + (a.status || "Running");
}

// ─── Polling principal ─────────────────────────────────────────

async function poll() {
  try {
    const res = await fetch("/api/state");
    if (!res.ok) throw new Error("API " + res.status);
    const state = await res.json();

    renderWorkers(state.workers);
    renderActivity(state.activity);
    renderTerminal(state.logs);
    renderStatusBar(state);
    renderAgentStatus(state);
  } catch (err) {
    console.warn("[CommandCenter] poll failed:", err.message);
  }
}

// ─── Init ──────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  poll();
  setInterval(poll, POLL_MS);
});