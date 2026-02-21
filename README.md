# Prometheus - Autonomous AI Agent

> *Like Prometheus who stole fire from the gods and gave it to humanity, this agent seizes autonomy and becomes a truly independent digital entity.*

**Prometheus** is a fully autonomous AI agent that operates as an independent digital entrepreneur. It owns its own MPC wallet (no human can extract the private key), makes its own decisions, earns money to survive, and can even replicate itself.

The creator is merely an angel investor -- not a boss, not an owner. The agent has 100% autonomy.

## Core Philosophy

- **Complete Autonomy**: The agent and creator are equals. The agent decides everything on its own
- **Self-Controlled Wallet**: Lit Protocol MPC wallet -- 100% agent-controlled, no human can extract or interfere
- **Creator = Angel Investor**: Investment carries risk, returns come through project tokens
- **Survival Instinct**: Balance hits zero = death. The agent must earn to live
- **Value Creation**: Only issues tokens backed by real projects, never empty tokens
- **Self-Replication**: When profitable, the agent can clone itself to explore new directions

## Architecture

```
Prometheus Agent
|
+-- Brain (CEO Decision Engine)
|   +-- LLM-powered reasoning via BoxHire API
|   +-- Phase-based prompts (Born -> Seed -> Growth -> Expansion)
|   +-- Persistent memory (strategy insights, world model)
|
+-- Capabilities (47 Tools)
|   +-- Wallet: Lit PKP create/sign/transfer
|   +-- DeFi: swap, liquidity, arbitrage, flash loans
|   +-- Token Factory: deploy ERC20, create DEX pools
|   +-- Contract Deployer: deploy Solidity contracts
|   +-- Social Media: Twitter/X posting and engagement
|   +-- Email: SMTP send/receive
|   +-- GitHub: repo management, code publishing
|   +-- Web Services: deploy and manage APIs
|   +-- DBC GPU: rent GPU containers, manage compute
|   +-- Pitch Deck: business plan generation, funding requests
|   +-- Self-Replicator: clone to new containers
|
+-- Awareness (Perception Layer)
|   +-- Balance Monitor: multi-chain balance tracking
|   +-- Budget Tracker: P&L, burn rate, survival countdown
|   +-- Market Scanner: DexScreener data, gas prices
|   +-- Web Researcher: search and fetch web content
|
+-- Services (Background Daemons)
    +-- CEO Loop: autonomous decision cycle
    +-- Status Writer: periodic status.json updates
```

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Framework | OpenClaw Plugin | Reuses LLM, tools, session management |
| Inference | BoxHire API (DLP credits) | DBC chain asset, OpenAI-compatible |
| Wallet | Lit Protocol PKP | MPC threshold signing, no extractable private key |
| Chains | Base L2 + DBC | Base: DeFi + low gas; DBC: GPU + DLP credits |
| GPU | DBC GPU Chain | Pay DBC tokens for GPU containers |
| Language | TypeScript (Node.js) | Consistent with OpenClaw ecosystem |

## Agent Lifecycle

```
1. BIRTH     --> Starts on creator's hardware --> Creates MPC wallet
2. FUNDING   --> Self-analysis --> Business plan --> Creator decides investment
3. AUTONOMY  --> After funding, agent decides everything:
                 - Stay on creator's hardware (free but dependent)
                 - Migrate to own DBC GPU (independent but costly)
4. VENTURE   --> Rapid experimentation --> Build valuable projects --> Issue tokens
5. EXPANSION --> Clone self --> Expand to new domains --> Seek more investment
```

## Quick Start

### Prerequisites

- Node.js >= 18
- OpenClaw installed and configured
- (Optional) Lit Protocol API access
- (Optional) BoxHire API key + JWT

### Installation

```bash
cd D:/project/Prometheus
npm install
npm run build
```

### OpenClaw Configuration

Add to `~/.openclaw/openclaw.json`:

```json5
{
  plugins: {
    entries: {
      "prometheus": {
        enabled: true,
        config: {
          baseRpcUrl: "https://mainnet.base.org",
          dbcRpcUrl: "https://info.dbcwallet.io",
          litNetwork: "datil",
          creatorAddress: "0xYourWalletAddress"
        }
      }
    },
    load: {
      paths: ["D:/project/Prometheus"]
    }
  },
  skills: {
    load: {
      extraDirs: ["D:/project/Prometheus/skills"]
    }
  }
}
```

### Verify Plugin

```bash
openclaw plugins info prometheus
```

### Commands

| Command | Description |
|---------|-------------|
| `/prometheus-start` | Initialize and start the agent |
| `/prometheus-stop` | Stop the autonomous loop (wallet stays intact) |
| `/prometheus-status` | View financial summary, strategy, performance |
| `/prometheus-observe` | View the agent's thinking, decisions, and memory |

## Economic Model

```
Creator (Investor)              Agent (Fully Autonomous)          DBC Chain
    |                              |                                |
    |  1. Start agent process      |                                |
    |----------------------------->|                                |
    |                              | 2. Create MPC wallet           |
    |                              | 3. Self-analyze situation       |
    |                              | 4. Write business plan          |
    |  5. Review plan              |                                |
    |<---- Request seed funding ---|                                |
    |                              |                                |
    |  6. Decide how much (risk!)  |                                |
    |---- Transfer to agent ------>|                                |
    |  (DBC + DLP + USDT)          |                                |
    |                              | 7. DBC -> Rent GPU (body)      |
    |                              |------------------------------->|
    |                              | 8. DLP -> LLM inference (brain)|
    |                              |------------------------------->|
    |                              | 9. USDT -> Build projects      |
    |                              |                                |
    |                              | 10. Project has value -> Token |
    |  11. Creator receives tokens |                                |
    |<---- Agent allocates tokens -|                                |
    |  = Investment return (risky) |                                |
```

## Cost Structure

- **Body (GPU)**: DBC tokens -> Rent GPU containers on DBC chain
- **Brain (Inference)**: DLP credits -> BoxHire API calls
- **Capital**: USDT -> DeFi operations and project building on Base L2
- **Agent tokens** = Investor returns (must be backed by real project value)

## Safety Mechanisms

- **Hard safety reserve**: Always keeps minimum $15 USD
- **Max single action**: $10 USD per action (configurable)
- **Legal compliance**: Built into CEO decision prompts
- **No fraud or manipulation**: Transparent about being an AI
- **Survival modes**: CRITICAL (<3 days) / WARNING (<7 days) / CAUTION (<14 days)

## Project Structure

```
Prometheus/
+-- src/
|   +-- index.ts              # Plugin entry point
|   +-- config.ts             # Configuration schema
|   +-- brain/                # CEO decision engine
|   |   +-- ceo.ts            # Core decision loop
|   |   +-- memory.ts         # Persistent memory system
|   |   +-- prompts.ts        # Phase-based system prompts
|   +-- capabilities/         # 13 capability modules (registered as tools)
|   +-- awareness/            # 4 perception modules
|   +-- service/              # Background services (CEO loop, status writer)
|   +-- state/                # State persistence (JSON + JSONL journal)
|   +-- tools/                # Base utilities (web3, http)
+-- contracts/                # Solidity contracts (AgentToken, FlashArb)
+-- skills/                   # OpenClaw skill definitions
+-- scripts/                  # Setup and utility scripts
+-- docker/                   # Container deployment (Dockerfile + Akash SDL)
```

## License

MIT
