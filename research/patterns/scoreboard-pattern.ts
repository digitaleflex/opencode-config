/**
 * scoreboard-pattern.ts
 *
 * Terminal scoreboard + web dashboard for live provider observability,
 * adapted from ingridtoulotte/llm-fallback-router (MIT, 0 deps).
 *
 * Adapted for opencode/EURINHASH: displays worker health + routing decisions.
 *
 * Features:
 *   - Terminal scoreboard (ASCII table, color-coded status)
 *   - Web dashboard (zero-dependency HTML, port 7575)
 *   - Score bars, latency, error rate, cost columns
 *   - Real-time decision feed
 *   - JSON API endpoints for external monitoring
 */

export interface WorkerRow {
  workerId: string;
  modelId: string;
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  latencyMs: number;
  errorRate: number;
  score: number;
  calls: number;
  breakerState: "closed" | "open" | "half_open";
}

export interface ScoreboardData {
  workers: WorkerRow[];
  totalCalls: number;
  totalFallbacks: number;
  avgLatencyMs: number;
  timestamp: string;
}

export interface RouteDecision {
  timestamp: string;
  chosenWorker: string;
  strategy: string;
  attempts: Array<{
    worker: string;
    outcome: "success" | "failed" | "skipped";
    reason?: string;
    latencyMs?: number;
    errorKind?: string;
  }>;
  fallback: boolean;
  totalLatencyMs: number;
}

/**
 * Render ASCII scoreboard to terminal string.
 * Example output:
 *
 *  PROVIDER      MODEL                     STATUS       LATENCY   ERRORS  SCORE  HEALTH
 *  ─────────────────────────────────────────────────────────────────────────────────────
 *  worker-novita  ling-3.0-flash-sante    ● healthy     287ms     0.0%     98  █████████░
 *  worker-groq    qwen3.8-27b             ● healthy     143ms     1.2%     96  █████████░
 *  worker-zhipu   glm-4.7-flash           ◐ degraded    892ms     8.3%     74  ███████░░░
 *  worker-google  gemini-2.5-flash        ○ unknown       --      --       --   -------
 */
export function renderScoreboard(data: ScoreboardData): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(" PROVIDER        MODEL                     STATUS       LATENCY   ERRORS  SCORE  HEALTH");
  lines.push(" ─────────────────────────────────────────────────────────────────────────────────────");

  for (const w of data.workers) {
    const statusChar = w.status === "healthy" ? "●"
      : w.status === "degraded" ? "◐"
      : w.status === "unhealthy" ? "○"
      : "?";

    const statusStr = `${statusChar} ${w.status.padEnd(10)}`;
    const modelStr = w.modelId.padEnd(24);
    const latStr = w.latencyMs > 0 ? `${String(w.latencyMs).padStart(5)}ms` : "   --";
    const errStr = w.errorRate >= 0 ? `${(w.errorRate * 100).toFixed(1).padStart(4)}%` : "  --";
    const scoreStr = w.score >= 0 ? String(w.score).padStart(3) : " --";

    // Score bar: 10 chars, filled proportional to score
    const barLen = w.score >= 0 ? Math.round((w.score / 100) * 10) : 0;
    const barFilled = "█".repeat(barLen);
    const barEmpty = "░".repeat(Math.max(0, 10 - barLen));
    const barStr = `${barFilled}${barEmpty}`;

    lines.push(` ${w.workerId.padEnd(14)} ${modelStr} ${statusStr} ${latStr}  ${errStr}  ${scoreStr}  ${barStr}`);
  }

  lines.push("");
  lines.push(` Total calls: ${data.totalCalls} | Fallbacks: ${data.totalFallbacks} | Avg latency: ${data.avgLatencyMs}ms | ${data.timestamp}`);

  return lines.join("\n");
}

/**
 * Create a zero-dependency HTML dashboard page.
 * Serves at http://127.0.0.1:7575 with auto-refresh every 2s.
 */
