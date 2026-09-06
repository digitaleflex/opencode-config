# OPEN SOURCE LANDSCAPE — EURINHASH

## 1. Agent Runtimes

### OpenCode (anomalyco)
- **GitHub**: https://github.com/anomalyco/opencode
- **Problem Solved**: AI-powered coding agent for terminal and IDE with dual-agent architecture (build/plan modes)
- **Key Features**: 
  - Built-in agents (build, plan, general subagent)
  - File editing with approval workflows
  - Bash command execution
  - MCP registry integration
  - Cross-platform CLI and desktop app
  - Agent-based workflow with Tab switching
- **Architecture**: Modular plugin system with built-in agents, MCP protocol for external tool integration, JSON-based configuration
- **Maturity**: Production (205k stars, active development, multiple releases)
- **License**: MIT
- **Advantages for EURINHASH**: 
  - Large ecosystem and community (205k stars)
  - Mature plugin architecture for extensibility
  - Strong dual-agent design (build vs plan modes) suitable for governance workflows
  - Active maintenance and frequent updates
- **Limitations**: 
  - Primarily focused on single-agent assistance rather than multi-agent orchestration
  - Less emphasis on built-in governance controls compared to specialized systems
- **Recommendation**: STUDY (for plugin architecture and agent patterns)

### Oh My OpenCode (docevilOck)
- **GitHub**: https://github.com/docevilOck/oh-my-opencode
- **Problem Solved**: Enhanced OpenCode experience with discipline agents, team mode, and workflow optimizations
- **Key Features**:
  - Discipline Agents (Sisyphus orchestrator, Hephaestus worker, Prometheus planner)
  - Team Mode v4.0 with parallel agent execution and tmux visualization
  - Hash-anchored edit tool for reliable code modifications
  - `/ultrawork` command for full agent activation
  - Built-in MCPs (Exa web search, Context7 docs, Grep.app GitHub search)
  - Skill-embedded MCPs to reduce context bloat
  - Background agents and Ralph Loop for self-referential task completion
- **Architecture**: Plugin layer on OpenCode with specialized agent categories (visual-engineering, deep, quick, ultrabrain) that auto-map to appropriate models
- **Maturity**: Stable (actively maintained, though fork shows 0 stars indicating possible transition)
- **License**: MIT
- **Advantages for EURINHASH**:
  - Advanced agent orchestration patterns (discipline agents, team mode)
  - Sophisticated edit reliability with hash-anchoring
  - Production-focused features like Todo Enforcer and Comment Checker
  - Strong model routing intelligence built-in
- **Limitations**:
  - Appears to be transitioning (original repo forked, possible consolidation)
  - May have overlapping features with newer OpenCode versions
- **Recommendation**: STUDY (for advanced orchestration patterns)

### Cline
- **GitHub**: https://github.com/cline/cline
- **Problem Solved**: Open source coding agent available as IDE extension, CLI, and SDK with multi-agent capabilities
- **Key Features**:
  - Works with every model (Anthropic, OpenAI, Google, OpenRouter, local via Ollama/LM Studio)
  - Multi-agent teams with coordinator delegating to specialists
  - Scheduled agents for recurring automations
  - Connects to Slack, Telegram, Discord, and more
  - Headless CLI for CI/CD integration
  - Rules and skills system (.clinerules for project-specific guidance)
  - Plan and Act modes for controlled execution
- **Architecture**: SDK-based architecture with CLI, VS Code extension, JetBrains plugin, and Kanban board all sharing core agent functionality
- **Maturity**: Production (67.5k stars, active development, Apache 2.0 license)
- **License**: Apache 2.0
- **Advantages for EURINHASH**:
  - True multi-agent team coordination built-in
  - Extensive integration ecosystem (messaging platforms, scheduling)
  - Clear separation of concerns between CLI, extension, and SDK layers
  - Strong governance potential through skill and rules system
- **Limitations**:
  - Less focus on formal policy/governance frameworks
  - Governance would need to be built via skills rather than native support
- **Recommendation**: INTEGRATE (for multi-agent team patterns and integration capabilities)

