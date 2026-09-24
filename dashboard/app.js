/* ============================================================
   EURINHASH COMMAND CENTER — app.js
   Vrai poste de pilotage : chat → orchestrateur, git réel,
   file tree réel, terminal sécurisé, ressources système réelles.
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

function fmtBytes(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + " GB";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + " MB";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + " KB";
  return String(n) + " B";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
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

function statusGlyph(state) { return STATUS_GLYPH[state] || "?"; }

// ─── Rendu Workers ─────────────────────────────────────────────

function renderWorkers(workers) {
  const grid = $("#worker-grid");
  if (!grid) return;
  const msg = $("#workers-msg");
  if (!workers || workers.length === 0) { msg.style.display = "none"; return; }

  msg.style.display = "flex";
  grid.innerHTML = workers.map((w) => `
    <div class="worker-card">
      <div class="worker-name">${esc(w.name)}</div>
      <div class="worker-model">${esc(w.model || "—")}</div>
      <div class="worker-status">
        <span class="${statusClass(w.state)}">${statusGlyph(w.state)}</span>
        <span class="${statusClass(w.state)}">${esc((w.state || "unknown").toUpperCase())}</span>
      </div>
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
  list.innerHTML = entries.slice(0, 6).map((e) => {
    const icon = ACTIVITY_ICON[e.category] || "◈";
    return `
      <div class="activity-item">
        <span class="activity-icon">${icon}</span>
        <div class="activity-body">
          <div class="activity-title">${esc(e.title || e.event || "Event")}</div>
          <div class="activity-detail">${esc(e.detail || "")}</div>
        </div>
        <span class="activity-time">${e.time ? fmtTime(e.time) : ""}</span>
      </div>
    `;
  }).join("");
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
    return `<div class="term-line"><span class="${cls}">[${level}]</span> <span class="term-muted">${esc(l.message || "")}</span></div>`;
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
  // Workspace actif
  const ws = $("#workspace-name");
  if (ws && state.workspace) {
    const parts = state.workspace.replace(/\\/g, "/").split("/");
    ws.innerHTML = `${esc(parts[parts.length - 1] || state.workspace)} <span class="dim">˅</span>`;
    currentPrompt = `PS ${state.workspace}>`;
    const termPrompt = $(".terminal-input-row .term-prompt");
    if (termPrompt) termPrompt.textContent = currentPrompt;
  }
}

// ─── Rendu Git réel ────────────────────────────────────────────

function renderGit(git) {
  if (!git) return;
  const branchEl = $(".git-branch-row");
  if (branchEl) {
    branchEl.innerHTML = `
      <span class="branch-dot">●</span>
      <span>${esc(git.branch)}</span>
      <span class="sync">↑${git.ahead} ↓${git.behind}</span>
    `;
  }
  const stats = $(".git-stats");
  if (stats) {
    stats.innerHTML = `
      <span class="git-stat modified">● ${git.modified.length} modified</span>
      <span class="git-stat untracked">● ${git.untracked.length} untracked</span>
      <span class="git-stat staged">● ${git.staged.length} staged</span>
    `;
  }
  const lastCommit = $(".git-last-commit");
  if (lastCommit) lastCommit.textContent = git.lastCommit || "";
}

// ─── Rendu File Tree réel ──────────────────────────────────────

function renderFileTree(nodes, container, depth = 0) {
  if (!container) return;
  container.innerHTML = nodes.map((n) => {
    const indent = "padding-left:" + (depth * 14 + 8) + "px";
    if (n.type === "dir") {
      const children = n.children && n.children.length > 0
        ? `<ul class="file-tree" style="display:none">${renderFileTreeInner(n.children, depth + 1)}</ul>`
        : "";
      return `
        <li class="tree-dir" data-path="${esc(n.path)}" style="${indent}">
          <span class="chevron">▸</span><span class="tree-icon">📁</span> ${esc(n.name)}
        </li>
        ${children}
      `;
    }
    return `
      <li class="tree-file" data-path="${esc(n.path)}" style="${indent}">
        <span class="tree-icon">📄</span> ${esc(n.name)}
      </li>
    `;
  }).join("");
}

function renderFileTreeInner(nodes, depth) {
  return nodes.map((n) => {
    const indent = "padding-left:" + (depth * 14 + 8) + "px";
    if (n.type === "dir") {
      const children = n.children && n.children.length > 0
        ? `<ul class="file-tree" style="display:none">${renderFileTreeInner(n.children, depth + 1)}</ul>`
        : "";
      return `
        <li class="tree-dir" data-path="${esc(n.path)}" style="${indent}">
          <span class="chevron">▸</span><span class="tree-icon">📁</span> ${esc(n.name)}
        </li>
        ${children}
      `;
    }
    return `
      <li class="tree-file" data-path="${esc(n.path)}" style="${indent}">
        <span class="tree-icon">📄</span> ${esc(n.name)}
      </li>
    `;
  }).join("");
}

// ─── Rendu System réel ─────────────────────────────────────────

function renderSystem(sys) {
  if (!sys) return;
  const el = $("#system-resources");
  if (!el) return;
  const memPct = Math.min(100, Math.round((sys.memory.used / sys.memory.total) * 100));
  el.innerHTML = `
    <div class="resource-row">
      <span class="resource-label">CPU</span>
      <div class="resource-track"><div class="resource-fill" style="width:${sys.cpu}%;background:var(--accent)"></div></div>
      <span class="resource-value">${sys.cpu}%</span>
    </div>
    <div class="resource-row">
      <span class="resource-label">Memory</span>
      <div class="resource-track"><div class="resource-fill" style="width:${memPct}%;background:var(--blue)"></div></div>
      <span class="resource-value">${fmtBytes(sys.memory.used)} / ${fmtBytes(sys.memory.total)}</span>
    </div>
    <div class="resource-row">
      <span class="resource-label">Node</span>
      <div class="resource-track"><div class="resource-fill" style="width:0%;background:#A78BFA"></div></div>
      <span class="resource-value">${esc(sys.node)}</span>
    </div>
    <div class="resource-row">
      <span class="resource-label">Uptime</span>
      <div class="resource-track"><div class="resource-fill" style="width:0%;background:var(--warning)"></div></div>
      <span class="resource-value">${Math.round(sys.uptime / 60)} min</span>
    </div>
  `;
}

// ─── Chat → Orchestrateur ──────────────────────────────────────

function addChatMessage(role, html, meta) {
  const chat = $("#chat");
  if (!chat) return;
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.innerHTML = `
    <div class="msg-meta">${meta || (role === "user" ? "You" : "EurinHash Agent")}</div>
    <div class="msg-bubble">${html}</div>
  `;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function renderGovernanceResult(result, elapsedMs, execution) {
  const r = result;
  const verdictColor = r.verdict === "APPROVED" ? "success" : r.verdict === "BLOCKED" ? "error" : "warning";
  const guardColor = r.guardDecision === "ALLOWED" ? "success" : r.guardDecision === "WARN" ? "warning" : "error";
  const proofColor = r.proofStatus === "PASS" ? "success" : r.proofStatus === "PENDING" ? "warning" : "error";

  let execHtml = "";
  if (execution) {
    if (execution.success) {
      execHtml = `
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
          <div><span class="success">✓ Exécuté par ${esc(execution.provider)}</span></div>
          <div class="term-muted" style="margin-top:6px;font-family:var(--font-mono);font-size:11px;white-space:pre-wrap">${esc(execution.output || "")}</div>
        </div>`;
    } else {
      execHtml = `
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
          <div><span class="error">✗ Exécution échouée</span> <span class="dim">${esc(execution.error || "")}</span></div>
        </div>`;
    }
  }

  return `
    <div class="agent-badges">
      <span class="agent-badge">Classified ${esc(r.taskType)}</span>
      <span class="agent-badge">Risk ${esc(r.riskLevel)}</span>
      <span class="agent-badge">Guard ${esc(r.guardDecision)}</span>
      <span class="agent-badge">Proof ${esc(r.proofStatus)}</span>
    </div>
    <div style="margin-top:8px;font-family:var(--font-mono);font-size:12px">
      <div><span class="muted">Verdict:</span> <span class="${verdictColor}" style="font-weight:700">${esc(r.verdict)}</span> <span class="dim">(${elapsedMs}ms)</span></div>
      <div><span class="muted">Policy:</span> <span class="blue">${esc(r.policyDecision?.policy?.name || "—")}</span></div>
      <div><span class="muted">Guard:</span> <span class="${guardColor}">${esc(r.guardDecision)}</span> <span class="dim">${esc(r.policyDecision?.reason || "")}</span></div>
      <div><span class="muted">Proofs:</span> <span class="${proofColor}">${esc(r.proofStatus)}</span></div>
      ${r.policyDecision?.humanApproval ? '<div><span class="warning">⚠ Human approval required</span></div>' : ""}
    </div>
    ${execHtml}
  `;
}

async function sendChat() {
  const input = $(".chat-input input");
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;

  input.value = "";
  addChatMessage("user", esc(message), "You · " + fmtTime(Date.now()));

  // Message "thinking" temporaire
  const chat = $("#chat");
  const thinking = document.createElement("div");
  thinking.className = "msg agent";
  thinking.innerHTML = `<div class="msg-meta">EurinHash Agent · <span class="dim">exécution...</span></div>
    <div class="msg-bubble"><span class="info">◐</span> <span class="muted">Analyse via GovernanceOrchestrator...</span></div>`;
  chat.appendChild(thinking);
  chat.scrollTop = chat.scrollHeight;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    thinking.remove();

    if (data.error) {
      addChatMessage("agent", `<span class="error">✗ ${esc(data.error)}</span>`, "EurinHash Agent · erreur");
      return;
    }
    addChatMessage("agent", renderGovernanceResult(data.result, data.elapsedMs, data.execution),
      "EurinHash Agent · " + fmtTime(Date.now()));
  } catch (err) {
    thinking.remove();
    addChatMessage("agent", `<span class="error">✗ ${esc(err.message)}</span>`, "EurinHash Agent · erreur");
  }
}

// ─── Terminal réel ─────────────────────────────────────────────

async function sendTerminal() {
  const input = $(".terminal-input");
  if (!input) return;
  const command = input.value.trim();
  if (!command) return;

  const body = $("#terminal-body");
  const prompt = currentPrompt;
  input.value = "";
  body.innerHTML += `<div class="term-line"><span class="term-prompt">${esc(prompt)}</span> <span class="term-cmd">${esc(command)}</span></div>`;

  try {
    const res = await fetch("/api/terminal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    const data = await res.json();
    if (data.blocked) {
      body.innerHTML += `<div class="term-line"><span class="term-error">[BLOCKED]</span> <span class="term-muted">${esc(data.reason)}</span></div>`;
    } else if (data.ok) {
      body.innerHTML += `<div class="term-line"><span class="term-muted">${esc(data.output)}</span></div>`;
    } else {
      body.innerHTML += `<div class="term-line"><span class="term-error">${esc(data.output || data.error || "erreur")}</span></div>`;
    }
  } catch (err) {
    body.innerHTML += `<div class="term-line"><span class="term-error">${esc(err.message)}</span></div>`;
  }
  body.scrollTop = body.scrollHeight;
}

// ─── Git commit réel ───────────────────────────────────────────

async function commitChanges() {
  const btn = $(".commit-btn");
  if (!btn) return;
  const message = prompt("Message de commit:");
  if (!message) return;

  btn.textContent = "Committing...";
  try {
    const res = await fetch("/api/git", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "commit", message }),
    });
    const data = await res.json();
    alert(data.ok ? "✓ " + data.output : "✗ " + (data.output || data.error));
  } catch (err) {
    alert("✗ " + err.message);
  }
  btn.textContent = "Commit changes...";
  poll();
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
    renderGit(state.git);
    renderFileTree(state.files, $("#file-tree"));
    renderSystem(state.system);
    try {
      const sres = await fetch("/api/stats");
      if (sres.ok) renderImpact(await sres.json());
    } catch (err) {
      console.warn("[CommandCenter] stats failed:", err.message);
    }
    try {
      const vres = await fetch("/api/vcr");
      if (vres.ok) renderVCR(await vres.json());
    } catch (err) {
      console.warn("[CommandCenter] vcr failed:", err.message);
    }
  } catch (err) {
    console.warn("[CommandCenter] poll failed:", err.message);
  }
}

// ─── Compteur d'impact (7j) ────────────────────────────────────

function renderImpact(s) {
  const el = $("#impact-line");
  if (!el || !s) return;
  el.textContent =
    `7j · ${s.exec7d} exec (${s.execOk7d} ok)` +
    ` · ${s.approved7d} approved / ${s.blocked7d} blocked` +
    ` · ~$${s.savedUsd} évités`;
}

// ─── VCR-lite cache status ──────────────────────────────────

function renderVCR(v) {
  const el = $("#vcr-line");
  if (!el || !v) return;
  el.textContent = `cache: ${v.cassettes} cassette(s) · mode: ${v.mode}`;
  el.style.color = v.cassettes > 0 ? "#4ade80" : "#6b7280";
}

// ─── Init ──────────────────────────────────────────────────────

let currentPrompt = "PS C:\\Users\\PC\\opencode-config>";

document.addEventListener("DOMContentLoaded", () => {
  poll();
  setInterval(poll, POLL_MS);

  // Chat — Entrée simple envoie (Shift+Entrée = nouvelle ligne)
  const sendBtn = $(".send-btn");
  const chatInput = $(".chat-input input");
  if (sendBtn) sendBtn.addEventListener("click", sendChat);
  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      }
    });
  }

  // Terminal
  const termInput = $(".terminal-input");
  if (termInput) {
    termInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendTerminal();
    });
  }

  // Git commit
  const commitBtn = $(".commit-btn");
  if (commitBtn) commitBtn.addEventListener("click", commitChanges);

  // File tree toggle
  document.addEventListener("click", (e) => {
    const dir = e.target.closest(".tree-dir");
    if (dir) {
      const sub = dir.nextElementSibling;
      if (sub && sub.tagName === "UL") {
        const hidden = sub.style.display === "none";
        sub.style.display = hidden ? "block" : "none";
        dir.querySelector(".chevron").textContent = hidden ? "▾" : "▸";
      }
    }
  });
});