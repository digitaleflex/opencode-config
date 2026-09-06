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
import threading
import itertools
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

# ============================================================================
# CLI PROGRESS UX
# ============================================================================

# Detect NO_COLOR env var
NO_COLOR = os.environ.get("NO_COLOR") is not None

# Windows ANSI enable
if os.name == "nt":
    os.system("")

def _c(code: str, text: str, enabled: bool) -> str:
    """Color helper"""
    return f"\033[{code}m{text}\033[0m" if enabled else text

def _dim(text: str) -> str:
    return _c("90", text, not NO_COLOR)

def _info(text: str) -> str:
    return _c("36", text, not NO_COLOR)

def _ok(text: str) -> str:
    return _c("32", text, not NO_COLOR)

def _warn(text: str) -> str:
    return _c("33", text, not NO_COLOR)

def _err(text: str) -> str:
    return _c("31", text, not NO_COLOR)

def _bold(text: str) -> str:
    return _c("1", text, not NO_COLOR)

def _unicode_ok() -> bool:
    """Check if terminal supports Unicode"""
    try:
        encoding = sys.stdout.encoding or ""
        if "UTF-8" in encoding.upper():
            return True
    except Exception:
        pass
    return False

# Spinner implementation
_SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
_ASCII_SPINNER = ["|", "/", "-", "\\"]

class Spinner:
    """Thread-based spinner for long operations"""
    def __init__(self, text: str, enabled: bool, color_fn=None):
        self.text = text
        self.enabled = enabled and sys.stderr.isatty()
        self.color_fn = color_fn or _dim
        self._stop = threading.Event()
        self._thread = None
        self.frames = _SPINNER if _unicode_ok() else _ASCII_SPINNER

    def __enter__(self):
        if not self.enabled:
            return self
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        return self

    def _run(self):
        for f in itertools.cycle(self.frames):
            if self._stop.is_set():
                break
            sys.stderr.write(f"\r{self.color_fn(self.text + ' ' + f)}")
            sys.stderr.flush()
            time.sleep(0.08)

    def __exit__(self, *args):
        if not self.enabled or not self._thread:
            return
        self._stop.set()
        self._thread.join()
        sys.stderr.write("\r" + " " * (len(self.text) + 4) + "\r")
        sys.stderr.flush()

def _humanize_error(exc: Exception) -> str:
    """Convert raw errors to friendly human-readable messages"""
    exc_str = str(exc)
    
    # Extract status code if present
    import re
    status_code = None
    status_match = re.search(r'(\d{3})', exc_str)
    if status_match:
        status_code = status_match.group(1)
    
    # Mapping table
    if status_code == "429":
        return "❌ Rate limited (429) → Je bascule..."
    elif status_code in ("401", "403"):
        return "❌ Clé API refusée → Je bascule..."
    elif status_code == "404":
        return "❌ Modèle introuvable → Je bascule..."
    elif "timeout" in exc_str.lower() or "Timeout" in exc_str:
        return "❌ Délai dépassé → Je bascule..."
    elif "circuit breaker" in exc_str.lower() and "OPEN" in exc_str:
        return "⏸️  En pause (circuit ouvert) → Je réessaie plus tard"
    elif "quota" in exc_str.lower() and "local" in exc_str.lower():
        return "⏸️  Quota du jour atteint → Je bascule..."
    elif "Cle" in exc_str and "introuvable" in exc_str:
        return "⛔ Clé non configurée → Ignoré"
    elif "ConnectionError" in exc_str or "network" in exc_str.lower():
        return "❌ Réseau inaccessible → Je bascule..."
    else:
        return "❌ Erreur inattendue → Je bascule..."