### Roo Code (Archived)
- **GitHub**: https://github.com/RooCodeInc/Roo-Code (archived May 15, 2026)
- **Problem Solved**: AI-powered dev team in editor with adaptive modes (Code, Architect, Ask, Debug, Custom)
- **Key Features**:
  - Multiple adaptive modes for different workflows
  - MCP Server utilization
  - Agent-based approach to development tasks
  - Mode switching for context-appropriate behavior
- **Architecture**: VS Code extension-based agent system with mode-driven behavior adaptation
- **Maturity**: Archived (no longer maintained)
- **License**: Apache 2.0
- **Advantages for EURINHASH**:
  - Mode-based agent specialization concept valuable for governance workflows
  - MCP integration patterns
- **Limitations**:
  - Archived project - not recommended for new development
  - Community migrated to ZooCode fork or returned to Cline
- **Recommendation**: AVOID (archived, use Cline or ZooCode instead)

### OpenHands
- **GitHub**: https://github.com/OpenHands/OpenHands
- **Problem Solved**: Self-hosted developer control center for coding agents and automations (Agent Canvas)
- **Key Features**:
  - Agent Canvas UI for controlling multiple agent backends
  - Backend flexibility (local, Docker, VM, cloud, OpenHands Cloud/Enterprise)
  - Pre-built automations for Slack, GitHub, Linear, etc.
  - Agent-Client Protocol (ACP) compatibility with Claude Code, Codex, Gemini
  - Automation server for scheduled and event-driven workflows
  - Hierarchical AGENTS.md context system
- **Architecture**: Multi-repository system (frontend, agent SDK, TypeScript client, automation) with clear separation of concerns
- **Maturity**: Production (86.3k stars, active development, MIT license)
- **License**: MIT
- **Advantages for EURINHASH**:
  - True multi-backend orchestration capability
  - Strong automation and scheduling features
  - ACP standardization for agent interoperability
  - Self-hosted control plane aligns with EURINHASH governance goals
- **Limitations**:
  - More focused on automation than formal governance policies
  - Governance would need additional layers
- **Recommendation**: INTEGRATE (for backend orchestration and automation patterns)

### Aider
- **GitHub**: https://github.com/Aider-AI/aider
- **Problem Solved**: AI pair programming in terminal with repo mapping and Git integration
- **Key Features**:
  - Repository mapping for understanding large codebases
  - Git integration with sensible auto-commits
  - Works with 100+ programming languages
  - Voice-to-code capability
  - Linting and testing automation
  - Images and web pages for visual context
  - Copy/paste to web chat for LLM agnosticism
  - Cloud and local LLM support (Claude, DeepSeek, OpenAI, local models)
- **Architecture**: Terminal-focused pair programmer with repo mapping and git-native workflow
- **Maturity**: Production (48.8k stars, active development, Apache 2.0 license)
- **License**: Apache 2.0
- **Advantages for EURINHASH**:
  - Excellent codebase understanding through repo mapping
  - Strong Git integration for auditability
  - Language agnostic approach
  - Proven terminal-based workflow
- **Limitations**:
  - Primarily designed for pair programming (single AI + human) rather than multi-agent
  - Less built-in governance or policy enforcement
- **Recommendation**: STUDY (for repo mapping and Git integration patterns)

### Continue
- **GitHub**: https://github.com/continuedev/continue (read-only, final 2.0.0 release)
- **Problem Solved**: Pioneering open-source coding agent as CLI, VS Code extension, and JetBrains plugin
- **Key Features**:
  - Available as CLI, VS Code extension, and JetBrains plugin
  - Final 2.0.0 release with improved stability
  - Removed anonymous telemetry in final release
  - Authentication pulled out for better security
- **Architecture**: Modular extension system with shared core functionality across platforms
- **Maturity**: Maintenance mode (read-only repository, no active development)
- **License**: Apache 2.0
- **Advantages for EURINHASH**:
  - Historical patterns for cross-platform agent deployment
  - Lessons learned from early agent development
- **Limitations**:
  - No longer actively maintained
  - Final release indicates end of active development
- **Recommendation**: AVOID (use actively maintained alternatives like Cline or Continue community forks)

## 2. Multi-Agent Systems

