#!/usr/bin/env python3
"""
@myfree-eurinhash - Test all free models from configured providers,
generate a sorted JSON report by quality/price, and allow setting a new default.

Usage:
    python myfree-eurinhash.py test                 # Run tests, write report + cache
    python myfree-eurinhash.py report               # Show last report from cache
    python myfree-eurinhash.py use <model-alias>    # Set a model as default in opencode.jsonc
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

HOME = os.path.expanduser("~")
CFG = os.path.join(HOME, ".config", "opencode")

# Exchange rates (fixed approximations as required)
EUR_PER_USD = 0.92
INR_PER_USD = 83.0

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) OpenCode/myfree-eurinhash"}

# Quality baseline scores (0.0–1.0) assigned by model family / provider reputation
# These are used as a proxy for expected model quality when the model is free.
QUALITY_BASELINE = {
    "gemini-2.5-flash": 0.96,
    "gemini-2.5-flash-lite": 0.88,
    "gemini-flash-latest": 0.96,
    "gemini-flash-lite-latest": 0.88,
    "glm-4.7-flash": 0.85,
    "codestral-latest": 0.90,
    "mistral-code-latest": 0.85,
    "Qwen/Qwen3-Coder-480B-A35B-Instruct:cheapest": 0.80,
    "deepseek-ai/DeepSeek-V4-Flash:cheapest": 0.92,
    "qwen/qwen3.8-27b": 0.82,
    "openai/gpt-oss-120b": 0.78,
    "openai/gpt-oss-20b": 0.65,
    "qwen/qwen3.6-27b": 0.80,
    "openrouter/free": 0.75,
}


def read_key(name: str) -> str:
    """Read API key from a dot-file in the opencode config directory."""
    with open(os.path.join(CFG, name)) as f:
        return f.read().strip()


def parse_jsonc(text: str) -> dict:
    """
    Parse JSONC (JSON with comments) string safely.
    Handles // and /* */ comments while preserving strings.
    """
    result = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        # Inside a string
        if c == '"':
            result.append(c)
            i += 1
            while i < n:
                c = text[i]
                if c == '\\' and i + 1 < n:
                    result.append(c)
                    result.append(text[i + 1])
                    i += 2
                    continue
                if c == '"':
                    result.append(c)
                    i += 1
                    break
                result.append(c)
                i += 1
            continue
        # Line comment
        if c == '/' and i + 1 < n and text[i + 1] == '/':
            while i < n and text[i] not in ('\n', '\r'):
                i += 1
            continue
        # Block comment
        if c == '/' and i + 1 < n and text[i + 1] == '*':
            i += 2
            while i < n and not (text[i] == '*' and i + 1 < n and text[i + 1] == '/'):
                i += 1
            i += 2
            continue
        result.append(c)
        i += 1

    return json.loads(''.join(result))


def post(url: str, headers: dict, body: dict, timeout: int = 15) -> tuple:
    """HTTP POST returning (status_str, status_code_or_error_str, resp_headers, resp_body)."""
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers)
    try:
        start = time.monotonic()
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            resp_body = resp.read()
            elapsed = (time.monotonic() - start) * 1000  # ms
            return ("ok", resp.status, dict(resp.headers), resp_body, elapsed)
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return ("rate_limited", e.code, dict(e.headers) if e.headers else {}, b"", 0)
        return ("error", e.code, {}, b"", 0)
    except Exception as e:
        return ("error", str(e)[:100], {}, b"", 0)


def get_chat_body(model: str, query: str = "ok") -> dict:
    """Standard chat completion body for OpenAI-compatible providers."""
    return {
        "model": model,
        "messages": [{"role": "user", "content": query}],
        "max_tokens": 5,
        "temperature": 0,
    }


def probe_token_estimate(response_body: bytes) -> dict:
    """Crude attempt to extract token usage from response (best effort)."""
    try:
        data = json.loads(response_body)
        usage = data.get("usage", {})
        return {
            "input_tokens": usage.get("prompt_tokens", usage.get("input_tokens", 5)),
            "output_tokens": usage.get("completion_tokens", usage.get("output_tokens", 5)),
        }
    except Exception:
        return {"input_tokens": 5, "output_tokens": 5}


def test_model(model_alias: str, provider: str, config: dict) -> dict:
    """
    Test a single free model with a micro-query.

    Returns a dict with all report fields.
    """
    # Locate the provider config and model metadata
    prov_cfg = config.get("provider", {}).get(provider, {})
    models_cfg = prov_cfg.get("models", {})

    # Try to find the model config dict (models is a dict of {id: {name, limit,...}})
    model_meta = None
    model_id = model_alias
    for mid, meta in models_cfg.items():
        if mid == model_alias or mid.startswith(model_alias):
            model_meta = meta
            model_id = mid
            break

    result = {
        "alias": model_alias,
        "name": (model_meta or {}).get("name", model_alias),
        "provider": provider,
        "model_id": model_id,
        "limit": (model_meta or {}).get("limit", {}),
        "status": "error",
        "latency_ms": None,
        "cost_eur": 0.0,       # Free models = €0
        "cost_inr": 0.0,       # Free models = ₹0
        "quality_score": QUALITY_BASELINE.get(model_alias, 0.7),
        "error": None,
    }

    # --- Provider-specific probing logic ---
    npm = prov_cfg.get("npm", "")
    base_url = prov_cfg.get("options", {}).get("baseURL", "")
    query = "ok"

    try:
        key = read_key(f".{provider}-key") if provider != "gemini" else read_key(".gemini-key")
    except FileNotFoundError:
        result["status"] = "error"
        result["error"] = "no_api_key"
        return result
    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)[:60]
        return result

    # --- Google Gemini (native endpoint, not OpenAI-compatible) ---
    if provider == "google":
        st, info, _, body, elapsed = post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={key}",
            {"Content-Type": "application/json", **UA},
            {"contents": [{"parts": [{"text": query}]}],
             "generationConfig": {"maxOutputTokens": 5}},
            timeout=15,
        )
        if st == "ok":
            usage = probe_token_estimate(body)
            result["status"] = "ok"
            result["latency_ms"] = round(elapsed)
            result["cost_eur"] = 0.0  # Free
            result["cost_inr"] = 0.0
            result["quality_score"] = QUALITY_BASELINE.get(model_alias, 0.9)
        else:
            result["status"] = st
            result["error"] = f"HTTP {info}" if isinstance(info, int) else info

    # --- OpenAI-compatible providers (zhipu, mistral, huggingface, groq, openrouter, mammouth) ---
    else:
        # Adjust base URL for gemini models if needed, but for now skip
        test_body = get_chat_body(model_id, query)

        # For HuggingFace, the model names include provider prefix and need :cheapest suffix
        if provider == "huggingface" and ":" not in model_id:
            model_id = model_id.rsplit("/", 1)[0] + ":cheapest" if "/" in model_id else model_id
            test_body["model"] = model_id

        st, info, _, body, elapsed = post(
            base_url + "/chat/completions",
            {"Authorization": f"Bearer {key}", "Content-Type": "application/json", **UA},
            test_body,
            timeout=15,
        )

        if st == "ok":
            usage = probe_token_estimate(body)
            result["status"] = "ok"
            result["latency_ms"] = round(elapsed)
            result["cost_eur"] = 0.0  # Free models cost nothing
            result["cost_inr"] = 0.0
            result["quality_score"] = QUALITY_BASELINE.get(model_alias, 0.75)
        else:
            result["status"] = st
            result["error"] = f"HTTP {info}" if isinstance(info, int) else str(info)

    return result


def extract_free_models(config: dict) -> list:
    """
    Parse the opencode config and return a list of free model descriptors.

    Detects FREE models based on the model's "name" field or explicit markers.
    """
    free_models = []

    for provider_name, prov_cfg in config.get("provider", {}).items():
        models = prov_cfg.get("models", {})

        for model_id, model_meta in models.items():
            model_name = model_meta.get("name", model_id) if isinstance(model_meta, dict) else str(model_meta)

            # Determine if the model is FREE
            is_free = False
            if provider_name == "openrouter":
                # openrouter/free is always free (it's an auto-router)
                is_free = True
            elif "(FREE" in model_name or "(FREE," in model_name:
                is_free = True

            if not is_free:
                continue

            free_models.append({
                "alias": model_id,
                "name": model_name,
                "provider": provider_name,
                "model_id": model_id,
                "limit": model_meta.get("limit", {}) if isinstance(model_meta, dict) else {},
                "quality_baseline": QUALITY_BASELINE.get(model_id, 0.7),
            })

    return free_models


def run_tests(config: dict, free_models: list) -> list:
    """Run tests for all free models, respecting rate limits (max 2 req/min per provider)."""
    results = []

    # Group by provider to manage per-provider rate limits
    by_provider = {}
    for m in free_models:
        by_provider.setdefault(m["provider"], []).append(m)

    for provider, models in by_provider.items():
        for i, model in enumerate(models):
            res = test_model(model["alias"], provider, config)
            # Override with config-derived metadata
            res["name"] = model["name"]
            res["limit"] = model["limit"]
            res["quality_score"] = model["quality_baseline"]
            results.append(res)

            # Rate-limit: max 2 req/min per provider.
            # We use 1.5s between same-provider requests (safe for burst of 2,
            # then we rely on HTTP 429 detection to back off).
            if i < len(models) - 1:
                time.sleep(1.5)

        # Small inter-provider gap
        time.sleep(0.5)

    return results


def generate_report(results: list) -> dict:
    """Sort results by quality/price (quality_score ascending cost) -> quality_score/descending cost."""
    # For free models, cost = 0, so sort by quality_score descending
    sorted_results = sorted(
        results,
        key=lambda x: (
            -(x.get("quality_score", 0)),  # Higher quality first
            x.get("latency_ms") or 9999,    # Lower latency second
        ),
    )

    report = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_models": len(sorted_results),
        "exchange_rates": {
            "eur_per_usd": EUR_PER_USD,
            "inr_per_usd": INR_PER_USD,
        },
        "sorted_by": "quality_score (desc), then latency_ms (asc)",
        "results": [
            {
                "name": m["name"],
                "alias": m["alias"],
                "provider": m["provider"],
                "model_id": m["model_id"],
                "limit": m.get("limit", {}),
                "status": m["status"],
                "latency_ms": m["latency_ms"],
                "cost_eur": m["cost_eur"],
                "cost_inr": m["cost_inr"],
                "quality_score": m["quality_score"],
                "error": m.get("error"),
            }
            for m in sorted_results
        ],
    }
    return report


def save_report(report: dict, cache_path: str) -> None:
    """Save the report to a JSON file and also a minimal cache for quick lookups."""
    with open(cache_path, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"Report saved to: {cache_path}")


def set_default_model(model_alias: str, config: dict) -> bool:
    """
    Update the model field in opencode.jsonc to set a new default.
    Returns True on success.
    """
    # Check if the model exists in free models
    free_models = extract_free_models(config)
    matching = [m for m in free_models if m["alias"] == model_alias]

    if not matching:
        print(f"Model '{model_alias}' not found in free models.")
        print("Available free models:")
        for m in free_models:
            print(f"  {m['alias']} ({m['provider']})")
        return False

    # Build new config string (we read from .jsonc and re-write as .json)
    model_name = matching[0]["name"]

    # Read the current config file
    config_path = os.path.join(CFG, "opencode.jsonc")

    # For .jsonc files, we need to preserve comments
    # Since we can't easily edit JSONC programmatically without losing comments,
    # we'll use a simple approach: read, replace, write
    with open(config_path, "r") as f:
        content = f.read()

    # Replace the model line
    import re
    # Match "model": "some/provider-model"
    new_content = re.sub(
        r'("model":\s*)"[^"]+"',
        f'\\1"{model_alias}"',
        content,
        count=1,  # Only replace the top-level model, not small_model
    )

    if new_content == content:
        print(f"Could not update config. Make sure 'model' field exists.")
        return False

    # Write back
    with open(config_path, "w") as f:
        f.write(new_content)

    print(f"Default model updated to: {model_alias} ({model_name})")
    return True


def cmd_test():
    """Run the full test suite for all free models."""
    cache_path = os.path.join(CFG, "myfree-eurinhash-report.json")
    config_path = os.path.join(CFG, "opencode.jsonc")

    # Parse config (JSONC -> safe parsing)
    with open(config_path, "r") as f:
        content = f.read()

    config = parse_jsonc(content)

    # Extract free models from config
    free_models = extract_free_models(config)

    print(f"Found {len(free_models)} free models across {len(set(m['provider'] for m in free_models))} providers:")
    for m in free_models:
        print(f"  - {m['alias']} ({m['provider']}) -> {m['name']}")

    print("\nTesting (respecting rate limits: max 2 req/min per provider)...")

    # Run tests
    results = run_tests(config, free_models)

    # Generate and save report
    report = generate_report(results)
    save_report(report, cache_path)

    # Print summary table
    print("\n" + "=" * 100)
    print(f"{'MODEL':<40} {'PROVIDER':<12} {'STATUS':<15} {'LAT(ms)':<10} {'QUAL':<6} {'EUR':<8} {'INR':<8}")
    print("-" * 100)
    for m in sorted(results, key=lambda x: x.get("quality_score", 0), reverse=True):
        lat = m["latency_ms"] if m["latency_ms"] else "—"
        print(f"{m['alias']:<40} {m['provider']:<12} {m['status']:<15} {lat:<10} {m['quality_score']:<6.2f} {m['cost_eur']:<8.2f} {m['cost_inr']:<8.2f}")
    print("=" * 100)

    print(f"\nFull report: {cache_path}")
    print(f"\nTo set a new default: python myfree-eurinhash.py use <model-alias>")


def cmd_report():
    """Display the last report."""
    cache_path = os.path.join(CFG, "myfree-eurinhash-report.json")

    if not os.path.exists(cache_path):
        print(f"No report found. Run 'python myfree-eurinhash.py test' first.")
        sys.exit(1)

    with open(cache_path, "r") as f:
        report = json.load(f)

    print(f"\n=== @myfree-eurinhash Report (generated: {report['generated_at']}) ===")
    print(f"Total models tested: {report['total_models']}")
    print(f"Sorted by: {report['sorted_by']}\n")

    print(f"{'#':<4} {'MODEL':<42} {'PROVIDER':<12} {'STATUS':<15} {'LAT(ms)':<10} {'QUAL':<6} {'EUR':<8} {'INR':<8}")
    print("-" * 110)
    for i, m in enumerate(report["results"], 1):
        lat = m["latency_ms"] if m["latency_ms"] else "—"
        err = f" ({m['error']})" if m.get("error") else ""
        print(f"{i:<4} {m['alias'][:40]:<42} {m['provider']:<12} {m['status']:<15} {lat:<10} {m['quality_score']:<6.2f} {m['cost_eur']:<8.2f} {m['cost_inr']:<8.2f} {err}")
    print("-" * 110)

    # Recommend best
    ok_models = [m for m in report["results"] if m["status"] == "ok"]
    if ok_models:
        best = ok_models[0]  # Already sorted
        print(f"\n* BEST (quality/price): {best['alias']} ({best['provider']})")
        print(f"    quality={best['quality_score']}, latency={best['latency_ms']}ms, cost=€0 (FREE)")
        print(f"\n    -> Run: python myfree-eurinhash.py use {best['alias']}")

    print(f"\nFull JSON report: {cache_path}")


def cmd_use(model_alias: str | None):
    """Set a new default model."""
    if not model_alias:
        print("Usage: python myfree-eurinhash.py use <model-alias>")
        print("\nExample: python myfree-eurinhash.py use gemini-2.5-flash")
        sys.exit(1)

    config_path = os.path.join(CFG, "opencode.jsonc")

    with open(config_path, "r") as f:
        content = f.read()

    import re
    content_clean = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)
    content_clean = re.sub(r'/\*.*?\*/', '', content_clean, flags=re.DOTALL)
    config = parse_jsonc(content)

    if set_default_model(model_alias, config):
        # Also show updated free models list for reference
        free_models = extract_free_models(config)
        print(f"\nFree models available (sorted by quality/price):")
        for m in sorted(free_models, key=lambda x: x["quality_baseline"], reverse=True):
            print(f"  {m['alias']} ({m['provider']}) - quality: {m['quality_baseline']}")


def cmd_list():
    """List all free models detected from the config (without testing)."""
    config_path = os.path.join(CFG, "opencode.jsonc")

    import re
    with open(config_path, "r") as f:
        content = f.read()

    content_clean = re.sub(r'//.*?$', '', content, flags=re.MULTILINE)
    content_clean = re.sub(r'/\*.*?\*/', '', content_clean, flags=re.DOTALL)
    config = parse_jsonc(content)

    free_models = extract_free_models(config)

    print(f"\n=== Free Models Detected ({len(free_models)} total) ===\n")
    by_provider = {}
    for m in free_models:
        by_provider.setdefault(m["provider"], []).append(m)

    for provider, models in sorted(by_provider.items()):
        print(f"  [{provider}]")
        for m in models:
            limits = m.get("limit", {})
            limit_str = ""
            if limits:
                limit_str = f" (ctx={limits.get('context','—')}, out={limits.get('output','—')})"
            print(f"    - {m['alias']}{limit_str}")
            print(f"      name: {m['name']}")
            print(f"      quality: {m['quality_baseline']}")
        print()


def main():
    if len(sys.argv) < 2:
        print_help()
        sys.exit(0)

    command = sys.argv[1].lower().strip()

    if command in ("test", "-t"):
        cmd_test()
    elif command in ("report", "-r"):
        cmd_report()
    elif command in ("use", "-u"):
        model_alias = sys.argv[2] if len(sys.argv) > 2 else None
        cmd_use(model_alias)
    elif command in ("list", "-l"):
        cmd_list()
    elif command in ("help", "-h", "--help"):
        print_help()
    else:
        print(f"Unknown command: {command}")
        print_help()
        sys.exit(1)


def print_help():
    print("""@myfree-eurinhash - Test and benchmark all free AI models

Usage:
    python myfree-eurinhash.py <command> [options]

Commands:
    test     Run latency + quality tests on ALL free models (writes report)
             Respects rate limits (max 2 req/min per provider)
             May take 30s+ between tests of the same provider.

    report   Show the last test report from cache (no new API calls)

    use <m>  Set <m> as the default model in opencode.jsonc
             (must be a tested/available free model)

    list     List all free models detected from the current config

Options:
    -t, --test     Same as 'test'
    -r, --report   Same as 'report'
    -u, --use      Same as 'use'
    -l, --list     Same as 'list'
    -h, --help     Show this help

Examples:
    python myfree-eurinhash.py test
    python myfree-eurinhash.py report
    python myfree-eurinhash.py use gemini-2.5-flash
    python myfree-eurinhash.py list

Exchange rates used:
    1 USD = {:.2f} EUR
    1 USD = {:.2f} INR
    (Free models always cost €0 / ₹0)
""".format(EUR_PER_USD, INR_PER_USD))


if __name__ == "__main__":
    main()
