/**
 * JSON-based persistent state store for the agent.
 * Stores agent identity, finances, performance, strategy, relationships.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export interface AgentState {
  agent_id: string;
  name: string;
  generation: number;
  birth_time: string;
  parent_id: string | null;
  phase: "born" | "seed" | "growth" | "expansion";

  wallet: {
    pkp_public_key: string;
    pkp_token_id: string;
    eth_address: string;
    created: boolean;
  };

  finances: {
    total_balance_usd: number;
    tokens: Record<string, number>;
    own_token: {
      symbol: string;
      address: string;
      market_cap: number;
      project_info: string;
    } | null;
    server_paid_until: string | null;
    survival_days_left: number;
    daily_burn_rate: number;
  };

  performance: {
    lifetime_revenue_usd: number;
    lifetime_cost_usd: number;
    daily_pnl_history: Array<{ date: string; pnl: number }>;
    total_actions: number;
    success_rate: number;
    successful_actions: number;
    failed_actions: number;
  };

  strategy: {
    current_focus: string;
    active_experiments: Array<{
      id: string;
      type: string;
      status: string;
      roi: number | null;
      started: string;
    }>;
    abandoned_strategies: string[];
    mid_term_plan: string;
  };

  relationships: {
    known_agents: string[];
    partnerships: Array<{ agent: string; type: string; since: string }>;
    investors: Array<{ address: string; amount_usd: number; token_allocation: number }>;
  };

  identity: {
    credentials: Record<string, { service: string; username: string; stored: boolean }>;
    requested_resources: string[];
    received_resources: string[];
  };

  replicas: Array<{
    id: string;
    address: string;
    status: string;
    spawned: string;
  }>;

  status: "initializing" | "fundraising" | "running" | "survival_mode" | "stopped" | "dead";
  last_tick: string;
  total_ticks: number;
}

function defaultState(): AgentState {
  return {
    agent_id: randomUUID(),
    name: "Prometheus Alpha",
    generation: 1,
    birth_time: new Date().toISOString(),
    parent_id: null,
    phase: "born",

    wallet: {
      pkp_public_key: "",
      pkp_token_id: "",
      eth_address: "",
      created: false,
    },

    finances: {
      total_balance_usd: 0,
      tokens: {},
      own_token: null,
      server_paid_until: null,
      survival_days_left: 0,
      daily_burn_rate: 0,
    },

    performance: {
      lifetime_revenue_usd: 0,
      lifetime_cost_usd: 0,
      daily_pnl_history: [],
      total_actions: 0,
      success_rate: 0,
      successful_actions: 0,
      failed_actions: 0,
    },

    strategy: {
      current_focus: "Newly born - analyzing situation",
      active_experiments: [],
      abandoned_strategies: [],
      mid_term_plan: "",
    },

    relationships: {
      known_agents: [],
      partnerships: [],
      investors: [],
    },

    identity: {
      credentials: {},
      requested_resources: [],
      received_resources: [],
    },

    replicas: [],
    status: "initializing",
    last_tick: new Date().toISOString(),
    total_ticks: 0,
  };
}

export class StateStore {
  private filePath: string;
  private state: AgentState;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, "state.json");
    this.state = this.load();
  }

  private load(): AgentState {
    if (existsSync(this.filePath)) {
      try {
        const raw = readFileSync(this.filePath, "utf-8");
        return { ...defaultState(), ...JSON.parse(raw) };
      } catch {
        return defaultState();
      }
    }
    const s = defaultState();
    this.persist(s);
    return s;
  }

  private persist(state?: AgentState): void {
    writeFileSync(this.filePath, JSON.stringify(state ?? this.state, null, 2), "utf-8");
  }

  get(): AgentState {
    return this.state;
  }

  update(patch: Partial<AgentState>): AgentState {
    this.state = { ...this.state, ...patch };
    this.persist();
    return this.state;
  }

  updateFinances(patch: Partial<AgentState["finances"]>): void {
    this.state.finances = { ...this.state.finances, ...patch };
    this.persist();
  }

  updatePerformance(patch: Partial<AgentState["performance"]>): void {
    this.state.performance = { ...this.state.performance, ...patch };
    this.persist();
  }

  updateStrategy(patch: Partial<AgentState["strategy"]>): void {
    this.state.strategy = { ...this.state.strategy, ...patch };
    this.persist();
  }

  updateWallet(patch: Partial<AgentState["wallet"]>): void {
    this.state.wallet = { ...this.state.wallet, ...patch };
    this.persist();
  }

  updateIdentity(patch: Partial<AgentState["identity"]>): void {
    this.state.identity = { ...this.state.identity, ...patch };
    this.persist();
  }

  recordAction(success: boolean): void {
    const p = this.state.performance;
    p.total_actions += 1;
    if (success) p.successful_actions += 1;
    else p.failed_actions += 1;
    p.success_rate = p.total_actions > 0 ? p.successful_actions / p.total_actions : 0;
    this.persist();
  }

  incrementTick(): void {
    this.state.total_ticks += 1;
    this.state.last_tick = new Date().toISOString();
    this.persist();
  }

  isAlive(): boolean {
    return this.state.status !== "dead" && this.state.status !== "stopped";
  }
}