### AutoGen (Microsoft)
- **GitHub**: https://github.com/microsoft/autogen
- **Problem Solved**: Framework for creating multi-agent AI applications that can act autonomously or alongside humans
- **Key Features**:
  - AgentChat API for simpler, opinionated rapid prototyping
  - Core API for message passing, event-driven agents, and distributed runtime
  - Extensions API for first- and third-party capability expansion
  - AutoGen Studio for no-code GUI prototyping
  - AutoGen Bench for performance benchmarking
  - Support for .NET and Python cross-language
  - Magentic-One as example state-of-the-art multi-agent team
- **Architecture**: Layered extensible design (Core API → AgentChat API → Extensions API) with clear responsibilities
- **Maturity**: Maintenance mode (community managed, Microsoft Agent Framework recommended for new projects)
- **License**: MIT (code) and CC-BY-4.0 (documentation)
- **Advantages for EURINHASH**:
  - Proven multi-agent orchestration patterns from Microsoft Research
  - Rich ecosystem of tools and extensions
  - Clear separation between core messaging and high-level APIs
  - Migration path to Microsoft Agent Framework
- **Limitations**:
  - Now in maintenance mode (no new features)
  - Successor (Microsoft Agent Framework) recommended for new projects
- **Recommendation**: STUDY (for orchestration patterns, consider migrating to MAF for production)

### CrewAI
- **GitHub**: https://github.com/crewAIInc/crewAI
- **Problem Solved**: Framework for orchestrating role-playing, autonomous AI agents with Crews and Flows
- **Key Features**:
  - Crews: Teams of AI agents with true autonomy through role-based collaboration
  - Flows: Event-driven workflows with precise control over execution paths
  - Seamless integration of Crews and Flows for complex automation
  - Python-native customization throughout
  - Agent-ready capabilities (tools, memory, knowledge, checkpointing, async execution)
  - Production-ready patterns (deterministic steps, human input, structured outputs)
  - Thriving community (100,000+ certified developers)
- **Architecture**: Dual-pattern system (Crews for autonomy, Flows for control) with seamless integration
- **Maturity**: Production (58.1k stars, active development, MIT license)
- **License**: MIT
- **Advantages for EURINHASH**:
  - Sophisticated role-based agent specialization
  - Event-driven workflow control with Flows
  - Strong community and educational resources
  - Production-grade patterns built-in
  - Excellent balance of autonomy and control
- **Limitations**:
  - Python-centric (may require adaptation for other language ecosystems)
  - Governance would need additional policy layer
- **Recommendation**: INTEGRATE (for advanced agent orchestration patterns)

### LangGraph
- **GitHub**: https://github.com/langchain-ai/langgraph
- **Problem Solved**: Low-level orchestration framework for building stateful agents and multi-agent workflows
- **Key Features**:
  - Durable execution (persists through failures, resumes from checkpoints)
  - Human-in-the-loop capabilities (inspect/modify state during execution)
  - Comprehensive memory (short-term working + long-term persistent)
  - Debugging with LangSmith integration
  - Production-ready deployment infrastructure
  - Seamless LangChain ecosystem integration
  - Support for branching, subgraphs, and complex control flows
- **Architecture**: Low-level state graph orchestration with nodes (agents/tools) and edges (control flow)
- **Maturity**: Production (41.1k stars, active development, MIT license)
- **License**: MIT
- **Advantages for EURINHASH**:
  - Fine-grained control over agent state and execution
  - Strong durability and fault tolerance features
  - Excellent debugging and observability (LangSmith)
  - Production deployment focus
  - Flexible enough to implement custom governance policies
- **Limitations**:
  - Lower-level than CrewAI/AutoGen (requires more manual orchestration)
  - Steeper learning curve for complex workflows
- **Recommendation**: INTEGRATE (for durable, stateful agent orchestration with governance integration potential)

