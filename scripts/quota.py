#!/usr/bin/env python3
"""Tableau de bord lisible : conso du jour, état des workers gratuits, conseil.
Langage simple (non-technique), couleurs d'état, recommandation du modèle
à utiliser maintenant. Lecture seule, zéro coût (ne probe pas).
Usage: python ~/.config/opencode/scripts/quota.py
"""
import json, os, sys, time, datetime, urllib.request, urllib.error

HOME = os.path.expanduser("~")
CFG = os.path.join(HOME, ".config", "opencode")

USE_COLOR = sys.stdout.isatty() and not os.environ.get("NO_COLOR")


def c(name, text):
    codes = {
        "green": "\033[32m", "yellow": "\033[33m", "red": "\033[31m",
        "cyan": "\033[36m", "bold": "\033[1m", "dim": "\033[2m",
        "reset": "\033[0m",
    }
    if not USE_COLOR:
        return text
    return f"{codes[name]}{text}{codes['reset']}"


def green(t): return c("green", t)
def yellow(t): return c("yellow", t)
def red(t): return c("red", t)
def bold(t): return c("bold", t)
def dim(t): return c("dim", t)


# Ordre de préférence (même ordre que le superviseur @eurinhash)
WORKERS = [
    ("worker-codestral", "Codestral", "le meilleur pour le code"),
    ("worker-groq", "Groq", "le plus rapide"),
    ("worker-novita", "Novita", "100% gratuit"),
    ("worker-zhipu", "Zhipu", "le plus polyvalent"),
    ("worker-sambanova", "SambaNova", "les gros modèles"),
    ("worker-google", "Google", "le plus costaud"),
    ("worker-cerebras", "Cerebras", "ultra-rapide (trial)"),
    ("worker-cohere", "Cohere", "trial, réponses courtes"),
    ("worker-ollama", "Ollama", "local, sans quota"),
    ("worker-pollinations", "Pollinations", "secours sans clé"),
]

STATE_FR = {
    "ok": ("disponible", "green"),
    "rate_limited": ("en pause (quota atteint)", "yellow"),
    "error": ("en panne", "red"),
    "unknown": ("jamais testé", "yellow"),
    "skipped": ("ignoré", "dim"),
}


def read_key(name):
    with open(os.path.join(CFG, name), encoding="utf-8") as f:
        return f.read().strip()


print(bold("=== Mon argent aujourd'hui ==="))
dbcands = [os.path.join(HOME, ".local", "share", "opencode", "opencode.db")]
dbpath = next((x for x in dbcands if os.path.isfile(x)), None)
total_cost = 0.0
per_model = {}
if not dbpath:
    print("  " + dim("compteur local introuvable — `opencode stats --days 1 --models` pour le détail"))
else:
    try:
        import sqlite3
        midnight = int(datetime.datetime.now().replace(
            hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
        db = sqlite3.connect(f"file:{dbpath}?mode=ro", uri=True)
        rows = db.execute(
            "select data from message where time_updated >= ?", (midnight,)
        ).fetchall()
        for (raw,) in rows:
            try:
                m = json.loads(raw)
            except Exception:
                continue
            if m.get("role") != "assistant":
                continue
            k = f"{m.get('providerID')}/{m.get('modelID')}"
            e = per_model.setdefault(k, {"n": 0, "cost": 0.0})
            e["n"] += 1
            e["cost"] += m.get("cost") or 0
        total_cost = sum(e["cost"] for e in per_model.values())
    except Exception as e:
        print(f"  {str(e)[:100]}")
if total_cost <= 0:
    print("  " + green("0,00 $ dépensé — tout est passé par du gratuit") + " 🎉")
else:
    print(f"  {bold(f'{total_cost:.2f} $')} dépensés aujourd'hui")
    for k, e in sorted(per_model.items(), key=lambda x: -x[1]["cost"])[:5]:
        print(f"    {k} : {e['n']} appels, {e['cost']:.4f} $")

print()
print(bold("=== Mes modèles gratuits (état en direct) ==="))
states = {}
cache_age_min = None
try:
    fm = json.load(open(os.path.join(CFG, "free-models.json"), encoding="utf-8"))
    cache_age_min = (int(time.time()) - fm.get("updated", 0)) // 60
    states = fm.get("models", {})
except FileNotFoundError:
    print("  " + yellow("pas d'état enregistré — lance free-probe.py via @eurinhash"))
for wid, label, role in WORKERS:
    raw = states.get(wid, "unknown")
    base = raw.split(":")[0] if isinstance(raw, str) else "unknown"
    fr, color = STATE_FR.get(base, ("état inconnu", "yellow"))
    dot = {"green": "🟢", "yellow": "🟡", "red": "🔴", "dim": "⚪"}.get(color, "⚪")
    print(f"  {dot} {c(color, label.ljust(22))} {fr}  {dim('(' + role + ')')}")
if cache_age_min is not None:
    if cache_age_min > 30:
        print("  " + yellow(f"⚠ état vieux de {cache_age_min} min — demande à @eurinhash de re-tester"))
    else:
        print(f"  {dim(f'état vérifié il y a {cache_age_min} min')}")

print()
print(bold("=== Mon conseil du moment ==="))
ok = [wid for wid, _, _ in WORKERS if str(states.get(wid, "")).split(":")[0] == "ok"]
if ok:
    best = ok[0]
    label = next(l for i, l, _ in WORKERS if i == best)
    role = next(r for i, _, r in WORKERS if i == best)
    print(f"  👉 {green('Utilise ' + label + ' en ce moment')} ({role}, disponible)")
    rest = [w for w in ok[1:3]]
    if rest:
        names = ", ".join(next(l for i, l, _ in WORKERS if i == w) for w in rest)
        print(f"     Secours : {names}")
else:
    waiting = [wid for wid, _, _ in WORKERS
               if str(states.get(wid, "")).split(":")[0] in ("rate_limited", "unknown")]
    if waiting:
        print("  " + yellow("⏳ Tous les gratuits sont en pause — attends un peu, ou passe en local (Ollama)"))
    else:
        print("  " + red("🔴 Tout est en panne — vérifie tes clés API, puis relance free-probe.py"))

print()
print(bold("=== Clé OpenRouter (seule avec un compteur distant) ==="))
try:
    key = read_key(".openrouter-key")
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/key",
        headers={"Authorization": f"Bearer {key}"},
    )
    data = json.loads(urllib.request.urlopen(req, timeout=30).read()).get("data", {})
    print(f"  utilisé : {data.get('usage')} / limite : {data.get('limit')}")
    print(f"  restant : {data.get('limit_remaining')}")
except Exception as e:
    print(f"  {dim('indisponible : ' + str(e)[:100])}")

print()
print(dim("(autres providers = voir leur site, pas de compteur distant)"))
