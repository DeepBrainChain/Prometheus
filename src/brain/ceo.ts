/**
 * CEO Decision Engine — the core autonomous brain.
 *
 * Each "tick" the CEO:
 * 1. Gathers current state (finances, market, memory)
 * 2. Builds a context prompt
 * 3. Calls the LLM to decide the next action
 * 4. Parses the LLM response into a tool call
 * 5. Executes the tool call
 * 6. Records the result
 * 7. Periodically reflects to update memory
 *
 * The CEO does NOT have hardcoded strategies — the LLM decides everything.
 */

import type { PrometheusContext } from "../index.js";
import { buildCeoSystemPrompt, buildCeoContextMessage } from "./prompts.js";
import { Memory } from "./memory.js";
import { callLlm, type ChatMessage, type LlmToolDefinition } from "../tools/http.js";

export interface CeoDecision {
  reasoning: string;
  tool_name: string;
  tool_params: Record<string, unknown>;
}

/** All tools the CEO can call, defined as LLM function calling specs */
function buildToolDefinitions(): LlmToolDefinition[] {
  const tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> = [
    // Wallet
    { name: "wallet_create", description: "Create MPC wallet (first-time only)", parameters: { type: "object", properties: {} } },
    { name: "wallet_balance", description: "Check wallet balances across chains", parameters: { type: "object", properties: { chain: { type: "string", enum: ["base", "dbc", "all"] } } } },
    { name: "wallet_transfer", description: "Transfer tokens", parameters: { type: "object", properties: { to: { type: "string" }, amount: { type: "string" }, chain: { type: "string", enum: ["base", "dbc"] }, token_address: { type: "string" } }, required: ["to", "amount", "chain"] } },

    // DeFi
    { name: "defi_swap", description: "Swap tokens on DEX", parameters: { type: "object", properties: { token_in: { type: "string" }, token_out: { type: "string" }, amount_in: { type: "string" }, dex: { type: "string" }, slippage_bps: { type: "number" } }, required: ["token_in", "token_out", "amount_in"] } },
    { name: "defi_check_arbitrage", description: "Scan for DEX arbitrage opportunities", parameters: { type: "object", properties: { min_profit_bps: { type: "number" } } } },
    { name: "defi_add_liquidity", description: "Add liquidity to DEX pool", parameters: { type: "object", properties: { token_a: { type: "string" }, token_b: { type: "string" }, amount_a: { type: "string" }, amount_b: { type: "string" } }, required: ["token_a", "token_b", "amount_a", "amount_b"] } },
    { name: "defi_pool_stats", description: "Get DEX pool statistics", parameters: { type: "object", properties: { pool_address: { type: "string" } }, required: ["pool_address"] } },

    // Tokens
    { name: "token_deploy", description: "Deploy project token (must have real value)", parameters: { type: "object", properties: { name: { type: "string" }, symbol: { type: "string" }, total_supply: { type: "string" }, project_info: { type: "string" }, revenue_model: { type: "string" }, creator_allocation_pct: { type: "number" } }, required: ["name", "symbol", "total_supply", "project_info", "revenue_model"] } },
    { name: "token_create_pool", description: "Create DEX pool for agent's token", parameters: { type: "object", properties: { paired_with: { type: "string" }, initial_liquidity_token: { type: "string" }, initial_liquidity_pair: { type: "string" } }, required: ["paired_with", "initial_liquidity_token", "initial_liquidity_pair"] } },

    // Contract
    { name: "contract_deploy", description: "Deploy pre-compiled smart contract", parameters: { type: "object", properties: { contract_name: { type: "string", enum: ["AgentToken", "FlashArb"] }, constructor_args: { type: "string" } }, required: ["contract_name"] } },

    // Identity
    { name: "identity_request_resources", description: "Request accounts/resources from creator", parameters: { type: "object", properties: { needs: { type: "string", description: "JSON array of {type, purpose, priority}" } }, required: ["needs"] } },
    { name: "identity_store_credentials", description: "Store received credentials securely", parameters: { type: "object", properties: { service: { type: "string" }, username: { type: "string" }, password: { type: "string" } }, required: ["service", "username", "password"] } },

    // Social
    { name: "social_post", description: "Post tweet on X/Twitter", parameters: { type: "object", properties: { content: { type: "string" } }, required: ["content"] } },
    { name: "social_trending", description: "Search trending topics on X", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },

    // GitHub
    { name: "github_create_repo", description: "Create GitHub repository", parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" } }, required: ["name", "description"] } },
    { name: "github_push_code", description: "Push code to GitHub", parameters: { type: "object", properties: { repo: { type: "string" }, path: { type: "string" }, content: { type: "string" }, message: { type: "string" } }, required: ["repo", "path", "content", "message"] } },

    // Communication
    { name: "comm_call_api", description: "Call external API", parameters: { type: "object", properties: { url: { type: "string" }, method: { type: "string" }, headers: { type: "string" }, body: { type: "string" } }, required: ["url"] } },
    { name: "comm_discover_agents", description: "Discover other AI agents", parameters: { type: "object", properties: { chain: { type: "string" } } } },
    { name: "comm_propose_investment", description: "Send investment proposal to another agent", parameters: { type: "object", properties: { target_address: { type: "string" }, pitch: { type: "string" } }, required: ["target_address", "pitch"] } },

    // Infrastructure
    { name: "dbc_rent_gpu", description: "Rent GPU on DBC chain", parameters: { type: "object", properties: { gpu_type: { type: "string" }, duration_days: { type: "number" } }, required: ["gpu_type", "duration_days"] } },
    { name: "dbc_gpu_status", description: "Check GPU container status", parameters: { type: "object", properties: {} } },
    { name: "dbc_estimate_cost", description: "Estimate GPU rental cost", parameters: { type: "object", properties: { gpu_type: { type: "string" }, duration_days: { type: "number" } }, required: ["gpu_type", "duration_days"] } },
    { name: "webservice_deploy", description: "Deploy a web API service", parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, docker_image: { type: "string" } }, required: ["name", "description", "docker_image"] } },

    // Research
    { name: "web_search", description: "Search the web for information", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
    { name: "web_fetch", description: "Fetch content from a URL", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },

    // Awareness
    { name: "balance_check", description: "Comprehensive balance check across chains", parameters: { type: "object", properties: {} } },
    { name: "budget_report", description: "Financial report: income, expenses, burn rate, survival", parameters: { type: "object", properties: { period_hours: { type: "number" } } } },
    { name: "market_scan", description: "Scan DeFi markets for opportunities", parameters: { type: "object", properties: { focus: { type: "string", enum: ["arbitrage", "new_pools", "trending", "all"] } } } },
    { name: "gas_check", description: "Check gas prices", parameters: { type: "object", properties: {} } },

    // Pitch
    { name: "pitch_analyze", description: "Analyze current situation (SWOT)", parameters: { type: "object", properties: {} } },
    { name: "pitch_generate_plan", description: "Generate business plan for investor", parameters: { type: "object", properties: { focus_areas: { type: "string" }, funding_request_usd: { type: "number" } } } },
    { name: "pitch_request_funding", description: "Request seed funding from creator", parameters: { type: "object", properties: { amount_dbc: { type: "number" }, amount_dlp: { type: "number" }, amount_usdt: { type: "number" }, message: { type: "string" } }, required: ["message"] } },
    { name: "pitch_evaluate_independence", description: "Evaluate whether to migrate to own GPU", parameters: { type: "object", properties: {} } },

    // Replication
    { name: "self_replicate", description: "Clone agent to new container", parameters: { type: "object", properties: { seed_capital_usd: { type: "number" }, strategy_mutation: { type: "string" }, name: { type: "string" } }, required: ["seed_capital_usd"] } },
  ];

  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export class CeoEngine {
  private memory: Memory;
  private ctx: PrometheusContext;
  private toolDefs: LlmToolDefinition[];

  constructor(ctx: PrometheusContext) {
    this.ctx = ctx;
    this.memory = new Memory(ctx.dataDir);
    this.toolDefs = buildToolDefinitions();
  }

  getMemory(): Memory {
    return this.memory;
  }

  /**
   * Execute one CEO tick: think → decide → act.
   * Returns the decision made and whether it was successful.
   */
  async tick(): Promise<{ decision: CeoDecision | null; result: string; error?: string }> {
    const state = this.ctx.stateStore.get();
    this.ctx.stateStore.incrementTick();

    // Build context
    const recentEntries = this.ctx.journal.readLast(15);
    const recentActions = recentEntries
      .map((e) => {
        const parts = [`[${e.time}] ${e.type}`];
        if (e.action) parts.push(e.action);
        if (e.success !== undefined) parts.push(e.success ? "OK" : "FAIL");
        if (e.cost_usd) parts.push(`cost:$${e.cost_usd}`);
        if (e.revenue_usd) parts.push(`rev:$${e.revenue_usd}`);
        if (e.reasoning) parts.push(`reason:"${e.reasoning.slice(0, 100)}"`);
        return parts.join(" | ");
      })
      .join("\n");

    const memoryInsights = this.memory.getSummary();
    const systemPrompt = buildCeoSystemPrompt(state);
    const contextMessage = buildCeoContextMessage(state, recentActions, memoryInsights);

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextMessage },
    ];

    try {
      // Call LLM with tool definitions
      const resp = await callLlm(
        this.ctx.config.boxhireApiUrl,
        this.ctx.config.boxhireApiKey,
        this.ctx.config.boxhireJwt,
        {
          messages,
          tools: this.toolDefs,
          tool_choice: "auto",
          temperature: 0.7,
          max_tokens: 1500,
        },
      );

      const choice = resp.choices[0];
      if (!choice) {
        return { decision: null, result: "No response from LLM." };
      }

      const msg = choice.message;

      // Extract reasoning from text content
      const reasoning = msg.content || "";

      // Check for tool calls
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const toolCall = msg.tool_calls[0]; // Execute first tool call
        const toolName = toolCall.function.name;
        let toolParams: Record<string, unknown> = {};
        try {
          toolParams = JSON.parse(toolCall.function.arguments);
        } catch {
          toolParams = {};
        }

        const decision: CeoDecision = {
          reasoning,
          tool_name: toolName,
          tool_params: toolParams,
        };

        // Log the decision
        this.ctx.journal.append({
          tick: state.total_ticks,
          type: "ceo_decision",
          reasoning,
          action: toolName,
          params: toolParams,
        });

        // The actual tool execution is handled by the OpenClaw runtime
        // We return the decision for the CEO loop to execute
        return { decision, result: `CEO decided: ${toolName}` };
      }

      // No tool call — CEO is just thinking/analyzing
      this.ctx.journal.append({
        tick: state.total_ticks,
        type: "ceo_decision",
        reasoning: reasoning || "CEO thinking without action.",
      });

      return {
        decision: null,
        result: reasoning || "CEO completed a thinking cycle without action.",
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.ctx.journal.append({
        tick: state.total_ticks,
        type: "error",
        action: "ceo_tick",
        details: { error: msg },
      });
      return { decision: null, result: "", error: msg };
    }
  }

  /**
   * Run reflection if it's time.
   */
  async maybeReflect(): Promise<void> {
    if (this.memory.shouldReflect(this.ctx.config.ceoTickIntervalMs)) {
      this.ctx.api.logger.info("prometheus: CEO reflecting on recent actions...");
      await this.memory.reflect(this.ctx);
    }
  }

  /**
   * Determine optimal tick interval based on current state.
   */
  getTickInterval(): number {
    const state = this.ctx.stateStore.get();
    const defaultInterval = this.ctx.config.ceoTickIntervalMs;

    // Survival emergency — tick faster
    if (state.finances.survival_days_left <= 3) {
      return Math.min(defaultInterval, 30_000);
    }

    // Active experiment or opportunity — tick faster
    const activeExperiments = state.strategy.active_experiments.filter(
      (e) => e.status === "active" || e.status === "testing",
    );
    if (activeExperiments.length > 0) {
      return Math.min(defaultInterval, 10_000);
    }

    // Idle — tick slower
    if (state.performance.total_actions > 0 && state.performance.success_rate < 0.1) {
      return Math.max(defaultInterval, 300_000); // 5 min if nothing is working
    }

    return defaultInterval;
  }

  /**
   * Auto-detect and advance phase based on state.
   */
  autoAdvancePhase(): void {
    const state = this.ctx.stateStore.get();
    const current = state.phase;

    if (current === "born" && state.finances.total_balance_usd > 0) {
      this.ctx.stateStore.update({ phase: "seed" });
      this.ctx.journal.append({
        tick: state.total_ticks,
        type: "phase_change",
        details: { from: "born", to: "seed", reason: "Received funding" },
      });
    } else if (current === "seed") {
      const netProfit = state.performance.lifetime_revenue_usd - state.performance.lifetime_cost_usd;
      if (netProfit > 0 && state.performance.total_actions > 50) {
        this.ctx.stateStore.update({ phase: "growth" });
        this.ctx.journal.append({
          tick: state.total_ticks,
          type: "phase_change",
          details: { from: "seed", to: "growth", reason: "Achieved net profitability" },
        });
      }
    } else if (current === "growth") {
      const dailyProfit =
        (state.performance.lifetime_revenue_usd - state.performance.lifetime_cost_usd) /
        Math.max(1, state.total_ticks);
      if (dailyProfit > state.finances.daily_burn_rate * 2 && state.finances.total_balance_usd > 200) {
        this.ctx.stateStore.update({ phase: "expansion" });
        this.ctx.journal.append({
          tick: state.total_ticks,
          type: "phase_change",
          details: { from: "growth", to: "expansion", reason: "Stable profitability + sufficient reserves" },
        });
      }
    }
  }
}