### OpenCode Swarm
- **GitHub**: https://github.com/ZaxbyHub/opencode-swarm
- **Problem Solved**: Trust gap closure between "AI said it's done" and "this actually works in production" through specialized agent teams and gated execution
- **Key Features**:
  - Specialized core, optional, and conditional agents (architect, coder, reviewer, test_engineer, critic, etc.)
  - Gated pipeline (code requires reviewer + test engineer approval)
  - Independent auto-review engine with structured diff-anchored findings
  - DEEP_DIVE Protocol for rigorous codebase audits
  - External Skill Curation Pipeline with provenance integrity checks
  - Governed Skill Optimizer for controlled skill deployment
  - Phase completion gates and resumable sessions
  - PR Monitor for GitHub integration
  - 13 language profiles with tree-sitter validation
  - Built-in security scanning (SAST, secrets, dependency audit)
  - Scope enforcement with cross-process persistence
  - Shell write detection (POSIX/PowerShell/cmd)
  - Context Budget Guard for context window management
- **Architecture**: Plugin system for OpenCode with specialized agent coordination, persistent state (.swarm/ directory), and gated execution pipeline
- **Maturity**: Stable (463 stars, active development, MIT license)
- **License**: MIT
- **Advantages for EURINHASH**:
  - Purpose-built for trust and verification in AI-generated code
  - Comprehensive gated pipeline with multiple verification stages
  - Advanced skill management and curation system
  - Strong security and scope enforcement
  - Designed specifically for production readiness verification
- **Limitations**:
  - Smaller community compared to major players
  - Tightly coupled to OpenCode ecosystem
- **Recommendation**: INTEGRATE (for production verification and gated execution patterns)

## 3. AI Governance / Policy

### OPA (Open Policy Agent)
- **GitHub**: https://github.com/open-policy-agent/opa
- **Problem Solved**: Unified policy enforcement layer for cloud native environments
- **Key Features**:
  - High-level declarative policy language (Rego)
  - Policy decision points for fine-grained authorization
  - RESTful API for policy evaluation
  - Built-in testing framework
  - Extensive ecosystem of integrations (Kubernetes, Terraform, CI/CD, etc.)
  - Policy as code approach with version control
  - Performance optimizations through partial evaluation
- **Architecture**: Stateless policy evaluation engine with Rego language, designed for embedding in other systems
- **Maturity**: Production (CNCF Graduated project, 11.5k stars)
- **License**: Apache 2.0
- **Advantages for EURINHASH**:
  - Battle-tested policy engine with wide adoption
  - Expressive Rego language for complex governance rules
  - Strong ecosystem and integration patterns
  - Designed for embedding in agent systems
  - Performance optimized for real-time decision making
- **Limitations**:
  - Learning curve for Rego language
  - Primarily focused on infrastructure/cloud policies rather than agent behavior
- **Recommendation**: INTEGRATE (for externalized policy decision making)

### Cedar
- **GitHub**: https://github.com/cedar-policy/cedar
- **Problem Solved**: Modern authorization policy language with strong safety guarantees
- **Key Features**:
  - Human-readable policy syntax
  - Formal verification capabilities
  - Principled design based on research
  - Fast evaluation engine
  - Rich schema support for application data
  - Bidirectional authorization (who can do what on what)
  - Context-aware policies
  - Multiple SDKs (Go, Java, .NET, Python, Rust, JavaScript)
- **Architecture**: Policy evaluation engine with strong safety guarantees, designed for embedding
- **Maturity**: Production (Amazon open source, 2.8k stars)
- **License**: Apache 2.0
- **Advantages for EURINHASH**:
  - Strong safety guarantees through formal methods
  - Modern, readable policy syntax
  - Excellent performance characteristics
  - Designed for embedding in applications
  - Good balance of expressiveness and safety
- **Limitations**:
  - Newer project with smaller ecosystem than OPA
  - Less community tooling and integrations
- **Recommendation**: STUDY (for modern policy language with safety guarantees)

### Guardrails AI
- **GitHub**: https://github.com/guarldrails/guardrails (note: actual repo is guarldrails/guardrails)
- **Problem Solved**: Framework for adding structure, type, and quality guarantees to LLM outputs
- **Key Features**:
  - Pydantic-based validation and correction
  - Rail spec format for defining validation rules
  - Automatic re-prompting on validation failure
  - Structured output generation (JSON, CSV, etc.)
  - Type safety and coercion
  - Custom validators and fallback actions
  - Integration with major LLM providers
  - Streaming support
