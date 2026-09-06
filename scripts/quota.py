#!/usr/bin/env python3
"""Vue monitoring : modeles FREE (cache probe) + usage cle OpenRouter + depense OpenCode du jour.
Lecture seule, zero cout (ne probe pas, ne consomme aucun quota).
Usage: python ~/.config/opencode/scripts/quota.py
"""
import json, os, time, datetime, urllib.request, urllib.error

HOME = os.path.expanduser("~")
CFG = os.path.join(HOME, ".config", "opencode")


def read_key(name):
    with open(os.path.join(CFG, name), encoding="utf-8") as f:
        return f.read().strip()


print("=== FREE MODELS (cache probe) ===")
try:
    fm = json.load(open(os.path.join(CFG, "free-models.json"), encoding="utf-8"))
    age = int(time.time()) - fm.get("updated", 0)
    print(f"age cache: {age // 60} min (regenere via free-probe.py si >30)")
    for k, v in fm.get("models", {}).items():
        print(f"  {k}: {v}")
except FileNotFoundError:
    print("  pas de cache — lance free-probe.py (via @eurinhash)")

print("\n=== OPENROUTER KEY (seule API quota dispo) ===")
try:
    key = read_key(".openrouter-key")
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/key",
        headers={"Authorization": f"Bearer {key}"},
    )
    d = json.loads(urllib.request.urlopen(req, timeout=30).read())
    data = d.get("data", {})
    print(f"  usage: {data.get('usage')} / limit: {data.get('limit')}")
    print(f"  restant: {data.get('limit_remaining')}")
    print(f"  free tier: {data.get('is_free_tier')}")
except Exception as e:
    print(f"  ERR: {str(e)[:120]}")

print("\n=== DEPENSE OPENCODE AUJOURD'HUI (opencode.db) ===")
import sqlite3

dbcands = [
    os.path.join(HOME, ".local", "share", "opencode", "opencode.db"),
]
dbpath = next((c for c in dbcands if os.path.isfile(c)), None)
if not dbpath:
    print("  db introuvable — utilise `opencode stats --days 1 --models`")
else:
    try:
        midnight = int(
            datetime.datetime.now()
            .replace(hour=0, minute=0, second=0, microsecond=0)
            .timestamp()
            * 1000
        )
        db = sqlite3.connect(f"file:{dbpath}?mode=ro", uri=True)
        rows = db.execute(
            "select data from message where time_updated >= ?", (midnight,)
        ).fetchall()
        agg = {}
        for (raw,) in rows:
            try:
                m = json.loads(raw)
            except Exception:
                continue
            if m.get("role") != "assistant":
                continue
            t = (m.get("time") or {}).get("completed", 0) or 0
            if t < midnight:
                continue
            k = f"{m.get('providerID')}/{m.get('modelID')}"
            tok = m.get("tokens") or {}
            e = agg.setdefault(k, {"n": 0, "cost": 0.0, "in": 0, "out": 0})
            e["n"] += 1
            e["cost"] += m.get("cost") or 0
            e["in"] += tok.get("input", 0) or 0
            e["out"] += tok.get("output", 0) or 0
        if not agg:
            print("  rien aujourd'hui")
        else:
            for k, e in sorted(agg.items(), key=lambda x: -x[1]["cost"]):
                print(
                    f"  {k}: {e['n']} appels, ${e['cost']:.4f}, "
                    f"in={e['in']} out={e['out']}"
                )
            print(
                f"  TOTAL: ${sum(e['cost'] for e in agg.values()):.4f}"
            )
    except Exception as e:
        print(f"  ERR db ({str(e)[:100]}) — utilise `opencode stats --days 1 --models`")

print("\n(autres providers = dashboard uniquement : pas d'API quota)")
