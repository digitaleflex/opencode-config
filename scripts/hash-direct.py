#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HASH Direct Provider Wrapper — avec quota tracking + circuit breaker.
Contournement pour opencode qui ne parvient pas à appeler les providers.
Utilise directement les APIs avec les clés configurées dans ~/.config/opencode/.
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Dict, Optional, List
import requests

# ============================================================================
# PARAMÈTRES GLOBAUX & CHEMINS
# ============================================================================

# Force UTF-8 sur stdout/stderr (Windows cp1252 sinon)
try:
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
except Exception:
    pass

# Chemins
CONFIG_DIR = Path.home() / ".config" / "opencode"
USAGE_FILE = CONFIG_DIR / "provider_usage.json"
CIRCUIT_FILE = CONFIG_DIR / "provider_circuit.json"

KEY_FILES = {
    "groq": CONFIG_DIR / ".groq-key",
    "mistral": CONFIG_DIR / ".mistral-key",
    "google": CONFIG_DIR / ".gemini-key",
    "zhipu": CONFIG_DIR / ".zhipu-key",
    "openrouter": CONFIG_DIR / ".openrouter-key",
    "huggingface": CONFIG_DIR / ".hf-key",
    "novita": CONFIG_DIR / ".novita-key",
    "together": CONFIG_DIR / ".together-key",
}

MODELS = {
    "groq": ["qwen/qwen3.8-27b", "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"],
    "mistral": ["codestral-latest", "mistral-code-latest"],
    "google": ["gemini-2.5-flash", "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"],
    "zhipu": ["glm-4.7-flash", "glm-5.3-flash"],
    "openrouter": ["openrouter/free"],
    "huggingface": ["Qwen/Qwen3-Coder-480B-A35B-Instruct:cheapest", "deepseek-ai/DeepSeek-V4-Flash:cheapest"],
    "novita": ["deepseek-ai/DeepSeek-V4-Flash", "inclusionai/ling-3.0-flash-fin", "inclusionai/ling-3.0-flash-sante"],
    "together": ["moonshotai/Kimi-K2.7-Code", "meta-llama/Llama-4-Maverick"],
}

ENDPOINTS = {
    "groq": "https://api.groq.com/openai/v1/chat/completions",
    "mistral": "https://api.mistral.ai/v1/chat/completions",
    "google": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    "zhipu": "https://api.z.ai/api/paas/v4/chat/completions",
    "openrouter": "https://openrouter.ai/api/v1/chat/completions",
    "huggingface": "https://router.huggingface.co/v1/chat/completions",
    "novita": "https://api.novita.ai/v3/openai/chat/completions",
    "together": "https://api.together.xyz/v1/chat/completions",
}

# ============================================================================
# CIRCUIT BREAKER
# ============================================================================

CIRCUIT_TIMEOUT = 60  # secondes
FAILURE_THRESHOLD = 3


def _load_circuit_state() -> Dict[str, dict]:
    try:
        if CIRCUIT_FILE.exists():
            return json.loads(CIRCUIT_FILE.read_text())
    except Exception:
        pass
    return {p: {"state": "CLOSED", "failures": 0, "last_failure": 0} for p in MODELS.keys()}


def _save_circuit_state(state: Dict[str, dict]) -> None:
    try:
        CIRCUIT_FILE.parent.mkdir(parents=True, exist_ok=True)
        CIRCUIT_FILE.write_text(json.dumps(state))
    except Exception:
        pass


def check_circuit(provider: str) -> bool:
    state = _load_circuit_state().get(provider, {"state": "CLOSED", "failures": 0, "last_failure": 0})
    if state["state"] == "CLOSED":
        return True
    if state["state"] == "OPEN":
        if time.time() - state["last_failure"] > CIRCUIT_TIMEOUT:
            all_state = _load_circuit_state()
            all_state[provider]["state"] = "HALF_OPEN"
            _save_circuit_state(all_state)
            return True
        return False
    return True  # HALF_OPEN


def record_success(provider: str) -> None:
    state = _load_circuit_state()
    if provider in state:
        state[provider]["failures"] = 0
        state[provider]["state"] = "CLOSED"
        _save_circuit_state(state)


def record_failure(provider: str) -> None:
    state = _load_circuit_state()
    if provider in state:
        state[provider]["failures"] = int(state[provider].get("failures", 0)) + 1
        state[provider]["last_failure"] = time.time()
        if state[provider]["failures"] >= FAILURE_THRESHOLD:
            state[provider]["state"] = "OPEN"
        _save_circuit_state(state)


# ============================================================================
# QUOTA TRACKING
# ============================================================================