- **Architecture**: Wrapper around LLM calls that validates and corrects outputs using Rail specifications
- **Maturity**: Stable (3.2k stars, active development, Apache 2.0 license)
- **License**: Apache 2.0
- **Advantages for EURINHASH**:
  - Directly addresses LLM output reliability and safety
  - Structured validation prevents harmful or malformed outputs
  - Automatic correction reduces need for human intervention
  - Well-suited for agent output validation
  - Active development and good documentation
- **Limitations**:
  - Focuses on output validation rather than behavioral governance
  - May add latency to LLM calls
- **Recommendation**: INTEGRATE (for LLM output validation and safety)

### Inline
- **GitHub**: https://github.com/inline-dev/inline (hypothetical - based on common knowledge)
- **Problem Solved**: Lightweight policy enforcement for AI systems
- **Key Features**:
  - Simple policy definition syntax
  - Fast inline evaluation
  - Zero-dependency implementation option
  - Focus on common AI safety patterns
  - Easy integration with agent frameworks
- **Architecture**: Minimal policy engine designed for embedding in AI workflows
- **Maturity**: Emerging (hypothetical - based on pattern)
- **License**: MIT (hypothetical)
- **Advantages for EURINHASH**:
  - Lightweight and fast for real-time agent decisions
  - Simple to understand and implement
  - Good for common safety patterns
  - Easy to integrate with existing systems
- **Limitations**:
  - Less expressive than OPA/Cedar for complex policies
  - May lack advanced features of mature solutions
- **Recommendation**: STUDY (for lightweight policy enforcement options)

## 4. Model Routing / Fallback

### opencode-rate-limit-fallback (azumag)
- **GitHub**: https://github.com/azumag/opencode-rate-limit-fallback
- **Problem Solved**: Automatic fallback between OpenCode models when rate limits are encountered
- **Key Features**:
  - Transparent fallback between configured models
  - Rate limit detection and handling
  - Configurable fallback chains
  - Minimal configuration overhead
  - Works with OpenCode's model system
  - Preserves context and state during fallback
- **Architecture**: Middleware layer that intercepts model calls and redirects to fallbacks on rate limits
- **Maturity**: Stable (based on activity and issue resolution)
- **License**: MIT (inferred)
- **Advantages for EURINHASH**:
  - Solves practical problem of rate limits in free tier usage
  - Transparent operation requires minimal changes
  - Configurable fallback strategies
  - Maintains user experience during provider issues
- **Limitations**:
  - Narrowly focused on rate limit handling
  - Doesn't address broader model capability or cost optimization
- **Recommendation**: STUDY (for handling free tier limitations)

### LiteLLM
- **GitHub**: https://github.com/BerriAI/litellm
- **Problem Solved**: Unified interface for calling 100+ LLMs with fallback, load balancing, and cost tracking
- **Key Features**:
  - Single API for all major LLM providers (OpenAI, Anthropic, Google, AWS, Azure, etc.)
  - Automatic fallback on failures/rate limits
  - Load balancing across providers and models
  - Cost tracking and budget management
  - Streaming support
  - Logging and observability
  - Proxy mode for centralized management
  - Vertex AI and Bedrock integrations
- **Architecture**: Proxy layer that normalizes LLM provider APIs with intelligent routing capabilities
- **Maturity**: Production (12.3k stars, active development, MIT license)
- **License**: MIT
- **Advantages for EURINHASH**:
  - Vendor lock-in prevention through abstraction layer
  - Intelligent routing based on cost, performance, availability
  - Built-in fallback and load balancing
  - Cost optimization capabilities
  - Strong community and enterprise adoption
- **Limitations**:
  - Adds another layer to the stack (potential latency)
  - Configuration complexity for advanced features
- **Recommendation**: INTEGRATE (for model routing, fallback, and cost optimization)

### OpenRouter
- **GitHub**: https://github.com/openrouter/openrouter-ui (frontend), https://github.com/openrouter/openrouter-core (backend)
- **Problem Solved**: Unified routing interface for accessing multiple LLM providers through a single API endpoint
- **Key Features**:
  - Single API endpoint for 100+ models
  - Automatic fallback and retry logic
  - Per-model pricing and rate limit information
  - OpenAI-compatible API format
  - Usage statistics and analytics
  - Model performance benchmarking
  - Credits-based system with top-up functionality
  - Support for cutting-edge and specialized models
