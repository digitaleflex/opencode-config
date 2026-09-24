#!/usr/bin/env python3
"""Probe les modeles FREE (1 micro-appel chacun, ~15 tokens) et ecrit free-models.json.
Lance UNIQUEMENT sur activation de @free-router ou echec suspecte (quotas!).
Ne JAMAIS tester huggingface ici (credit payant $0.10 partage).
Usage: python ~/.config/opencode/scripts/free-probe.py [--json]
"""
import json, os, time, urllib.request, urllib.error, argparse, sys

# Force UTF-8 sur stdout (Windows cp1252 sinon)
try:
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
except Exception:
    pass

HOME = os.path.expanduser("~")
CFG = os.path.join(HOME, ".config", "opencode")


def read_key(name):
    try:
        with open(os.path.join(CFG, name)) as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""


def post(url, headers, body, timeout=30):
    """Retourne (status, info, latency_ms) ou (status, error, latency_ms)."""
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers=headers
    )
    t0 = time.time()
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        dt = int((time.time() - t0) * 1000)
        return ("ok", r.status, dt)
    except urllib.error.HTTPError as e:
        dt = int((time.time() - t0) * 1000)
        if e.code == 429:
            return ("rate_limited", 429, dt)
        return ("error", e.code, dt)
    except Exception as e:
        dt = int((time.time() - t0) * 1000)
        return ("error", str(e)[:80], dt)


UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenCode"}
CHAT = lambda model: {
    "model": model,
    "messages": [{"role": "user", "content": "OK"}],
    "max_tokens": 2,
}

results = {}
latencies = {}

# 1. Google Gemini 2.5 Flash
try:
    key = read_key(".gemini-key")
    st, info, dt = post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}",
        {"Content-Type": "application/json", **UA},
        {"contents": [{"parts": [{"text": "OK"}]}],
         "generationConfig": {"maxOutputTokens": 2}},
    )
    results["worker-google"] = st
    latencies["worker-google"] = dt
except Exception as e:
    results["worker-google"] = f"error:{str(e)[:60]}"
    latencies["worker-google"] = 0
time.sleep(1.5)

# 2. Z.AI GLM 4.7 Flash
try:
    key = read_key(".zhipu-key")
    st, _, dt = post(
        "https://api.z.ai/api/paas/v4/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
        CHAT("glm-4.7-flash"),
    )
    results["worker-zhipu"] = st
    latencies["worker-zhipu"] = dt
except Exception as e:
    results["worker-zhipu"] = f"error:{str(e)[:60]}"
    latencies["worker-zhipu"] = 0
time.sleep(1.5)

# 3. Worker code : OpenRouter poolside/laguna-s-2.1:free
# (ex-Mistral Codestral — basculé le 2026-09-12, Mistral renvoyait
# « Payment Required ». Le probe sonde le VRAI endpoint du worker.)
try:
    key = read_key(".openrouter-key")
    st, _, dt = post(
        "https://openrouter.ai/api/v1/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
        CHAT("poolside/laguna-s-2.1:free"),
    )
    results["worker-codestral"] = st
    latencies["worker-codestral"] = dt
except Exception as e:
    results["worker-codestral"] = f"error:{str(e)[:60]}"
    latencies["worker-codestral"] = 0
time.sleep(1.5)

# 4. Groq Qwen 3.8
try:
    key = read_key(".groq-key")
    st, _, dt = post(
        "https://api.groq.com/openai/v1/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
        CHAT("qwen/qwen3.8-27b"),
    )
    results["worker-groq"] = st
    latencies["worker-groq"] = dt
except Exception as e:
    results["worker-groq"] = f"error:{str(e)[:60]}"
    latencies["worker-groq"] = 0
time.sleep(1.5)

# 5. Novita Ling 3.0 Flash
try:
    key = read_key(".novita-key")
    st, _, dt = post(
        "https://api.novita.ai/openai/v1/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
        CHAT("inclusionai/ling-3.0-flash-sante"),
    )
    results["worker-novita"] = st
    latencies["worker-novita"] = dt
except Exception as e:
    results["worker-novita"] = f"error:{str(e)[:60]}"
    latencies["worker-novita"] = 0
time.sleep(1.5)

# 6. Pollinations (FREE, sans cle — tier anonyme)
try:
    st, _, dt = post(
        "https://text.pollinations.ai/openai",
        {"Content-Type": "application/json", **UA},
        CHAT("openai"),
        timeout=45,
    )
    results["worker-pollinations"] = st
    latencies["worker-pollinations"] = dt
except Exception as e:
    results["worker-pollinations"] = f"error:{str(e)[:60]}"
    latencies["worker-pollinations"] = 0
time.sleep(1.5)

# 7. Ollama local (100% gratuit, offline — skip si Ollama absent)
try:
    st, _, dt = post(
        "http://localhost:11434/v1/chat/completions",
        {"Content-Type": "application/json", **UA},
        CHAT("devstral"),
        timeout=60,
    )
    results["worker-ollama"] = st
    latencies["worker-ollama"] = dt
