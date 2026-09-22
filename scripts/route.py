#!/usr/bin/env python3
"""
route.py v2 — Routage par ESPÉRANCE DE VALEUR (2026-09-19)

Principe mathématique (théorie de la décision) :
    EV(worker) = qualité × disponibilité / coût

    - qualité      : score 0-1 par famille de modèle (baseline + rétroaction)
    - disponibilité: 1.0 si ok, 0.2 si rate_limited, 0 si error (probe live)
    - coût         : latence normalisée (ms/1000 + 1) — le temps = tokens brûlés

Boucle de rétroaction (Bayes) : chaque résultat (succès/échec) ajuste le score
de qualité du worker. Les workers qui échouent voient leur EV chuter.

Usage:
    python route.py <type>            # meilleur worker (EV max) pour ce type
    python route.py <type> --next     # 2e meilleur (fallback)
    python route.py <type> --next=N   # N+1e meilleur
    python route.py list              # tous les workers : statut, latence, EV
    python route.py report            # EV détaillé par type de tâche
    python route.py record <worker> <success|fail>   # feedback loop
    python route.py --refresh         # force le probe

Sortie : "worker|modèle|raison|EV=x.xx" (parseable).
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timezone

HOME = os.path.expanduser("~")
CFG = os.path.join(HOME, ".config", "opencode")
FREE_MODELS = os.path.join(CFG, "free-models.json")
PROBE = os.path.join(CFG, "scripts", "free-probe.py")
USAGE_LOG = os.path.join(CFG, "route-usage.json")

# ── Qualité baseline par worker (0-1) — famille de modèle + réputation ──
# Source : myfree-eurinhash.py QUALITY_BASELINE + connaissance des familles.
QUALITY = {
    # FREE workers
    "worker-opencode": 0.90,        # deepseek-v4-flash — workhorse éprouvé
    "worker-opencode-heavy": 0.93,  # glm-5 — raisonnement fort
    "worker-codestral": 0.88,       # poolside laguna — code spécialisé
    "worker-groq": 0.82,            # qwen3.8-27b — rapide mais petit ctx
    "worker-novita": 0.85,          # ling-3.0-flash-sante — 256K ctx
    "worker-zhipu": 0.85,           # glm-4.7-flash — générique
    "worker-google": 0.96,          # gemini-2.5-flash — le plus costaud
    "worker-pollinations": 0.70,    # anonyme, réponses concises
    "worker-nvidia": 0.88,          # NVIDIA Nemotron GRATUIT
    # PRO workers (OpenRouter PAYG)
    "worker-pro-openrouter": 0.92,  # OpenRouter — modèles économiques
    "worker-pro-opencode-go": 0.94, # opencode-go — $0/token, inclus abonnement
}

# ── Registre des workers ────────────────────────────────────────────────
WORKERS = {
    # FREE workers
    "worker-opencode": {
        "model": "opencode/deepseek-v4-flash",
        "kind": "integrated",
        "ctx": 200_000,
        "types": ["code", "general", "quick", "long", "review"],
        "note": "intégré 0 quota, workhorse",
    },
    "worker-opencode-heavy": {
        "model": "opencode/glm-5",
        "kind": "integrated",
        "ctx": 204_800,
        "types": ["heavy", "review", "general"],
        "note": "intégré 0 quota, raisonnement lourd",
    },
    "worker-codestral": {
        "model": "openrouter/poolside/laguna-s-2.1:free",
        "kind": "external",
        "ctx": 1_000_000,
        "types": ["code", "long"],
        "probe": "worker-codestral",
        "note": "code spécialisé, 1M ctx",
    },
    "worker-groq": {
        "model": "groq/qwen/qwen3.8-27b",
        "kind": "external",
        "ctx": 32_768,
        "types": ["quick", "general"],
        "probe": "worker-groq",
        "note": "le plus rapide (ITPM 7000, petit ctx)",
    },
    "worker-novita": {
        "model": "novita/inclusionai/ling-3.0-flash-sante",
        "kind": "external",
        "ctx": 256_000,
        "types": ["long", "general"],
        "probe": "worker-novita",
        "note": "256K ctx, gratuit",
    },
    "worker-zhipu": {
        "model": "zhipu/glm-4.7-flash",
        "kind": "external",
        "ctx": 204_800,
        "types": ["general", "review"],
        "probe": "worker-zhipu",
        "note": "générique, latence parfois élevée",
    },
    "worker-google": {
        "model": "google/gemini-2.5-flash",
        "kind": "external",
        "ctx": 1_000_000,
        "types": ["general", "long"],
        "probe": "worker-google",
        "note": "polyvalent, 20 req/jour",
    },
    "worker-pollinations": {
        "model": "pollinations/openai",
        "kind": "external",
        "ctx": 128_000,
        "types": ["quick", "general"],
        "probe": "worker-pollinations",
        "note": "sans clé, 1 req/15s, réponses concises",
    },
    "worker-nvidia": {
        "model": "nvidia/nemotron-3-super-120b-a12b:free",
        "kind": "external",
        "ctx": 262_144,
        "types": ["code", "general", "quick", "long", "review"],
        "probe": "worker-nvidia",
        "note": "NVIDIA Nemotron GRATUIT, 1000 req/jour",
    },
    # PRO workers (OpenRouter PAYG + opencode-go)
    "worker-pro-openrouter": {
        "model": "openrouter/openai/gpt-4o-mini",  # modèle par défaut
        "kind": "external",
        "ctx": 128_000,
        "types": ["code", "general", "quick", "long", "review", "heavy"],
        "probe": "worker-pro-openrouter",
        "note": "OpenRouter PAYG, modèles économiques",
    },
    "worker-pro-opencode-go": {
        "model": "opencode-go/deepseek-v4.1-flash",  # modèle par défaut
        "kind": "external",
        "ctx": 200_000,
        "types": ["code", "general", "quick", "long", "review", "heavy"],
        "probe": "worker-pro-opencode-go",
        "note": "opencode-go abonnement, $0/token",
    },
}

# Types de tâche → workers pertinents (FREE par défaut)
TYPE_ORDER = {
    "code": ["worker-opencode", "worker-codestral", "worker-groq", "worker-novita", "worker-nvidia"],
    "general": ["worker-opencode", "worker-groq", "worker-novita", "worker-pollinations", "worker-zhipu", "worker-google", "worker-nvidia"],
    "quick": ["worker-groq", "worker-opencode", "worker-pollinations", "worker-nvidia"],
    "long": ["worker-novita", "worker-opencode", "worker-codestral", "worker-google", "worker-nvidia"],
    "heavy": ["worker-opencode-heavy", "worker-codestral", "worker-zhipu", "worker-nvidia"],
    "review": ["worker-opencode-heavy", "worker-opencode", "worker-zhipu", "worker-codestral", "worker-nvidia"],
}

# Types de tâche → workers PRO (économiques)
TYPE_ORDER_PRO = {
    "code": ["worker-pro-opencode-go", "worker-pro-openrouter", "worker-opencode", "worker-nvidia"],
    "general": ["worker-pro-opencode-go", "worker-pro-openrouter", "worker-opencode", "worker-novita", "worker-nvidia"],
    "quick": ["worker-pro-opencode-go", "worker-pro-openrouter", "worker-groq", "worker-opencode", "worker-nvidia"],
    "long": ["worker-pro-openrouter", "worker-pro-opencode-go", "worker-novita", "worker-opencode", "worker-nvidia"],
    "heavy": ["worker-pro-opencode-go", "worker-pro-openrouter", "worker-opencode-heavy", "worker-nvidia"],
    "review": ["worker-pro-opencode-go", "worker-pro-openrouter", "worker-opencode-heavy", "worker-opencode", "worker-nvidia"],
}

# Disponibilité par statut probe (facteur multiplicatif)
AVAIL = {"ok": 1.0, "rate_limited": 0.2, "error": 0.0, "skipped": 0.0, "unknown": 0.5}


def load_usage():
    """Charge l'historique de rétroaction (succès/échecs par worker)."""
    if os.path.exists(USAGE_LOG):
        try:
            with open(USAGE_LOG, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_usage(usage):
    with open(USAGE_LOG, "w", encoding="utf-8") as f:
        json.dump(usage, f, indent=2)


def effective_quality(worker, usage):
    """Qualité = baseline ajustée par la rétroaction (moyenne bayésienne)."""
    base = QUALITY.get(worker, 0.8)
    stats = usage.get(worker, {"ok": 0, "fail": 0})
    n = stats["ok"] + stats["fail"]
    if n == 0:
        return base
    # Moyenne bayésienne : baseline compte comme 4 observations a priori
    measured = stats["ok"] / n
    return (4 * base + n * measured) / (4 + n)


def load_status():
    """Lit free-models.json ; rafraîchit via probe si absent ou > 30 min."""
    need_probe = True
    if os.path.exists(FREE_MODELS):
        age = datetime.now(timezone.utc).timestamp() - os.path.getmtime(FREE_MODELS)
        if age < 1800:
            need_probe = False
    if need_probe:
        subprocess.run([sys.executable, PROBE], capture_output=True, timeout=120)
    with open(FREE_MODELS, encoding="utf-8") as f:
        return json.load(f)


def compute_ev(task_type, pro=False):
    """Retourne [(worker, ev, detail)] trié par EV décroissant."""
    status = load_status()
    lat = status.get("latencies_ms", {})
    models = status.get("models", {})
    usage = load_usage()
    workers = TYPE_ORDER_PRO if pro else TYPE_ORDER

    results = []
    for name in workers.get(task_type, []):
        w = WORKERS[name]
        q = effective_quality(name, usage)
        if w["kind"] == "integrated":
            avail = 1.0
            latency = 0.0
            st = "integrated"
        else:
            st = models.get(w["probe"], "unknown")
            avail = AVAIL.get(st, 0.5)
            latency = lat.get(w["probe"], 5000)
        cost = latency / 1000 + 1.0
        ev = q * avail / cost
        results.append((name, ev, q, avail, latency, st, w))
    results.sort(key=lambda x: -x[1])
    return results


def main():
    args = sys.argv[1:]
    if not args:
        sys.stderr.write(__doc__ or "Usage: route.py <type> [--next]\n")
        return 1

    # Feedback loop : enregistrer un résultat
    if args[0] == "record" and len(args) >= 3:
        worker, outcome = args[1], args[2]
        if worker not in WORKERS or outcome not in ("success", "fail"):
            sys.stderr.write("Usage: route.py record <worker> <success|fail>\n")
            return 1
        usage = load_usage()
        stats = usage.setdefault(worker, {"ok": 0, "fail": 0})
        stats["ok" if outcome == "success" else "fail"] += 1
        save_usage(usage)
        print(f"recorded {worker} {outcome} (ok={stats['ok']}, fail={stats['fail']})")
        return 0

    if args[0] == "list":
        status = load_status()
        lat = status.get("latencies_ms", {})
        models = status.get("models", {})
        usage = load_usage()
        print(f"{'worker':<24} {'statut':<12} {'latence':<8} {'qualité':<8} {'EV(code)':<8} modèle")
        for name, w in WORKERS.items():
            q = effective_quality(name, usage)
            if w["kind"] == "integrated":
                st, l = "integrated", 0
            else:
                st = models.get(w["probe"], "unknown")
                l = lat.get(w["probe"], "?")
            ev = q * (AVAIL.get(st, 0.5) if w["kind"] == "external" else 1.0) / (l / 1000 + 1 if isinstance(l, (int, float)) else 6)
            print(f"{name:<24} {st:<12} {str(l):<8} {q:<8.2f} {ev:<8.3f} {w['model']}")
        return 0

    if args[0] == "report":
        for t in TYPE_ORDER:
            results = compute_ev(t)
            best = results[0]
            print(f"{t:<8} -> {best[0]} (EV={best[1]:.3f}, q={best[2]:.2f}, lat={best[4]:.0f}ms)")
        return 0

    if args[0] == "--refresh":
        subprocess.run([sys.executable, PROBE], timeout=120)
        return 0

    # Check for --pro flag
    pro_mode = "--pro" in args
    if pro_mode:
        args = [a for a in args if a != "--pro"]

    task_type = args[0]
    if task_type not in TYPE_ORDER:
        sys.stderr.write(f"Type inconnu '{task_type}'. Types: {', '.join(TYPE_ORDER)}\n")
        return 1

    skip = 0
    if any(a.startswith("--next") for a in args):
        skip = 1
        for a in args:
            if a.startswith("--next="):
                skip = int(a.split("=")[1])

    results = compute_ev(task_type, pro=pro_mode)
    if skip >= len(results):
        if pro_mode:
            sys.stderr.write("AUCUN_WORKER_PRO_DISPO — fallback vers FREE.\n")
            results = compute_ev(task_type, pro=False)
            if skip >= len(results):
                sys.stderr.write("AUCUN_WORKER_DISPO — tous KO. Fallback payant (validation utilisateur requise).\n")
                return 2
        else:
            sys.stderr.write("AUCUN_WORKER_DISPO — tous KO. Fallback payant (validation utilisateur requise).\n")
            return 2

    name, ev, q, avail, latency, st, w = results[skip]
    mode_str = "PRO" if pro_mode else "FREE"
    print(f"{name}|{w['model']}|{w['note']}|EV={ev:.3f}|qualité={q:.2f}|latence={latency:.0f}ms|statut={st}|mode={mode_str}")
    return 0


if __name__ == "__main__":
    sys.exit(main())