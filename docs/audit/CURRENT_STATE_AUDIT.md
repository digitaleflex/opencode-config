# CURRENT STATE AUDIT — EURINHASH / OpenCode Config

## 1. Project Overview
- **Goal**: 100% FREE AI agent governance, curation, and orchestration
- **Default agent**: eurinhash (superviseur FREE)
- **Base**: `C:\Users\PC\.config\opencode`
- **Philosophy**: KEEP-INTEGRATE-BUILD — garder l'existant, intégrer le meilleur open source, construire uniquement ce qui est unique

## 2. Files & Configuration

### `opencode.jsonc`
- Providers: zhipu, google, mistral, groq, openrouter, huggingface, novita, together
- DeepSeek endpoint corrigé : `https://api.novita.ai/openai/v1`
- Modèle gratuit Novita : `inclusionai/ling-3.0-flash-sante`
- ~~together + deepseek~~ désactivés (crédits épuisés / pas de clé)
- ~~4 plugins désactivés~~ : `@f97/opencode-morph-fast-apply`

### `opencode.json`
- 14 plugins actifs :
  - `@felipegenef/opencode-lazy-skills`
  - `envsitter-guard`
  - `./plugin/guard.ts` (Safety Guard — commandes interdites : rm -rf /, mkfs, dd, push --force)
  - `./plugin/audit-logger.ts`
  - `oh-my-openencode-slim`
  - `@f97/opencode-morph-fast-apply`
  - `opencode-supermemory`
  - `@zenobius/opencode-skillful`
  - `oh-my-openagent`

### `agent/eurinhash.md`
- 5 workers gratuits validés :
  - `worker-codestral` (Mistral Codestral, FREE, testé OK)
  - `worker-groq` (Qwen 3.8 27B, FREE, testé OK)
  - `worker-zhipu` (GLM 4.7 Flash, FREE, testé OK)
  - `worker-novita` (Ling 3.0 Flash Santé, GRATUIT, testé OK)
  - `worker-google` (Gemini 2.5 Flash, FREE, rate_limited temporairement)
- ~~worker-together~~ ❌ crédits épuisés
- ~~worker-deepseek~~ ❌ pas de clé

### `CONFIG-GUIDE.md`
- Documentation complète : providers, coûts, priorités, endpoints
- Section honnête sur concurrents (Oh My OpenAgent, Swarm, Cline, Rate Limit Fallback)
- Roadmap KEEP-INTEGRATE-BUILD
- Sécurité multi-OS (Windows/Linux/macOS)

### `AGENTS.md`
- Provider : eurinhash (default), zhipu/glm-4.7-flash (small model)
- EURINHASH Pro : orchestration travailleurs gratuits
- Matrice L1→L4
- Règles d'activation
- Modèle d'escalade

### `agent/*.md`
- 10 agents : architect, builder, design-lead, docwriter, reviewer, security, tester, git-engineer, quality-engineer, eurinhash

## 3. Plugins (14 actifs)
| Plugin | Rôle |
|---|---|
| `@felipegenef/opencode-lazy-skills` | Retire le catalogue `<available_skills>` du prompt → skills sous demande via `skillsearch`/`skillinfo`/`skill`. Économie ~82% tokens à chaque tour. |
| `envsitter-guard` | Protection fichiers .env et clés API. |
| `oh-my-openencode-slim` | Optimisations légères. |
| `@f97/opencode-morph-fast-apply` | Remplace éditeur par défaut par Morph Fast Apply → **~10x plus rapide** sur les édits. |
| `opencode-supermemory` | Mémoire vectorielle persistante — rappeler faits entre sessions. |
| `@zenobius/opencode-skillful` | Recommandation dynamique de skills basée sur l'Anthropic Agent Skills Spec. |
| `./plugin/guard.ts` | **Safety Guard** — bloque `rm -rf /`, `mkfs`, `dd`, `push --force`, `git push --force`, `git reset --hard`. |
| `./plugin/audit-logger.ts` | Journalisation avec redaction de secrets. |
| `opencode-dynamic-context-pruning` (inactif) | Détection doublons contextuels. |
| `opencode-router` (inactif) | Redirection MCP. |
| `opencode.nvim` (inactif) | Neovim integration. |
| `./plugin/context-summarizer.ts` | Prune automatiquement le contexte ancien. |

## 4. Skills (38 + lazy-skills)
- `hash-*` : hash-*, hash-code-navigation, hash-enterprise-development, hash-token-efficiency, hash-verification
- `cloudflare` : wrappers Cloudflare Workers
- `frontend-design` : 12ui-design, design system
- `review` : systematic-debugging, review
- `web-design` : web-design-guidelines

## 5. Scripts
| Script | Rôle |
|---|---|
| `free-probe.py` | Teste les FREE workers (7 workers) |
| `hash-direct.py` | Wrapper Windows pour contourner bugs paths |
| `hash-direct-wrapper.py` | Wrapper Windows avancé |
| `myfree-eurinhash.py` | Routeur complet FREE + rapport qualité/prix |
| `quota.py` | Monitoring quota journalier |
| `view-audit-log.py` | Visualisation logs audit |

## 6. Workers FREE (5 validés)
| Worker | Modèle | Spécialité | Status |
|---|---|---|---|
| `worker-codestral` | `mistral/codestral-latest` | Code | ✅ OK |
| `worker-groq` | `groq/qwen/qwen3.8-27b` | Rapide | ✅ OK |
| `worker-zhipu` | `zhipu/glm-4.7-flash` | Générique | ✅ OK |
| `worker-novita` | `novita/inclusionai/ling-3.0-flash-sante` | GRATUIT | ✅ OK |
| `worker-google` | `google/gemini-2.5-flash` | Polyvalent | ⚠️ rate_limited |
| `worker-together` | Kimi K2.7 Code | CODE | ❌ crédits épuisés |
| `worker-deepseek` | deepseek-v4-flash | CODE | ❌ pas de clé |

## 7. Security & Secrets
- `.gitignore` : exclut 9 fichiers `.key` + logs + état
- `envsitter-guard` : détecte redaction clés
- **Aucune clé en clair** dans `opencode.jsonc` (utilise `{file:...}`)
- Fichiers `.key` dans `%USERPROFILE%` / `~` — accès user uniquement
- **Aucune fuite** dans les logs (vérifié)
- Recommandé : `chmod 600` (Linux/macOS) ou ACL NTFS (Windows)

## 7. Concurrents documentés
| Projet | Catégorie | Recommandation |
|---|---|---|
| Oh My OpenAgent | Orchestration multi-agents | INTEGRATE |
| OpenCode Swarm | Circuit Breakers | INTEGRATE |
| Rate Limit Fallback | Fallback sophistiqué | INTEGRATE |
| Cline | Plateforme complète | STUDY |
| OpenCode (base) | — | KEEP |

## 8. Roadmap prévisionnelle
### Phase 1 — Simplification : auditer et supprimer doublons
### Phase 2 — Intégration : Oh My OpenCode + Rate Limit Fallback
### Phase 3 — Governance Layer : Policy Engine L1→L4 + Policy Engine
### Phase 4 — Observabilité : logs, métriques, session summary

## 9. Recommandations
- **Ne pas reconstruire** ce qui existe mieux ailleurs
- **Intégrer** les meilleurs composants open source
- **Garder** ce qui est unique à EURINHASH (supervisor, matrice L1→L4, sécurité)
- **Construire** uniquement la Governance Layer différenciante

---
*État au : 2026-09-06*