export function createDashboardHtml(scoreboard: ScoreboardData, decisions: RouteDecision[]): string {
  const workerRows = scoreboard.workers.map(w => {
    const statusColor = w.status === "healthy" ? "#22c55e"
      : w.status === "degraded" ? "#f59e0b"
      : w.status === "unhealthy" ? "#ef4444"
      : "#6b7280";
    const barWidth = w.score >= 0 ? (w.score / 100) * 120 : 0;
    return `<tr>
      <td><strong>${w.workerId}</strong></td>
      <td style="font-size:11px;color:#9ca3af">${w.modelId}</td>
      <td><span style="color:${statusColor};font-weight:bold">● ${w.status}</span></td>
      <td>${w.latencyMs > 0 ? w.latencyMs + "ms" : "—"}</td>
      <td>${w.errorRate >= 0 ? (w.errorRate * 100).toFixed(1) + "%" : "—"}</td>
      <td>${w.score >= 0 ? w.score : "—"}</td>
      <td>
        <div style="width:120px;background:#1f2937;border-radius:3px">
          <div style="width:${barWidth}px;height:14px;background:${statusColor};border-radius:3px"></div>
        </div>
      </td>
    </tr>`;
  }).join("");

  const decisionRows = decisions.slice(-20).reverse().map(d => {
    const bg = d.fallback ? "#1f2937" : "#0f172a";
    const attemptList = d.attempts.map(a => {
      const color = a.outcome === "success" ? "#22c55e"
        : a.outcome === "failed" ? "#ef4444"
        : "#6b7280";
      return `<span style="color:${color}">[${a.worker} ${a.outcome}]</span>`;
    }).join(" ");
    return `<tr style="background:${bg}">
      <td style="white-space:nowrap">${d.timestamp.split("T")[1]?.slice(0, 8) ?? d.timestamp}</td>
      <td><strong>${d.chosenWorker}</strong></td>
      <td style="color:#9ca3af">${attemptList}</td>
      <td>${d.totalLatencyMs}ms</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>EURINHASH Scoreboard</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
  h1 { font-size: 18px; font-weight: 600; color: #f8fafc; margin-bottom: 16px; }
  .card { background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
  .card h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: #64748b; font-weight: 500; padding: 6px 8px; border-bottom: 1px solid #334155; }
  td { padding: 8px 8px; border-bottom: 1px solid #1e293b; }
  tr:last-child td { border-bottom: none; }
  .stats { display: flex; gap: 24px; }
  .stat { display: flex; flex-direction: column; }
  .stat-val { font-size: 24px; font-weight: 700; color: #f8fafc; }
  .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
</style>
</head>
<body>
<h1>⚡ EURINHASH Worker Scoreboard</h1>
<div class="grid">
<div class="card">
  <h2>Workers</h2>
  <table>
    <thead><tr><th>Worker</th><th>Model</th><th>Status</th><th>Latency</th><th>Errors</th><th>Score</th><th>Health</th></tr></thead>
    <tbody>${workerRows}</tbody>
  </table>
</div>
<div class="card">
  <h2>Recent Decisions</h2>
  <table>
    <thead><tr><th>Time</th><th>Chosen</th><th>Attempts</th><th>Latency</th></tr></thead>
    <tbody>${decisionRows}</tbody>
  </table>
</div>
</div>
<div class="card">
  <h2>Summary</h2>
  <div class="stats">
    <div class="stat"><span class="stat-val">${scoreboard.totalCalls}</span><span class="stat-label">Total Calls</span></div>
    <div class="stat"><span class="stat-val">${scoreboard.totalFallbacks}</span><span class="stat-label">Fallbacks</span></div>
    <div class="stat"><span class="stat-val">${scoreboard.avgLatencyMs}ms</span><span class="stat-label">Avg Latency</span></div>
  </div>
</div>
<script>
  setTimeout(() => location.reload(), 2000);
</script>
</body>
</html>`;
}