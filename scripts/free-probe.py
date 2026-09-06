#!/usr/bin/env python3
"""Probe les modeles FREE (1 micro-appel chacun, ~15 tokens) et ecrit free-models.json.
Lance UNIQUEMENT sur activation de @free-router ou echec suspecte (quotas!).
Ne JAMAIS tester huggingface ici (credit payant $0.10 partage).
Usage: python ~/.config/opencode/scripts/free-probe.py
"""
import json, os, time, urllib.request, urllib.error

HOME = os.path.expanduser("~")
CFG = os.path.join(HOME, ".config", "opencode")


def read_key(name):
    with open(os.path.join(CFG, name)) as f:
        return f.read().strip()


def post(url, headers, body, timeout=30):
    req = urllib.request.Request(
        url, data=json.dumps(body).encode(), headers=headers
    )
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        return ("ok", r.status)
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return ("rate_limited", 429)
        return ("error", e.code)
    except Exception as e:
        return ("error", str(e)[:80])


UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenCode"}
CHAT = lambda model: {
    "model": model,
    "messages": [{"role": "user", "content": "OK"}],
    "max_tokens": 2,
}

results = {}

# 1. Google Gemini 2.5 Flash (endpoint natif)
try:
    key = read_key(".gemini-key")
    st, info = post(
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}",
        {"Content-Type": "application/json", **UA},
        {"contents": [{"parts": [{"text": "OK"}]}],
         "generationConfig": {"maxOutputTokens": 2}},
    )
    results["worker-google"] = st
except Exception as e:
    results["worker-google"] = f"error:{str(e)[:60]}"
time.sleep(1.5)

# 2. Z.AI GLM 4.7 Flash
try:
    key = read_key(".zhipu-key")
    st, _ = post(
        "https://api.z.ai/api/paas/v4/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
        CHAT("glm-4.7-flash"),
    )
    results["worker-zhipu"] = st
except Exception as e:
    results["worker-zhipu"] = f"error:{str(e)[:60]}"
time.sleep(1.5)

# 3. Mistral Codestral
try:
    key = read_key(".mistral-key")
    st, _ = post(
        "https://api.mistral.ai/v1/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
        CHAT("codestral-latest"),
    )
    results["worker-codestral"] = st
except Exception as e:
    results["worker-codestral"] = f"error:{str(e)[:60]}"
time.sleep(1.5)

# 4. Groq Qwen 3.8
try:
    key = read_key(".groq-key")
    st, _ = post(
        "https://api.groq.com/openai/v1/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
        CHAT("qwen/qwen3.8-27b"),
    )
    results["worker-groq"] = st
except Exception as e:
    results["worker-groq"] = f"error:{str(e)[:60]}"
time.sleep(1.5)

# 5. Novita Ling 3.0 Flash Santé (GRATUIT, testé OK)
try:
    key = read_key(".novita-key")
    st, _ = post(
        "https://api.novita.ai/openai/v1/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
        CHAT("inclusionai/ling-3.0-flash-sante"),
    )
    results["worker-novita"] = st
except Exception as e:
    results["worker-novita"] = f"error:{str(e)[:60]}"
time.sleep(1.5)

# 6. Together Kimi-K2.7-Code (DÉSACTIVÉ — clé invalide)
try:
    key = read_key(".together-key")
    if not key:
        results["worker-together"] = "skipped"
    else:
        st, _ = post(
            "https://api.together.xyz/v1/chat/completions",
            {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
            CHAT("moonshotai/Kimi-K2.7-Code"),
        )
        results["worker-together"] = st
except Exception as e:
    results["worker-together"] = f"error:{str(e)[:60]}"
time.sleep(1.5)

# 7. DeepSeek API native (DÉSACTIVÉ — clé invalide)
try:
    key = read_key(".deepseek-key")
    if not key:
        results["worker-deepseek"] = "skipped"
    else:
        st, _ = post(
            "https://api.deepseek.com/v1/chat/completions",
            {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
            CHAT("deepseek-v4-flash"),
        )
        results["worker-deepseek"] = st
except Exception as e:
    results["worker-deepseek"] = f"error:{str(e)[:60]}"

out = {"updated": int(time.time()), "models": results}
with open(os.path.join(CFG, "free-models.json"), "w") as f:
    json.dump(out, f, indent=2)
print(json.dumps(out, indent=2))