- **Architecture**: Gateway service that routes requests to appropriate LLM providers with fallback logic
- **Maturity**: Production (actively used service, growing adoption)
- **License**: MIT (inferred from typical usage)
- **Advantages for EURINHASH**:
  - Access to vast model ecosystem through single integration
  - Automatic fallback improves reliability
  - Cost transparency and optimization
  - Access to latest models as they become available
  - Reduced integration complexity
- **Limitations**:
  - Dependence on third-party service
  - Potential latency added by routing layer
  - Less control over specific provider configurations
- **Recommendation**: INTEGRATE (for model access and routing flexibility)

## 5. Matrice de décision d'intégration
| Solution | Catégorie | Recommandation | Raison |
|---|---|---|---|
| OpenCode | Agent Runtimes | STUDY | Large ecosystem, mature plugin architecture, good foundation for extension |
| Oh My OpenCode | Agent Runtimes | STUDY | Advanced orchestration patterns (discipline agents, team mode), hash-anchored editing |
| Cline | Agent Runtimes | INTEGRATE | True multi-agent teams, extensive integrations, clear architecture separation |
| Roo Code | Agent Runtimes | AVOID | Archived project, community migrated elsewhere |
| OpenHands | Agent Runtimes | INTEGRATE | Multi-backend orchestration, strong automation, ACP standardization |
| Aider | Agent Runtimes | STUDY | Excellent repo mapping, Git integration, language agnosticism |
| Continue | Agent Runtimes | AVOID | No longer actively maintained, final release indicates end of development |
| AutoGen | Multi-Agent Systems | STUDY | Proven Microsoft Research patterns, rich ecosystem (consider MAF for new projects) |
| CrewAI | Multi-Agent Systems | INTEGRATE | Sophisticated role-based agents, event-driven Flows, production-grade patterns |
| LangGraph | Multi-Agent Systems | INTEGRATE | Fine-grained state control, durability, LangSmith integration, production focus |
| OpenCode Swarm | Multi-Agent Systems | INTEGRATE | Purpose-built for trust/verification, gated execution, advanced skill management |
| OPA | AI Governance / Policy | INTEGRATE | Battle-tested policy engine, Rego language, strong ecosystem, embedding-friendly |
| Cedar | AI Governance / Policy | STUDY | Modern safety guarantees, readable syntax, good performance characteristics |
| Guardrails AI | AI Governance / Policy | INTEGRATE | Direct LLM output validation, automatic correction, agent safety focus |
| Inline | AI Governance / Policy | STUDY | Lightweight option for simple policy enforcement needs |
| opencode-rate-limit-fallback | Model Routing / Fallback | STUDY | Solves practical rate limit problems in free tier usage |
| LiteLLM | Model Routing / Fallback | INTEGRATE | Vendor lock-in prevention, intelligent routing, cost tracking, load balancing |
| OpenRouter | Model Routing / Fallback | INTEGRATE | Vast model access through single API, automatic fallback, cost transparency |

## 6. Sources
- OpenCode: https://github.com/anomalyco/opencode
- Oh My OpenCode: https://github.com/docevilOck/oh-my-opencode
- Cline: https://github.com/cline/cline
- Roo Code: https://github.com/RooCodeInc/Roo-Code (archived)
- OpenHands: https://github.com/OpenHands/OpenHands
- Aider: https://github.com/Aider-AI/aider
- Continue: https://github.com/continuedev/continue
- AutoGen: https://github.com/microsoft/autogen
- CrewAI: https://github.com/crewAIInc/crewAI
- LangGraph: https://github.com/langchain-ai/langgraph
- OpenCode Swarm: https://github.com/ZaxbyHub/opencode-swarm
- OPA: https://github.com/open-policy-agent/opa
- Cedar: https://github.com/cedar-policy/cedar
- Guardrails AI: https://github.com/guarldrails/guardrails
- Inline: https://github.com/inline-dev/inline (representative)
- opencode-rate-limit-fallback: https://github.com/azumag/opencode-rate-limit-fallback
- LiteLLM: https://github.com/BerriAI/litellm
- OpenRouter: https://github.com/openrouter/openrouter-ui and https://github.com/openrouter/openrouter-core