class CliProgress:
    """Friendly CLI progress UX for hash-direct.py"""
    
    def __init__(self, enabled: bool = False, color: bool = True, verbose: bool = False):
        self.enabled = enabled
        self.color = color and not NO_COLOR
        self.verbose = verbose
        self._chain = []
        self._fallback_path = []
        self._start_time = None
        
    def phase(self, name: str, text: str, min_duration: float = 0.3):
        """Start a new phase - returns context manager"""
        return PhaseContextManager(self, name, text, min_duration)
    
    def chain_result(self, provider: str, ok: bool, error=None, elapsed_ms: int = 0):
        """Record the result of a provider attempt"""
        if not self.enabled:
            return
            
        is_last = len(self._chain) == 0
        
        if ok:
            icon = "✅"
            status = f"Prêt ! ({provider})"
            branch = "└─" if is_last else "├─"
            timing = f"    {elapsed_ms/1000:.1f}s" if elapsed_ms and elapsed_ms > 500 else ""
            line = f"   {branch} {provider:<10}{icon} {status}{timing}"
            print(_dim(line))
        else:
            error_msg = _humanize_error(error) if error else "❌ Erreur inattendue → Je bascule..."
            branch = "└─" if is_last else "├─"
            timing = f"    {elapsed_ms/1000:.1f}s" if elapsed_ms and elapsed_ms > 500 else ""
            line = f"   {branch} {provider:<10}❌ {error_msg}{timing}"
            print(_dim(line))
            
            # Verbose mode: show raw error
            if self.verbose and error:
                raw_error = f"       ↳ {error}"
                print(_dim(raw_error))
        
        self._chain.append((provider, ok, error))
    
    def thinking(self, min_duration: float = 0.5):
        """Show thinking phase - returns context manager"""
        return ThinkingContextManager(self, min_duration)
    
    def generating(self, min_duration: float = 0.5):
        """Show generating phase - returns context manager"""
        return GeneratingContextManager(self, min_duration)
    
    def present_result(self, content: str, provider: str, model: str, elapsed_ms: int, fallback_path: List[str]):
        """Present final result with box"""
        if not self.enabled:
            # Fallback to original behavior
            print(f"[{provider}/{model}] {content}")
            return
            
        # Header
        header = f"🎯 RÉSULTAT  ({provider}/{model} · {elapsed_ms/1000:.1f}s)"
        print()
        print(_bold(_ok("━" * 60)))
        print(_bold(_ok(header)))
        print(_bold(_ok("━" * 60)))
        print()
        
        # Content
        print(content)
        
        # Footer with fallback path
        if fallback_path and len(fallback_path) > 1:
            print()
            print(_dim(f"    ↳ Routé via fallback ({' → '.join(fallback_path)})"))
        
        # Bottom border
        print(_bold(_ok("━" * 60)))
        print()
    
    def present_failure(self, last_error: Exception):
        """Present failure when all providers fail"""
        if not self.enabled:
            # Fallback to original behavior
            print(f"Erreur: {last_error}", file=sys.stderr)
            sys.exit(1)
            
        print()
        print(_bold(_err("━" * 60)))
        print(_bold(_err("⛔  Tous les providers ont échoué")))
        print(_bold(_err("━" * 60)))
        print()
        print(_err("   Impossible de générer une réponse."))
        print()
        print(_dim("    💡 Astuce : réessayez dans 1 minute, ou lancez"))
        print(_dim("       `python ~/.config/opencode/scripts/hash-direct.py --status`"))
        print(_dim("       pour voir l'état des providers."))
        print()
        
        # Show last error if stderr is a TTY
        if sys.stderr.isatty():
            print(_bold(_err("━" * 60)))
            print(_dim(f"    ↳ Dernière erreur technique : {last_error}"))
            print(_bold(_err("━" * 60)))
        
        print()
        sys.exit(1)
    
    def line(self, text: str, level: str = "dim"):
        """Output a line at specified level"""
        if not self.enabled:
            return
            
        if level == "dim":
            print(_dim(text))
        elif level == "info":
            print(_info(text))
        elif level == "ok":
            print(_ok(text))
        elif level == "warn":
            print(_warn(text))
        elif level == "err":
            print(_err(text))
        else:
            print(text)

class PhaseContextManager:
    """Context manager for phases"""
    def __init__(self, progress: CliProgress, name: str, text: str, min_duration: float):
        self.progress = progress
        self.name = name
        self.text = text
        self.min_duration = min_duration
        self.start_time = None
        self.elapsed = 0
    
    def __enter__(self):
        if not self.progress.enabled:
            return self
        self.start_time = time.time()
        return self
    
    def __exit__(self, *args):
        if not self.progress.enabled or not self.start_time:
            return
        self.elapsed = time.time() - self.start_time
        if self.elapsed < self.min_duration:
            time.sleep(self.min_duration - self.elapsed)
        if self.name == "init":
            self.progress.line("   ✓ Clés chargées (8 providers)", "dim")
            self.progress.line("   ✓ Quotas vérifiés", "dim")