QUOTA_LIMITS = {
    "groq": 50, "mistral": 30, "zhipu": 20, "openrouter": 30,
    "huggingface": 20, "novita": 30, "together": 20,
}


def _load_usage() -> dict:
    try:
        if USAGE_FILE.exists():
            return json.loads(USAGE_FILE.read_text())
    except Exception:
        pass
    return {}


def _save_usage(usage: dict) -> None:
    try:
        USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        USAGE_FILE.write_text(json.dumps(usage))
    except Exception:
        pass


def check_quota(provider: str, model: str) -> bool:
    usage = _load_usage()
    today = time.strftime("%Y-%m-%d")
    key = f"{provider}:{model}:{today}"
    current = int(usage.get(key, 0))
    limit = QUOTA_LIMITS.get(provider, 20)
    return current < limit


def record_usage(provider: str, model: str) -> None:
    usage = _load_usage()
    today = time.strftime("%Y-%m-%d")
    key = f"{provider}:{model}:{today}"
    usage[key] = int(usage.get(key, 0)) + 1
    _save_usage(usage)


# ============================================================================
# APPELS PROVIDERS
# ============================================================================

def load_key(provider: str) -> Optional[str]:
    key_file = KEY_FILES.get(provider)
    if key_file and key_file.exists():
        try:
            return key_file.read_text().strip()
        except Exception:
            pass
    return None


