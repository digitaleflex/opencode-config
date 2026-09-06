# UX Design: Friendly CLI Progress for `hash-direct.py`

**Date:** 2026-09-06
**Author:** @designer
**For:** @fixer (implementation)
**Status:** Approved for build

---

## 1. Problem Statement

The current CLI output of `hash-direct.py` exposes raw technical errors to the user:

```
[fallback] groq failed: 429
[fallback] zhipu failed: Connection timeout
[circuit] mistral bloque (Circuit OPEN)
```

This creates three UX failures:
1. **Anxious users** — seeing `429`, `Connection timeout`, `Circuit OPEN` feels like a system failure even when fallback works.
2. **No progress feedback** — the user has no idea if the system is alive, thinking, or hung.
3. **No visual hierarchy** — system chatter is mixed with results, so the eye can't find the answer.

**Goal:** turn the CLI into a calm, guided experience where the user *sees* the fallback chain happen, *understands* why a provider is skipped, and is clearly delivered the final answer.

---

## 2. Design Principles

| Principle | Application |
|---|---|
| **Calm by default** | Default mode is silent (no progress) — only `--progress`/`-P` opts in. |
| **One story per screen** | Each phase prints a single line, then waits. No spam. |
| **Honest, not theatrical** | We say "Provider saturé" not "Le système est tombé". Real, reassuring. |
| **Failures stay technical in `--json` / logs** | Friendly mode is for humans; raw errors are still preserved on stderr for debugging. |
| **Unicode-only when supported** | Detect terminal capability, fall back to ASCII (`|/-\`) if `LANG`/Windows cp1252 fails. |

---

## 3. Visual Language

### 3.1 Color palette (ANSI 256)

| Token | Color | Usage |
|---|---|---|
| `DIM` | `\033[90m` (bright black) | System chatter, timestamps, indent guides |
| `INFO` | `\033[36m` (cyan) | Search/progress info, neutral status |
| `OK` | `\033[32m` (green) | Success: provider ready, final result header |
| `WARN` | `\033[33m` (yellow) | Soft warning: rate-limited, retrying |
| `ERR` | `\033[31m` (red) | Hard error, all providers failed |
| `BOLD` | `\033[1m` | Final result label, headlines |
| `RESET` | `\033[0m` | Always end colored runs |

On Windows with `os.name == "nt"`, call `os.system("")` once at startup to enable ANSI in `cmd.exe`. (Already partially handled by the existing `io.TextIOWrapper` block.)

### 3.2 Emoji vocabulary

| Emoji | Meaning |
|---|---|
| 🚀 | Bootstrap / init |
| 🔍 | Searching for a provider |
| ⏳ | Loading / waiting on a request |
| ✅ | Success / ready |
| ❌ | Provider failed (we keep going) |
| 🔄 | Switching to next provider |
| 💭 | Thinking / generating |
| 📝 | Writing final answer |
| 🎯 | Result ready |
| ⛔ | Total failure (no providers left) |
| ⏸️ | Paused (circuit breaker open) |
| 💡 | Hint / tip |

### 3.3 Spinner frames

Unicode (primary): `⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏` (Braille dots — 80ms per frame).

ASCII fallback: `| / - \`.

### 3.4 Box-drawing characters

`─` (light horizontal), `━` (heavy, for final separator), `├─` `└─` (tree branches for the fallback chain).

---

## 4. UX Flow (the five phases)

Every run of `hash-direct.py --progress` follows this 5-phase narrative.

### Phase 1 — Boot (`🚀 Initialisation...`)

```
🚀 Initialisation du système...
   ✓ Clés chargées (6 providers)
   ✓ Quotas vérifiés
```

*One line, then a couple of quiet `dim` checks.* Shown only if boot takes >300ms (otherwise skip — feels snappy).

### Phase 2 — Provider search (`🔍 Recherche...`)

This is the **most important phase**: the user *sees* the fallback chain unfold.

```
🔍 Recherche d'un provider disponible...
   ├─ groq      ⏳ Vérification...    0.8s
   ├─ groq      ❌ Rate limited (429) → Je bascule...
   ├─ mistral   ⏳ Vérification...    0.4s
   ├─ mistral   ⏳ Modèle en cours de chargement...
   └─ mistral   ✅ Prêt ! (codestral-latest)
```

**Rules for the tree:**
- `├─` for every line except the last
- `└─` for the final successful line
- Lines are emitted **after** the request resolves, never speculative ("tentative en cours" is shown only with a spinner).
- Time spent shown only when >500ms (avoid noise).
- The "Je bascule..." message always follows a `❌` so the user knows we haven't given up.

### Phase 3 — Thinking (`💭 Je réfléchis...`)

```
💭 Je réfléchis à votre question...
   ✓ Prompt analysé (148 caractères)
   ✓ Contexte chargé
```

For simple requests this should be near-instant (<200ms) — in that case, **skip the line entirely**. Only show when generation >500ms.

While waiting, animate a single-line spinner: `💭 Je réfléchis... ⠹` (in-place via `\r`).

### Phase 4 — Generation (`📝 Génération...`)

Same template as Phase 3, with `📝 Génération de la réponse...`. Spinner if it takes >500ms.

For `--batch` mode, replace with a progress bar:

```
📦 Traitement batch (3/12) ████████░░░░░░░░░░░░  67%
   ├─ [3] groq/qwen3.8-27b ✓ (1.2s)
   ├─ [4] mistral/codestral-latest ✓ (0.8s)
   └─ [5] ⏳ zhipu/glm-4.7-flash ...
```

### Phase 5 — Result presentation (`🎯 RÉSULTAT`)

Always end on a clear, predictable box. The user knows exactly where the answer is.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 RÉSULTAT  (mistral/codestral-latest · 1.4s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Voici la réponse à votre question.

Elle contient du texte long, formaté naturellement
sans bordures ni décoration excessive.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- Header is `BOLD + OK` (green, bold)
- Body is plain, untouched
- Bottom border mirrors the top

If `result["_provider_used"]` was set via fallback, we add a discreet footer line in `DIM`:

```
   ↳ Routé via fallback (groq → zhipu → mistral)
```

This gives a power user the trail without scaring a beginner.

---

## 5. Error UX

### 5.1 Soft errors (provider failed, fallback continues)

**Replace** `[fallback] groq failed: 429` with:

```
   ├─ groq      ❌ Rate limited (429) → Je bascule...
```

**Mapping table** (`_humanize_error(exc)`):

| Raw exception / status | Friendly line |
|---|---|
| `429` | `❌ Rate limited (429) → Je bascule...` |
| `401` / `403` | `❌ Clé API refusée → Je bascule...` |
| `404` | `❌ Modèle introuvable → Je bascule...` |
| `timeout` / `Timeout` | `❌ Délai dépassé → Je bascule...` |
| `Circuit breaker OPEN` | `⏸️  En pause (circuit ouvert) → Je réessaie plus tard` |
| `Quota local dépassé` | `⏸️  Quota du jour atteint → Je bascule...` |
| `Cle ... introuvable` | `⛔ Clé non configurée → Ignoré` |
| `ConnectionError` | `❌ Réseau inaccessible → Je bascule...` |
| Any other | `❌ Erreur inattendue → Je bascule...` |

The raw exception is still logged to `stderr` for `--verbose` mode (see §7), keeping debugging power without polluting stdout.

### 5.2 Hard errors (all providers failed)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔  Tous les providers ont échoué
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Impossible de générer une réponse.

   💡 Astuce : réessayez dans 1 minute, ou lancez
      `python ~/.config/opencode/scripts/hash-direct.py --status`
      pour voir l'état des providers.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ↳ Dernière erreur technique (stderr) :
     groq: 429 Too Many Requests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- The "Dernière erreur technique" line is `DIM` and only printed if `stderr` is a TTY.
- Exit code stays `1` so scripts can detect failure.

### 5.3 Forbidden patterns

In friendly mode, **never** print:
- `Traceback (most recent call last):`
- `requests.exceptions.HTTPError`
- Full URL with API keys in query string
- JSON response dumps (except via `--json`)

---

## 6. Color rules

Apply color through a single helper:

```python
def _c(code: str, text: str, enabled: bool) -> str:
    return f"\033[{code}m{text}\033[0m" if enabled else text
```

| Helper | Code |
|---|---|
| `_dim(t)` | `90` |
| `_info(t)` | `36` |
| `_ok(t)` | `32` |
| `_warn(t)` | `33` |
| `_err(t)` | `31` |
| `_bold(t)` | `1` |

Disable colors when:
- `NO_COLOR` env var is set
- `--no-color` flag is passed
- stdout is not a TTY (i.e. piped to a file) — UNLESS `--force-color` is set

---

## 7. Flags

| Flag | Short | Description |
|---|---|---|
| `--progress` | `-P` | Enable friendly progress UI (default: off, silent like today) |
| `--verbose` | `-V` | With `--progress`, also emit raw errors on stderr in `DIM` |
| `--no-color` | | Force-disable ANSI even in TTY |
| `--force-color` | | Force-enable ANSI even when piped |

Default behavior is **unchanged** — silent, scriptable. `--progress` opts into the friendly mode. This protects existing pipelines and CI scripts.

---

## 8. Spinner implementation

A thread-based context manager so it doesn't block the call:

```python
import threading, itertools, sys, time

_SPINNER = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]
_ASCII_SPINNER = ["|","/","-","\\"]

class Spinner:
    def __init__(self, text, enabled, color_fn=_dim):
        self.text = text
        self.enabled = enabled and sys.stderr.isatty()
        self.color_fn = color_fn
        self._stop = threading.Event()
        self._thread = None
        self.frames = _SPINNER if _unicode_ok() else _ASCII_SPINNER

    def __enter__(self):
        if not self.enabled: return self
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
        return self

    def _run(self):
        for f in itertools.cycle(self.frames):
            if self._stop.is_set(): break
            sys.stderr.write(f"\r{self.color_fn(self.text + ' ' + f)}")
            sys.stderr.flush()
            time.sleep(0.08)

    def __exit__(self, *a):
        if not self.enabled: return
        self._stop.set()
        self._thread.join()
        sys.stderr.write("\r" + " " * (len(self.text) + 4) + "\r")
        sys.stderr.flush()
```

**Key detail:** `\r` + trailing spaces + `\r` clears the spinner line. The `daemon=True` ensures the spinner dies with the main process.

---

## 9. Indented fallback chain

A small helper to print the tree:

```python
def _emit_chain_line(icon: str, provider: str, status: str, *,
                     is_last: bool, progress: Progress, elapsed_ms: int = None):
    branch = "└─" if is_last else "├─"
    timing = f"    {elapsed_ms/1000:.1f}s" if elapsed_ms and elapsed_ms > 500 else ""
    line = f"   {branch} {provider:<10}{icon} {status}{timing}"
    progress.line(line)
```

Each phase emits a "delta" line, never reprints. The final `└─` is the winning provider, marked `✅`.

---

## 10. Code insertion points in `hash-direct.py`

The implementation should add a new module section, then thread it through. **No existing call signature changes.**

### 10.1 New module: `CliProgress`

Add after line 28 (just after the UTF-8 wrapper). Contains:
- `_c()` color helpers
- `Spinner` context manager
- `CliProgress` class with:
  - `__init__(self, enabled: bool)`
  - `phase(name, text)` → returns a context manager that prints a header
  - `chain_attempt(provider)` → returns a context manager
  - `chain_result(provider, ok, error=None, elapsed_ms=0)`
  - `thinking()`, `generating()` → spinner contexts
  - `present_result(content, provider, model, elapsed_ms, fallback_path)`
  - `present_failure(last_error)`
  - `line(text, level="dim")` for ad-hoc output

### 10.2 New module: `_humanize_error`

Pure function: `def _humanize_error(exc: Exception) -> str` returning the friendly line. No I/O.

### 10.3 Modifications

| Line(s) | Change |
|---|---|
| ~265 | `print(f"[circuit] {provider} bloque...")` → `progress.chain_result(provider, ok=False, error="circuit_open")` |
| ~277 | `print(f"[fallback] {provider} failed: {e}", ...)` → `progress.chain_result(provider, ok=False, error=e)` |
| `argparse` block (~318) | Add `--progress`, `--verbose`, `--no-color`, `--force-color` |
| `main()` after parse | Construct `progress = CliProgress(enabled=args.progress, color=...)` |
| Each prompt loop | Wrap with `with progress.phase("init", "🚀 Initialisation..."):` once, then `with progress.thinking():` and `with progress.generating():` around the actual call |
| Final print (~502) | Replace with `progress.present_result(content, provider, model, elapsed, fallback_path)` |
| Error print (~493) | Replace with `progress.present_failure(last_error)` |
| Batch loop (~385) | Replace `print(f"Traitement prompt {i+1}/{len(prompts)}...")` with progress bar |
| Top of file | New `--force-color` should also call `os.system("")` on Windows |

### 10.4 Backward compatibility guarantees

- Existing flags (`--json`, `--batch`, `--model`, `--provider`, etc.) untouched.
- Default output (no `--progress`) is **byte-identical** to current behavior.
- Exit codes unchanged.
- All `print(..., file=sys.stderr)` lines that are part of the legacy log are still emitted to stderr — friendly mode just adds structured output to stderr/stdout per the design.

---

## 11. ASCII mockups (real runs)

### 11.1 Happy path (1st provider works)

```
$ python hash-direct.py -P "Écris un haïku sur Python"

🔍 Recherche d'un provider disponible...
   └─ groq      ✅ Prêt ! (qwen/qwen3.8-27b)
💭 Je réfléchis à votre question...
📝 Génération de la réponse...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 RÉSULTAT  (groq/qwen/qwen3.8-27b · 0.9s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Voici un haïku sur Python :

   Indentation sage,
   Le serpent code en silence —
   Bug ? Une simple trace.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 11.2 Fallback path (1st fails, 2nd works)

```
$ python hash-direct.py -P "Refactor this Python function"

🔍 Recherche d'un provider disponible...
   ├─ groq      ❌ Rate limited (429) → Je bascule...
   ├─ mistral   ✅ Prêt ! (codestral-latest)
💭 Je réfléchis à votre question...
📝 Génération de la réponse...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 RÉSULTAT  (mistral/codestral-latest · 1.4s)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def greet(name: str) -> str:
    """Return a friendly greeting."""
    return f"Hello, {name}!"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ↳ Routé via fallback (groq → mistral)
```

### 11.3 All providers fail

```
$ python hash-direct.py -P "Anything"

🔍 Recherche d'un provider disponible...
   ├─ groq      ❌ Rate limited (429) → Je bascule...
   ├─ mistral   ❌ Délai dépassé → Je bascule...
   ├─ zhipu     ⛔ Clé non configurée → Ignoré
   ├─ novita    ❌ Erreur inattendue → Je bascule...
   ├─ openrouter❌ Rate limited (429) → Je bascule...
   └─ together  ❌ Clé API refusée → Je bascule...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔  Tous les providers ont échoué
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Impossible de générer une réponse.

   💡 Astuce : réessayez dans 1 minute, ou lancez
      `python ~/.config/opencode/scripts/hash-direct.py --status`
      pour voir l'état des providers.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ↳ Dernière erreur technique : openrouter: 429 Too Many Requests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
$ echo $?
1
```

### 11.4 Batch with progress bar

```
$ python hash-direct.py -P --batch prompts.txt

🚀 Initialisation du système...
   ✓ Clés chargées (6 providers)
📦 Traitement batch (1/12) █░░░░░░░░░░░░░░░░░░░   8%
   └─ [1] groq/qwen3.8-27b ✓ (1.1s)
📦 Traitement batch (2/12) ██░░░░░░░░░░░░░░░░░░  17%
   └─ [2] groq/qwen3.8-27b ✓ (0.8s)
📦 Traitement batch (3/12) ███░░░░░░░░░░░░░░░░░  25%
   ├─ [3] groq/qwen3.8-27b ❌ 429 → Je bascule...
   └─ [3] mistral/codestral-latest ✓ (1.4s)
...
📦 Traitement batch (12/12) ████████████████████ 100%
   └─ [12] mistral/codestral-latest ✓ (0.9s)
✅ Batch terminé · 12 prompts · 14.3s · 1 fallback
```

### 11.5 Non-TTY (piped to file)

```
$ python hash-direct.py -P "Hello" > out.txt 2> err.txt
$ cat out.txt
[groq/qwen/qwen3.8-27b] Hello! How can I help today?
$ cat err.txt
[verbose] chain: groq ok (812ms)
```

When stdout isn't a TTY:
- Colors disabled automatically
- Spinners disabled (skip the line)
- Result still printed plainly
- `chain_attempt` lines suppressed; only the final result on stdout

This keeps the wrapper **scriptable** even with `-P`.

### 11.6 `--verbose` mode

`--verbose` adds the raw technical trail under each chain step, in `DIM`:

```
   ├─ groq      ❌ Rate limited (429) → Je bascule...
      ↳ HTTPError: 429 Client Error: rate limit reached
   ├─ mistral   ✅ Prêt ! (codestral-latest)
      ↳ 200 OK in 412ms
```

---

## 12. Implementation checklist for @fixer

```
[ ] Add `CliProgress` class with spinner, phase, chain, result, failure methods
[ ] Add `_humanize_error(exc) -> str` mapping table
[ ] Add `--progress`/`-P`, `--verbose`/`-V`, `--no-color`, `--force-color` flags
[ ] Thread `progress` through `auto_fallback_chat()` (add optional param)
[ ] Replace line 265 [circuit] print with progress.chain_result(provider, ok=False, error="circuit_open")
[ ] Replace line 277 [fallback] print with progress.chain_result(provider, ok=False, error=e)
[ ] Wrap auto_fallback_chat call with progress.thinking() / progress.generating()
[ ] Replace final print at line 502 with progress.present_result(...)
[ ] Replace error print at line 493 with progress.present_failure(...)
[ ] Replace batch loop's "Traitement prompt N/M" with progress bar
[ ] Detect TTY + Unicode support + Windows ANSI enable
[ ] Add a tiny self-test at bottom (if __name__ == "__main__" and "--demo" arg)
[ ] Update hash-direct-wrapper.py to forward -P / --progress to hash-direct.py
[ ] Run --progress on three scenarios: success, fallback, all-fail — verify visually
[ ] Confirm default (no flag) output is byte-identical to current
[ ] Update ~/.config/opencode/AGENTS.md usage example to show -P
```

---

## 13. Edge cases & guardrails

| Case | Behavior |
|---|---|
| User runs in CI (no TTY, no `--progress`) | Identical to today. No change. |
| User runs in CI *with* `--progress` | Spinners suppressed, but tree & boxes still print (useful for logs). |
| User runs in CI *with* `--progress` piped to file | Spinners suppressed, colors disabled, tree still prints. |
| Provider hangs >30s | `requests` timeout kicks in → `Délai dépassé` message. We do **not** invent a longer timeout. |
| Windows cp1252 console | Existing `io.TextIOWrapper(..., errors="replace")` covers stdout; we add `os.system("")` for ANSI enable. Spinner falls back to ASCII if `emoji` import fails or stdout encoding can't represent `⠋`. |
| Prompt is empty after `parser.print_help()` | Friendly mode never reached; no impact. |
| `--json` and `--progress` together | `--json` wins: progress messages go to stderr, raw JSON to stdout, no decoration. |
| Batch + `--json` | Same: progress on stderr, JSON on stdout, no friendly boxes around the result. |
| 100+ providers in chain | Tree will scroll. We don't truncate — operators want to see the trail. Add `--no-chain` later if needed. |

---

## 14. Out of scope (deliberately)

- TUI / interactive picker for the model (would be a separate `hash-direct-tui.py`).
- Persistent progress across calls (no log file by default).
- Web UI / dashboard (separate concern).
- Localizing messages to other languages — French only for now, matching the rest of the toolchain.

---

## 15. Success criteria

The change is **done** when:

1. `python hash-direct.py "Hello"` produces output **byte-identical** to today.
2. `python hash-direct.py -P "Hello"` produces a flow matching §11.1, §11.2, or §11.3 depending on outcome.
3. No raw exception class names, tracebacks, or `requests.exceptions.*` strings appear in stdout when `-P` is on.
4. Exit codes unchanged.
5. All three scenarios (success / fallback / all-fail) verified manually.
6. CI / piped usage still works (TTY detection correct).

---

**End of design.** Hand off to @fixer with §12 as the implementation plan.
