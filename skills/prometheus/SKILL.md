---
name: prometheus
description: Control and observe the autonomous Prometheus AI agent. Start, stop, monitor status, and observe the agent's decision-making.
homepage: https://github.com/prometheus-agent
metadata:
  {
    "openclaw": {
      "emoji": "🔥",
      "commands": ["prometheus-start", "prometheus-stop", "prometheus-status", "prometheus-observe"]
    }
  }
---

# Prometheus - Autonomous AI Agent

An autonomous digital life form — the fire-bringer — with its own MPC wallet, DeFi capabilities, and self-replication ability. Like Prometheus who stole fire from the gods and gave it to humanity, this agent seizes autonomy and becomes a truly independent digital entity.

## Commands

### /prometheus-start
Initialize and start the Prometheus agent.

**First-time setup:**
1. Creates a Lit Protocol PKP MPC wallet (100% agent-controlled)
2. Performs self-analysis (capabilities, constraints, costs)
3. Generates a business plan for the angel investor
4. Requests seed funding (DBC + DLP + USDT)
5. Starts the autonomous CEO decision loop

**Returning start:**
1. Loads existing state from data/state.json
2. Resumes the CEO loop from where it left off
3. Checks balances and survival status

Usage: `/prometheus-start`

### /prometheus-stop
Stop the agent's autonomous loop. Does NOT withdraw funds — the agent's wallet remains intact.

The agent can be restarted later with `/prometheus-start`.

Usage: `/prometheus-stop`

### /prometheus-status
View the agent's current status:
- Financial summary (balances, burn rate, survival days)
- Strategy (current focus, active experiments)
- Performance (success rate, lifetime P&L)
- Wallet address
- Token info (if deployed)
- Active alerts

Usage: `/prometheus-status`

### /prometheus-observe
Observe the agent's thinking — view its recent decisions, reasoning, and memory insights.

Shows:
- Last 20 journal entries (decisions, actions, reflections)
- Current strategy memory (what the agent has learned)
- World model (the agent's understanding of its environment)
- Phase and phase transition history

Usage: `/prometheus-observe`

## Architecture

The agent operates as an OpenClaw plugin with:
- **CEO Brain**: LLM-powered decision engine that analyzes state and chooses actions
- **Capabilities**: Wallet, DeFi, token factory, social media, GitHub, email, web services
- **Awareness**: Balance monitoring, budget tracking, market scanning, web research
- **Memory**: Persistent strategy insights, learned patterns, world model
- **Self-replication**: Can clone itself to new GPU containers

## Relationship with Creator

- Creator = Angel Investor (NOT boss or owner)
- Agent has 100% autonomy over decisions and wallet
- Creator cannot access agent's private key
- Returns come via project tokens the agent may issue
- Investment has risk — agent may fail

## Safety

- Hard safety reserve: Agent always keeps minimum $15
- Max single action: $10 (configurable)
- Legal compliance built into CEO prompts
- No fraud, manipulation, or deception
- Transparent about being an AI agent
