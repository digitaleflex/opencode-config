# -*- coding: utf-8 -*-
"""models-free.py — Découverte des modèles gratuits via models.dev.

Interroge https://models.dev/api.json et liste les modèles dont le coût
d'entrée est 0 (vraiment gratuits), par provider. Utile pour enrichir la
chaîne de fallback EURINHASH (ex. les 22 modèles :free d'OpenRouter).

Usage :
  python models-free.py                # tous les providers
  python models-free.py openrouter     # un provider précis
  python models-free.py --code         # seulement les modèles orientés code
"""
import json
import sys
import urllib.request

API_URL = "https://models.dev/api.json"

# Providers prioritaires de la config EURINHASH
PRIORITY = ["openrouter", "google", "groq", "huggingface", "novita", "zhipu", "pollinations", "ollama"]

# Indices de modèles orientés code (dans l'ID ou le nom)
CODE_HINTS = ("coder", "code", "laguna", "devstral", "qwen", "deepseek", "glm", "gpt-oss", "kimi", "llama")


def fetch():
    req = urllib.request.Request(
        API_URL,
        headers={"User-Agent": "eurinhash-models-free/1.0 (opencode config)"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main():
    args = sys.argv[1:]
    only_provider = None
    code_only = False
    for a in args:
        if a == "--code":
            code_only = True
        elif not a.startswith("-"):
            only_provider = a

    data = fetch()
    providers = data.get("providers", data)

    targets = [only_provider] if only_provider else PRIORITY
    total = 0

    for name in targets:
        info = providers.get(name)
        if not info:
            print(f"\n[{name}] ABSENT de models.dev")
            continue
        models = info.get("models", {})
        free = []
        for mid, m in models.items():
            cost = m.get("cost", {})
            if cost.get("input", 1) == 0:
                if code_only and not any(h in mid.lower() or h in m.get("name", "").lower() for h in CODE_HINTS):
                    continue
                free.append((mid, m.get("limit", {}).get("context", "?")))
        if not free:
            print(f"\n[{name}] aucun modèle gratuit détecté")
            continue
        print(f"\n[{name}] {len(free)} modèle(s) gratuit(s) :")
        for mid, ctx in sorted(free):
            print(f"  {mid}  (ctx {ctx})")
            total += 1

    print(f"\nTotal : {total} modèle(s) gratuit(s)")


if __name__ == "__main__":
    main()