class ThinkingContextManager:
    """Context manager for thinking phase"""
    def __init__(self, progress: CliProgress, min_duration: float):
        self.progress = progress
        self.min_duration = min_duration
        self.start_time = None
        self.spinner = None
    
    def __enter__(self):
        if not self.progress.enabled:
            return self
        self.start_time = time.time()
        if self.min_duration > 0:
            self.progress.line("   💭 Je réfléchis à votre question...", "info")
        return self
    
    def __exit__(self, *args):
        if not self.progress.enabled or not self.start_time:
            return
        elapsed = time.time() - self.start_time
        if elapsed < self.min_duration and self.spinner:
            self.spinner.__exit__()

class GeneratingContextManager:
    """Context manager for generating phase"""
    def __init__(self, progress: CliProgress, min_duration: float):
        self.progress = progress
        self.min_duration = min_duration
        self.start_time = None
        self.spinner = None
    
    def __enter__(self):
        if not self.progress.enabled:
            return self
        self.start_time = time.time()
        if self.min_duration > 0:
            self.progress.line("   📝 Génération de la réponse...", "info")
        return self
    
    def __exit__(self, *args):
        if not self.progress.enabled or not self.start_time:
            return
        elapsed = time.time() - self.start_time
        if elapsed < self.min_duration and self.spinner:
            self.spinner.__exit__()

# ============================================================================
# CHEMINS
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


