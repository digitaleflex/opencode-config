# EURINHASH — Model Intelligence, Economy & Mission Verification

> Version 1.0 — 2026-09-19
> FR/EN design contract

## FR

Ce document formalise les capacités qui distinguent EurinHash d'un simple gateway ou routeur.

## 1. Model Intelligence

Le système maintient une distinction entre :

```text
MODEL / PROVIDER / ACCOUNT / GATEWAY / RUNTIME
```

Le catalogue externe peut fournir des connaissances statiques sur les modèles. L'état runtime reste une observation indépendante.

Le modèle doit être décrit par ses capacités :

- raisonnement ;
- génération de code ;
- tool use ;
- contexte ;
- modalités ;
- vitesse ;
- fiabilité observée ;
- coût ;
- quotas ;
- contraintes de politique.

## 2. Capability matching

```text
TASK
 ↓
REQUIRED CAPABILITIES
 ↓
CANDIDATE DISCOVERY
 ↓
ELIGIBILITY
 ↓
RESOURCE SCORING
 ↓
SELECTION
```

L'éligibilité précède le score. Un modèle incapable de satisfaire une exigence obligatoire ne doit pas être compensé par un score global élevé.

## 3. Model Router

Le routeur optimise une ressource suffisante selon les contraintes de la mission.

Dimensions possibles : task-fit, context-fit, tool support, health, quota, reliability, latency, cost, policy et budget restant.

Toute décision importante doit être explicable.

## 4. Economy Engine

Le système cherche à minimiser la consommation inutile tout en respectant la qualité requise.

```text
Effective Cost =
financial cost
+ wasted tokens
+ retries
+ failed execution
+ latency
+ context reconstruction
+ human intervention
+ verification cost
```

Le moteur gère notamment : free, subscription, credits, metered, local, trial et shared quota.

## 5. Resource budget

Une mission peut définir :

```yaml
budget:
  max_cost: optional
  max_tokens: optional
  max_duration: optional
  max_agent_calls: optional
  max_risk: optional
```

Les budgets inconnus restent inconnus. Aucun chiffre n'est inventé.

## 6. Resilience

Les erreurs doivent être classifiées avant recovery : quota/rate limit, authentication, policy/access, unavailable model, upstream failure, timeout, stalled stream, tool failure, invalid output.

Les stratégies incluent retry, cooldown, circuit breaker, fallback, reroute ou abort selon la cause et la politique.

## 7. Streaming

Le streaming est une machine d'état :

`REQUESTED → DISPATCHED → CONNECTED → FIRST_TOKEN → STREAMING → PROGRESSING → COMPLETED`

Un état `CONNECTED` sans progression doit pouvoir être détecté et traité. Les timeouts et fallbacks doivent préserver la cohérence de la mission.

## 8. Mission Verifier

Le verifier ne fait pas confiance à la déclaration de l'agent.

```text
CONTRACT
 + ACCEPTANCE CRITERIA
 + EXECUTION EVIDENCE
 + VALIDATION RESULTS
 ↓
VERIFIER
 ↓
VERIFIED / UNVERIFIED / FAILED / BLOCKED / NEEDS_REVIEW
```

Chaque critère d'acceptation est évalué individuellement.

## 9. Evidence & Proof

Une preuve doit être traçable vers une observation réelle : commande exécutée, test, build, runtime behavior, diff, événement ou autre validation définie par le contrat.

`SKIPPED ≠ PASSED`.

## 10. Multi-model review

Un second ou troisième modèle n'est utilisé que si la réduction de risque ou l'amélioration de qualité justifie le coût. Les rôles peuvent être planner, implementer, reviewer, security reviewer et verifier.

## 11. Learning

Les résultats observés peuvent alimenter des estimations futures, mais le système doit distinguer :

`OBSERVED ≠ ESTIMATED ≠ LEARNED`.

---

## EN

This document defines the capabilities that make EurinHash more than a gateway or model router.

### Model intelligence

Keep separate identities for model, provider, account, gateway and runtime. External catalogs provide model knowledge; live runtime state is independently observed.

### Capability matching

Tasks are converted into required capabilities before candidate resources are selected. Mandatory capability failures exclude candidates rather than being hidden by aggregate scoring.

### Routing

Select the least costly sufficient resource under task, context, tools, health, quota, reliability, latency, policy and budget constraints. Decisions must be explainable.

### Economy

Effective cost includes financial cost, wasted tokens, retries, failed execution, latency, context reconstruction, human intervention and verification cost.

### Resilience

Classify failures before retry/fallback/reroute. Treat stalled streaming as a first-class failure mode.

### Mission verification

An agent's “done” claim is not completion. Completion is established criterion by criterion from concrete execution and validation evidence.

### Evidence and learning

Proof must trace to real observations. Learned routing signals must remain distinguishable from direct observations.