except Exception as e:
    results["worker-ollama"] = f"error:{str(e)[:60]}"
    latencies["worker-ollama"] = 0

# 8. Cloudflare Workers AI (10K neurons/jour — cle + account ID requis)
try:
    key = read_key(".cloudflare-key")
    try:
        with open(os.path.join(CFG, ".cloudflare-account")) as f:
            account = f.read().strip()
    except Exception:
        account = ""
    if not key or not account:
        results["worker-cloudflare"] = "skipped"
        latencies["worker-cloudflare"] = 0
    else:
        st, _, dt = post(
            f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/@cf/zai-org/glm-4.7-flash",
            {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
            {"messages": [{"role": "user", "content": "OK"}]},
        )
        results["worker-cloudflare"] = st
        latencies["worker-cloudflare"] = dt
except Exception as e:
    results["worker-cloudflare"] = f"error:{str(e)[:60]}"
    latencies["worker-cloudflare"] = 0

# 9. Métadonnées modèles live (models.dev, cache 24h — jamais bloquant)
# Schéma upstream vérifié dans .slim/clonedeps/repos/anomalyco__models-dev :
# providers.<p>.models.<id> -> {limit:{context,output}, cost:{input,output}($/M)}.
# worker -> [(provider, model_id)] candidats, premier hit gagne. Un worker
# absent de models.dev (ex. novita ling-sante) n'a simplement pas de meta :
# la latence du probe reste son seul signal. Coût réseau : 1 GET / 24h.
MODELS_DEV_URL = "https://models.dev/api.json"
MODELS_DEV_CACHE = os.path.join(CFG, "models-dev-cache.json")
MODELS_DEV_TTL = 86400
MODELS_DEV_MAP = {
    "worker-groq": [("groq", "qwen/qwen3.8-27b")],
    "worker-zhipu": [("zhipuai", "glm-4.7-flash"), ("zai", "glm-4.7-flash")],
    "worker-codestral": [("openrouter", "poolside/laguna-s-2.1:free")],
    "worker-novita": [("novita-ai", "inclusionai/ling-3.0-flash-sante")],
    "worker-google": [("google", "gemini-2.5-flash")],
}


def fetch_models_dev():
    try:
        with open(MODELS_DEV_CACHE) as f:
            cache = json.load(f)
        if time.time() - cache.get("fetched", 0) < MODELS_DEV_TTL:
            return cache.get("api")
    except Exception:
        pass
    try:
        req = urllib.request.Request(MODELS_DEV_URL, headers=UA)
        api = json.load(urllib.request.urlopen(req, timeout=25))
        try:
            with open(MODELS_DEV_CACHE, "w") as f:
                json.dump({"fetched": int(time.time()), "api": api}, f)
        except Exception:
            pass
        return api
    except Exception as e:
        print(f"  [META] models.dev injoignable ({str(e)[:60]}), sans metadonnees")
        return None


def extract_meta(api):
    meta = {}
    if not isinstance(api, dict):
        return meta
    for worker, candidates in MODELS_DEV_MAP.items():
        for provider, mid in candidates:
            try:
                m = api[provider]["models"][mid]
            except (KeyError, TypeError):
                continue
            try:
                limit = m.get("limit", {}) or {}
                cost = m.get("cost", {}) or {}
                meta[worker] = {
                    "model": mid,
                    "context": int(limit.get("context") or 0),
                    "max_output": int(limit.get("output") or 0),
                    "cost_in": float(cost.get("input") or 0),
                    "cost_out": float(cost.get("output") or 0),
                }
                break
            except (ValueError, TypeError):
                continue
    return meta


models_meta = extract_meta(fetch_models_dev())
missing = [w for w in MODELS_DEV_MAP if w not in models_meta]
print(f"  [META] {len(models_meta)}/{len(MODELS_DEV_MAP)} modeles documentes" +
      (f" (absents: {', '.join(missing)})" if missing else ""))

# Construction du rapport
out = {
    "updated": int(time.time()),
    "updated_human": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
    "models": results,
    "latencies_ms": latencies,
    "models_meta": models_meta,
}

# Sauvegarde
with open(os.path.join(CFG, "free-models.json"), "w") as f:
    json.dump(out, f, indent=2)

# Sortie console lisible
print("=== EURINHASH Free Models Probe ===")
print(f"Updated: {out['updated_human']}")
print()
ok = 0
err = 0
for name, status in results.items():
    lat = latencies.get(name, 0)
    if status == "ok":
        marker = "[OK]"
        ok += 1
    elif status == "rate_limited":
        marker = "[429]"
        err += 1
    elif status == "skipped":
        marker = "[SKIP]"
    else:
        marker = "[ERR]"
        err += 1
    print(f"  {marker} {name:20s} {status:15s} {lat:>5d}ms")
print()
print(f"OK: {ok} | Errors: {err} | Total: {len(results)}")