def auto_fallback_chat(messages: List[Dict], task_type: str = "code", max_tokens: int = 2048, temperature: float = 0.2, progress: Optional["CliProgress"] = None) -> Dict:
    """EURINHASH-style: essaie providers dans l'ordre, avec circuit breaker + quota."""
    if task_type == "code":
        order = ["groq", "mistral", "zhipu", "openrouter", "novita", "together"]
    else:
        order = ["groq", "zhipu", "mistral", "openrouter", "novita", "together"]

    # Build chain order of providers that actually have keys
    chain_order = [p for p in order if load_key(p)]

    last_error = None
    for idx, provider in enumerate(chain_order):
        is_last_in_chain = (idx == len(chain_order) - 1)
        
        if not check_circuit(provider):
            if progress:
                progress.chain_result(provider, ok=False, error="Circuit breaker OPEN", elapsed_ms=0)
            else:
                print(f"[circuit] {provider} bloque (Circuit OPEN)", file=sys.stderr)
            continue
        model = MODELS[provider][0] if MODELS[provider] else None
        if not model:
            continue
        _t0 = time.time()
        try:
            result = PROVIDER_CALLS[provider](model, messages, max_tokens, temperature)
            _elapsed_ms = int((time.time() - _t0) * 1000)
            result["_provider_used"] = provider
            result["_model_used"] = model
            
            # Track fallback path
            if progress and progress.enabled:
                progress._fallback_path.append(provider)
            
            if progress:
                progress.chain_result(provider, ok=True, elapsed_ms=_elapsed_ms)
            
            return result
        except Exception as e:
            last_error = e
            _elapsed_ms = int((time.time() - _t0) * 1000) if '_t0' in dir() else 0
            if progress:
                progress.chain_result(provider, ok=False, error=e, elapsed_ms=_elapsed_ms)
            else:
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
    parser.add_argument("--batch", help="Fichier contenant un prompt par ligne")
    parser.add_argument("--output", help="Fichier de sortie JSON (avec --batch)")
    # UX Progress flags
    parser.add_argument("--progress", "-P", action="store_true", help="Activer l'interface de progression amicale")
    parser.add_argument("--verbose", "-V", action="store_true", help="Avec --progress, afficher erreurs brutes (stderr)")
    parser.add_argument("--no-color", action="store_true", help="Desactiver les couleurs ANSI")
    parser.add_argument("--force-color", action="store_true", help="Forcer les couleurs meme sans TTY")
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

    # Determine if colors should be enabled
    use_color = not args.no_color
    if args.force_color:
        use_color = True
    elif not sys.stdout.isatty() and not args.force_color:
        use_color = False
    
    # Create progress object
    progress = CliProgress(enabled=args.progress, color=use_color, verbose=args.verbose)
    
    if args.reset_quota:
        try:
            USAGE_FILE.unlink(missing_ok=True)
            progress.line("Compteurs de quota reinitialises", "ok")
        except Exception as e:
            progress.line(f"Erreur: {e}", "err")
        return

    if args.reset_circuit:
        try:
            CIRCUIT_FILE.unlink(missing_ok=True)
            progress.line("Circuit breakers reinitialises", "ok")
        except Exception as e:
            progress.line(f"Erreur: {e}", "err")
        return

    if args.status:
        progress.phase("status", "=== Quota tracking ===")
        usage = _load_usage()
        today = time.strftime("%Y-%m-%d")
        for provider in MODELS:
            model = MODELS[provider][0]
            key = f"{provider}:{model}:{today}"
            current = int(usage.get(key, 0))
            limit = QUOTA_LIMITS.get(provider, 20)
            progress.line(f"  {provider}/{model}: {current}/{limit}", "dim")
        progress.line("", "dim")
        progress.line("=== Circuit breakers ===", "dim")
        state = _load_circuit_state()
        for provider, s in state.items():
            status = _ok(f"{s['state']}") if s['state'] == 'CLOSED' else _err(s['state'])
            progress.line(f"  {provider}: {status} (failures={s.get('failures',0)})", "dim")
        return

    if args.list:
        progress.line("Modeles disponibles par provider :", "info")
        for provider, models in MODELS.items():
            key_status = _ok("[OK]") if load_key(provider) else _err("[NO]")
            progress.line(f"  {provider} {key_status}:", "dim")
            for m in models:
                progress.line(f"    - {m}", "dim")
        return

    if args.list_providers:
        progress.line("Providers configures :", "info")
        for provider, key_file in KEY_FILES.items():
            key = load_key(provider)
            status = _ok("[OK] OK") if key else _err("[NO] NO KEY")
            progress.line(f"  {provider}: {status} ({key_file})", "dim")
        return

    # Handle batch mode
    if args.batch:
        if not os.path.exists(args.batch):
            progress.line(f"Erreur: fichier batch {args.batch} introuvable", "err")
            sys.exit(1)
        
        with open(args.batch, 'r', encoding='utf-8') as f:
            prompts = [line.strip() for line in f if line.strip()]
        
        if not prompts:
            progress.line("Erreur: fichier batch vide", "err")
            sys.exit(1)
        
        # Batch initialization
        with progress.phase("init", "🚀 Initialisation du système", 0.2):
            pass
        progress.line(f"   ✓ Clés chargées ({len([p for p in MODELS if load_key(p)])} providers)", "dim")
        progress.line(f"   ✓ Quotas vérifiés", "dim")
        
        results = []
        total = len(prompts)
        fallback_count = 0
        
        for i, prompt in enumerate(prompts):
            # Progress bar for batch
            pct = (i + 1) / total * 100
            bar_len = 20
            filled = int(bar_len * (i + 1) / total)
            bar = "█" * filled + "░" * (bar_len - filled)
            progress.line(f"\n📦 Traitement batch ({i+1}/{total}) {bar} {pct:.0f}%", "info")
            
            messages = [{"role": "user", "content": prompt}]
            
            if args.provider:
                if args.provider not in PROVIDER_CALLS:
                    progress.line(f"Provider inconnu: {args.provider}", "err")
                    sys.exit(1)
                model = args.model or MODELS[args.provider][0]
                try:
                    result = PROVIDER_CALLS[args.provider](model, messages, args.max_tokens, args.temperature)
                    if "error" not in result:
                        results.append(result)
                    else:
                        fallback_count += 1
                except Exception as e:
                    progress.line(f"   ❌ {args.provider}: {_humanize_error(e)}", "err")
                    fallback_count += 1
                    sys.exit(1)
            elif args.model:
                provider = detect_provider(args.model)
                if not provider:
                    progress.line(f"Impossible de detecter le provider pour: {args.model}", "err")
                    sys.exit(1)
                try:
                    result = PROVIDER_CALLS[provider](args.model, messages, args.max_tokens, args.temperature)
                    if "error" not in result:
                        results.append(result)
                    else:
                        fallback_count += 1
                except Exception as e:
                    progress.line(f"   ❌ {provider}: {_humanize_error(e)}", "err")
                    fallback_count += 1
                    sys.exit(1)
            else:
                result = auto_fallback_chat(
                    messages,
                    task_type=args.task_type,
                    max_tokens=args.max_tokens,
                    temperature=args.temperature,
                    progress=progress,
                )
                if "error" in result:
                    fallback_count += 1
                else:
                    results.append(result)
            
            if args.json or args.output:
                if "error" in result:
                    result["_error_prompt"] = prompt
                results.append(result)
        
        if args.json or args.output:
            output_data = {
                "batch_file": args.batch,
                "timestamp": int(time.time()),
                "prompts_count": total,
                "results": results
            }
            output_text = json.dumps(output_data, indent=2, ensure_ascii=False)
            if args.output:
                with open(args.output, 'w', encoding='utf-8') as f:
                    f.write(output_text)
                progress.line(f"Résultats batch sauvegardés dans: {args.output}", "ok")
            else:
                print(output_text)
        else:
            for i, result in enumerate(results):
                if "_response" in result:
                    provider = result.get("_provider_used", "?")
                    model = result.get("_model_used", "?")
                    progress.line(f"   [{i+1}] [{provider}/{model}] {result['_response']}", "ok")
                elif "_error" in result:
                    prompt_text = result.get('_error_prompt', f'prompt {i+1}')
                    progress.line(f"   [{i+1}] ❌ ERREUR: {prompt_text}", "err")
        
        progress.line(f"\n✅ Batch terminé · {total} prompts · {fallback_count} fallback", "ok")
        return

    if not args.prompt:
        parser.print_help()
        return

    # === MAIN EXECUTION with UX phases ===
    messages = [{"role": "user", "content": args.prompt}]
    
    if args.provider:
        # Direct provider call (no fallback needed)
        if args.provider not in PROVIDER_CALLS:
            progress.line(f"Provider inconnu: {args.provider}", "err")
            sys.exit(1)
        model = args.model or MODELS[args.provider][0]
        
        with progress.phase("init", "🚀 Initialisation du système", 0.2):
            pass
        progress.line("   ✓ Clés chargées", "dim")
        progress.line(f"   ✓ Provider: {args.provider}", "dim")
        
        _t0 = time.time()
        try:
            result = PROVIDER_CALLS[args.provider](model, messages, args.max_tokens, args.temperature)
            _elapsed = int((time.time() - _t0) * 1000)
            content = extract_content(result)
            progress.phase("result", "🎯 RÉSULTAT", 0.2)
            progress.present_result(content, args.provider, model, _elapsed, [args.provider])
        except Exception as e:
            progress.present_failure(e)

    elif args.model:
        provider = detect_provider(args.model)
        if not provider:
            progress.line(f"Impossible de detecter le provider pour: {args.model}", "err")
            sys.exit(1)
        
        with progress.phase("init", "🚀 Initialisation du système", 0.2):
            pass
        progress.line("   ✓ Clés chargées", "dim")
        progress.line(f"   ✓ Model: {args.model}", "dim")
        
        _t0 = time.time()
        try:
            result = PROVIDER_CALLS[provider](args.model, messages, args.max_tokens, args.temperature)
            _elapsed = int((time.time() - _t0) * 1000)
            content = extract_content(result)
            progress.present_result(content, provider, args.model, _elapsed, [provider])
        except Exception as e:
            progress.present_failure(e)

    else:
        # Auto fallback with UX phases
        with progress.phase("init", "🚀 Initialisation du système", 0.2):
            pass
        progress.line("   ✓ Clés chargées", "dim")
        progress.line("   ✓ Quotas vérifiés", "dim")
        
        with progress.phase("search", "🔍 Recherche d'un provider disponible...", 0.3):
            pass
        
        _t0 = time.time()
        result = auto_fallback_chat(
            messages,
            task_type=args.task_type,
            max_tokens=args.max_tokens,
            temperature=args.temperature,
            progress=progress,
        )
        total_elapsed = int((time.time() - _t0) * 1000)
        
        if "error" in result:
            # All providers failed
            last_error = Exception(result.get("error", "Unknown error"))
            progress.present_failure(last_error)
        else:
            content = extract_content(result)
            provider = result.get("_provider_used", "?")
            model = result.get("_model_used", "?")
            
            # Thinking and generating phases
            with progress.phase("thinking", "💭 Je réfléchis à votre question...", 0.5):
                pass
            
            with progress.phase("generating", "📝 Génération de la réponse...", 0.5):
                pass
            
            # Present result
            fallback_path = progress._fallback_path if progress.enabled else [provider]
            progress.present_result(content, provider, model, total_elapsed, fallback_path)

    # Handle JSON output (no UX decoration)
    if args.json and "result" in dir():
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()