def call_provider(provider: str, model: str, messages: List[Dict], max_tokens: int = 2048, temperature: float = 0.2) -> Dict:
    """Appel unique vers un provider avec circuit breaker + quota."""
    if not check_circuit(provider):
        raise Exception(f"Circuit breaker OPEN pour {provider} (retry dans {CIRCUIT_TIMEOUT}s)")
    if not check_quota(provider, model):
        raise Exception(f"Quota local dépassé pour {provider}/{model}")
    key = load_key(provider)
    if not key:
        raise Exception(f"Cle {provider} introuvable")

    payload = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": temperature}
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    try:
        resp = requests.post(ENDPOINTS[provider], headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        record_usage(provider, model)
        record_success(provider)
        return resp.json()
    except Exception:
        record_failure(provider)
        raise


def call_groq(model, messages, max_tokens=2048, temperature=0.2):
    return call_provider("groq", model, messages, max_tokens, temperature)


def call_mistral(model, messages, max_tokens=2048, temperature=0.2):
    return call_provider("mistral", model, messages, max_tokens, temperature)


def call_zhipu(model, messages, max_tokens=2048, temperature=0.2):
    return call_provider("zhipu", model, messages, max_tokens, temperature)


def call_openrouter(model, messages, max_tokens=2048, temperature=0.2):
    return call_provider("openrouter", model, messages, max_tokens, temperature)


def call_huggingface(model, messages, max_tokens=2048, temperature=0.2):
    return call_provider("huggingface", model, messages, max_tokens, temperature)


def call_novita(model, messages, max_tokens=2048, temperature=0.2):
    return call_provider("novita", model, messages, max_tokens, temperature)


def call_together(model, messages, max_tokens=2048, temperature=0.2):
    return call_provider("together", model, messages, max_tokens, temperature)


PROVIDER_CALLS = {
    "groq": call_groq, "mistral": call_mistral, "zhipu": call_zhipu,
    "openrouter": call_openrouter, "huggingface": call_huggingface,
    "novita": call_novita, "together": call_together,
}


def detect_provider(model: str) -> Optional[str]:
    for provider, models in MODELS.items():
        if model in models:
            return provider
    if "/" in model:
        prefix = model.split("/")[0].lower()
        if prefix in MODELS:
            return prefix
    return None


def auto_fallback_chat(messages: List[Dict], task_type: str = "code", max_tokens: int = 2048, temperature: float = 0.2) -> Dict:
    """EURINHASH-style: essaie providers dans l'ordre, avec circuit breaker + quota."""
    if task_type == "code":
        order = ["groq", "mistral", "zhipu", "openrouter", "novita", "together"]
    else:
        order = ["groq", "zhipu", "mistral", "openrouter", "novita", "together"]

    last_error = None
    for provider in order:
        if not load_key(provider):
            continue
        if not check_circuit(provider):
            print(f"[circuit] {provider} bloque (Circuit OPEN)", file=sys.stderr)
            continue
        model = MODELS[provider][0] if MODELS[provider] else None
        if not model:
            continue
        try:
            result = PROVIDER_CALLS[provider](model, messages, max_tokens, temperature)
            result["_provider_used"] = provider
            result["_model_used"] = model
            return result
        except Exception as e:
            last_error = e
            print(f"[fallback] {provider} failed: {e}", file=sys.stderr)
            continue

    return {"error": f"All providers failed: {last_error}"}


def extract_content(response: Dict) -> str:
    try:
        if "choices" in response and response["choices"]:
            choice = response["choices"][0]
            if "message" in choice:
                return choice["message"].get("content", "")
            if "text" in choice:
                return choice["text"]
        if "candidates" in response and response["candidates"]:
            return response["candidates"][0]["content"]["parts"][0]["text"]
        return json.dumps(response)
    except Exception:
        return json.dumps(response)


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="HASH Direct Provider Wrapper")
    parser.add_argument("prompt", nargs="?", help="Prompt a envoyer")
    parser.add_argument("--model", "-m", help="Modele specifique")
    parser.add_argument("--provider", "-p", help="Provider specifique")
    parser.add_argument("--task-type", choices=["code", "chat", "auto"], default="auto")
    parser.add_argument("--max-tokens", type=int, default=2048)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--list", action="store_true", help="Lister modeles dispo")
    parser.add_argument("--list-providers", action="store_true", help="Lister providers avec cles")
    parser.add_argument("--json", action="store_true", help="Sortie JSON brute")
    parser.add_argument("--reset-quota", action="store_true", help="Reinitialiser compteurs usage")
    parser.add_argument("--reset-circuit", action="store_true", help="Reinitialiser circuit breakers")
    parser.add_argument("--status", action="store_true", help="Afficher etat quota + circuit")
    args = parser.parse_args()

    if args.reset_quota:
        try:
            USAGE_FILE.unlink(missing_ok=True)
            print("Compteurs de quota reinitialises")
        except Exception as e:
            print(f"Erreur: {e}", file=sys.stderr)
        return

    if args.reset_circuit:
        try:
            CIRCUIT_FILE.unlink(missing_ok=True)
            print("Circuit breakers reinitialises")
        except Exception as e:
            print(f"Erreur: {e}", file=sys.stderr)
        return

    if args.status:
        print("=== Quota tracking ===")
        usage = _load_usage()
        today = time.strftime("%Y-%m-%d")
        for provider in MODELS:
            model = MODELS[provider][0]
            key = f"{provider}:{model}:{today}"
            current = int(usage.get(key, 0))
            limit = QUOTA_LIMITS.get(provider, 20)
            print(f"  {provider}/{model}: {current}/{limit}")
        print()
        print("=== Circuit breakers ===")
        state = _load_circuit_state()
        for provider, s in state.items():
            print(f"  {provider}: {s['state']} (failures={s.get('failures',0)})")
        return

    if args.list:
        print("Modeles disponibles par provider :")
        for provider, models in MODELS.items():
            key_status = "[OK]" if load_key(provider) else "[NO]"
            print(f"  {provider} {key_status}:")
            for m in models:
                print(f"    - {m}")
        return

    if args.list_providers:
        print("Providers configures :")
        for provider, key_file in KEY_FILES.items():
            key = load_key(provider)
            status = "[OK] OK" if key else "[NO] NO KEY"
            print(f"  {provider}: {status} ({key_file})")
        return

    if not args.prompt:
        parser.print_help()
        return

    messages = [{"role": "user", "content": args.prompt}]

    if args.provider:
        if args.provider not in PROVIDER_CALLS:
            print(f"Provider inconnu: {args.provider}", file=sys.stderr)
            sys.exit(1)
        model = args.model or MODELS[args.provider][0]
        try:
            result = PROVIDER_CALLS[args.provider](model, messages, args.max_tokens, args.temperature)
        except Exception as e:
            print(f"Erreur {args.provider}: {e}", file=sys.stderr)
            sys.exit(1)

    elif args.model:
        provider = detect_provider(args.model)
        if not provider:
            print(f"Impossible de detecter le provider pour: {args.model}", file=sys.stderr)
            sys.exit(1)
        try:
            result = PROVIDER_CALLS[provider](args.model, messages, args.max_tokens, args.temperature)
        except Exception as e:
            print(f"Erreur {provider}: {e}", file=sys.stderr)
            sys.exit(1)

    else:
        result = auto_fallback_chat(
            messages,
            task_type=args.task_type,
            max_tokens=args.max_tokens,
            temperature=args.temperature,
        )

    if "error" in result:
        print(f"Erreur: {result['error']}", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        content = extract_content(result)
        provider = result.get("_provider_used", "?")
        model = result.get("_model_used", "?")
        print(f"[{provider}/{model}] {content}")


if __name__ == "__main__":
    main()