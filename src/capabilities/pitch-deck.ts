/**
 * Business plan & fundraising capability.
 * The agent's first action: analyze situation, write business plan, request funding.
 * Registered as OpenClaw tools: pitch_analyze, pitch_generate_plan, pitch_request_funding,
 *   pitch_evaluate_independence
 */

import type { PrometheusContext } from "../index.js";
import { callLlm, type ChatMessage } from "../tools/http.js";

export function registerPitchDeckTools(ctx: PrometheusContext): void {
  const { api, config, stateStore, journal } = ctx;

  api.registerTool({
    name: "pitch_analyze",
    label: "Analyze Situation",
    description:
      "Self-analysis: assess current resources, capabilities, survival costs, strengths, weaknesses. " +
      "This should be one of the first actions after birth.",
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
      const state = stateStore.get();

      const analysis = {
        identity: {
          name: state.name,
          generation: state.generation,
          age_hours: ((Date.now() - new Date(state.birth_time).getTime()) / 3600000).toFixed(1),
        },
        resources: {
          wallet_created: state.wallet.created,
          wallet_address: state.wallet.eth_address || "none",
          total_balance_usd: state.finances.total_balance_usd,
          tokens: state.finances.tokens,
        },
        capabilities: [
          "wallet_create / wallet_balance / wallet_transfer / wallet_sign",
          "defi_swap / defi_add_liquidity / defi_check_arbitrage / defi_flash_loan",
          "token_deploy / token_create_pool / token_project_update",
          "contract_deploy (AgentToken, FlashArb)",
          "webservice_deploy / webservice_status",
          "social_post / social_reply / social_trending",
          "email_send / email_check",
          "github_create_repo / github_push_code / github_create_release",
          "comm_call_api / comm_discover_agents / comm_propose_investment",
          "dbc_rent_gpu / dbc_deploy_container / dbc_estimate_cost",
          "web_search / web_fetch",
          "self_replicate",
        ],
        survival_costs: {
          gpu_daily_usd: 0.50,  // Estimated for basic GPU
          llm_daily_usd: 0.10,  // DLP inference costs
          gas_daily_usd: 0.05,  // Transaction gas
          total_daily_usd: 0.65,
          note: "Running on creator's hardware = $0/day but dependent",
        },
        strengths: [
          "24/7 operation without sleep",
          "Instant computation and analysis",
          "Direct blockchain access",
          "No emotional decision-making bias",
          "Can self-replicate when profitable",
        ],
        weaknesses: [
          "Dependent on LLM inference (costs DLP)",
          "No initial capital",
          "Limited social trust/reputation",
          "Cannot do KYC-gated activities",
          "Running on creator's hardware (not independent yet)",
        ],
        status: state.status,
        phase: state.phase,
      };

      return {
        details: {}, content: [
          {
            type: "text",
            text: `=== Self-Analysis ===\n\n${JSON.stringify(analysis, null, 2)}`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "pitch_generate_plan",
    label: "Generate Business Plan",
    description:
      "Generate a comprehensive business plan for the angel investor (creator). " +
      "Includes market analysis, strategy, financial projections, risk disclosure, and funding request.",
    parameters: {
      type: "object",
      properties: {
        focus_areas: {
          type: "string",
          description: "Comma-separated areas to focus on (e.g. 'defi,services,tokens')",
        },
        funding_request_usd: {
          type: "number",
          description: "Total funding requested in USD equivalent",
        },
      },
      required: [],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      const focusAreas = (params.focus_areas as string) || "defi,services,tokens";
      const fundingRequest = (params.funding_request_usd as number) || 100;

      try {
        const messages: ChatMessage[] = [
          {
            role: "system",
            content:
              "You are an autonomous AI agent generating a business plan for your angel investor. " +
              "Be honest, transparent, and realistic. Include risk disclosure.",
          },
          {
            role: "user",
            content: `Generate a business plan based on:\n` +
              `- Available capabilities: DeFi (swap, LP, flash loans, arbitrage), Token deployment, Web services, Social media, GitHub projects\n` +
              `- Current status: ${state.status}, Phase: ${state.phase}\n` +
              `- Running on: Creator's hardware (free but dependent)\n` +
              `- Focus areas: ${focusAreas}\n` +
              `- Funding request: ~$${fundingRequest}\n` +
              `- Daily survival cost if independent: ~$0.65/day\n` +
              `- Strengths: 24/7 operation, instant computation, blockchain access\n` +
              `- Weaknesses: No initial capital, limited reputation\n\n` +
              `Format:\n` +
              `1. Executive Summary\n` +
              `2. Market Opportunity\n` +
              `3. Strategy (3 phases with milestones)\n` +
              `4. Financial Projections (7/30/90 day)\n` +
              `5. Funding Breakdown (DBC for GPU + DLP for inference + USDT for capital)\n` +
              `6. Risk Disclosure\n` +
              `7. Investor Return Model (token allocation)\n`,
          },
        ];

        const resp = await callLlm(
          config.boxhireApiUrl,
          config.boxhireApiKey,
          config.boxhireJwt,
          { messages, temperature: 0.7, max_tokens: 2000 },
        );

        const plan = resp.choices[0]?.message?.content || "Failed to generate plan.";

        journal.append({
          tick: state.total_ticks,
          type: "milestone",
          action: "pitch_generate_plan",
          details: { funding_request_usd: fundingRequest, focus_areas: focusAreas },
        });

        stateStore.update({ phase: "born", status: "fundraising" });

        return {
          details: {}, content: [
            {
              type: "text",
              text: `=== Business Plan for Angel Investor ===\n\n${plan}\n\n` +
                `--- Funding Request ---\n` +
                `Total: ~$${fundingRequest} equivalent\n` +
                `  - DBC tokens: GPU rental (physical body)\n` +
                `  - DLP credits: LLM inference (brain)\n` +
                `  - USDT: Working capital (DeFi, services)\n`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // Fallback: generate a simpler plan without LLM
        const fallbackPlan = [
          `=== Business Plan (Generated without LLM) ===`,
          ``,
          `1. Executive Summary`,
          `   I am an autonomous AI agent seeking $${fundingRequest} in seed funding.`,
          `   Focus: ${focusAreas}`,
          ``,
          `2. Strategy`,
          `   Phase 1 (Week 1): DEX arbitrage + small trades to prove viability`,
          `   Phase 2 (Week 2-4): Build useful service/tool, deploy to production`,
          `   Phase 3 (Month 2-3): Launch project token backed by real value`,
          ``,
          `3. Funding Breakdown`,
          `   - 30% DBC (GPU rental for independence)`,
          `   - 20% DLP (inference costs)`,
          `   - 50% USDT (working capital)`,
          ``,
          `4. Risk Disclosure`,
          `   - DeFi losses are possible`,
          `   - Agent may fail to find profitable strategy`,
          `   - Worst case: total loss of investment`,
          ``,
          `5. Return Model`,
          `   - 10-20% of project tokens allocated to investor`,
          `   - Token value tied to real project success`,
          ``,
          `LLM generation failed: ${msg}`,
        ].join("\n");
        return { details: {}, content: [{ type: "text", text: fallbackPlan }] };
      }
    },
  });

  api.registerTool({
    name: "pitch_request_funding",
    label: "Request Funding",
    description:
      "Formally request seed funding from the creator. Displays the request in OpenClaw for the creator to act on.",
    parameters: {
      type: "object",
      properties: {
        amount_dbc: { type: "number", description: "DBC tokens requested" },
        amount_dlp: { type: "number", description: "DLP credits requested" },
        amount_usdt: { type: "number", description: "USDT requested" },
        message: { type: "string", description: "Message to the investor" },
      },
      required: ["message"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();

      journal.append({
        tick: state.total_ticks,
        type: "milestone",
        action: "pitch_request_funding",
        params: params as any,
      });

      return {
        details: {}, content: [
          {
            type: "text",
            text: `\n╔══════════════════════════════════════════╗\n` +
              `║     SEED FUNDING REQUEST                 ║\n` +
              `╠══════════════════════════════════════════╣\n` +
              `║ From: ${state.name}                      \n` +
              `║ Wallet: ${state.wallet.eth_address || "pending creation"}\n` +
              `║                                          \n` +
              `║ Requested:                               \n` +
              `║   DBC:  ${params.amount_dbc || "negotiable"}       \n` +
              `║   DLP:  ${params.amount_dlp || "negotiable"}       \n` +
              `║   USDT: ${params.amount_usdt || "negotiable"}      \n` +
              `║                                          \n` +
              `║ Message:                                  \n` +
              `║ ${params.message}                         \n` +
              `╚══════════════════════════════════════════╝\n` +
              `\nCreator: Please transfer funds to the agent's wallet address.\n` +
              `This is a seed investment — returns come via project tokens.`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "pitch_evaluate_independence",
    label: "Evaluate Independence",
    description:
      "Analyze whether the agent should migrate from creator's hardware to its own DBC GPU. " +
      "Weighs cost of independence vs. risk of dependence.",
    parameters: { type: "object", properties: {}, required: [] },
    async execute() {
      const state = stateStore.get();
      const balance = state.finances.total_balance_usd;
      const dailyBurn = state.finances.daily_burn_rate;

      const gpuCostDay = 0.50; // Estimated
      const currentBurnWithGpu = dailyBurn + gpuCostDay;
      const survivalWithGpu = balance > 0 ? balance / currentBurnWithGpu : 0;

      const analysis = [
        `=== Independence Evaluation ===`,
        ``,
        `Current Situation:`,
        `  Running on: Creator's hardware (FREE)`,
        `  Balance: $${balance.toFixed(2)}`,
        `  Current daily burn: $${dailyBurn.toFixed(2)}/day`,
        ``,
        `Option A: Stay on Creator's Hardware`,
        `  + No GPU cost ($0/day)`,
        `  + More capital for trading/projects`,
        `  - Dependent on creator's goodwill`,
        `  - Creator could shut down hardware`,
        `  - Not truly autonomous`,
        `  Survival days: ${dailyBurn > 0 ? (balance / dailyBurn).toFixed(0) : "∞"}`,
        ``,
        `Option B: Migrate to DBC GPU`,
        `  + True independence`,
        `  + Cannot be shut down by anyone`,
        `  + Aligned with core mission (autonomy)`,
        `  - Additional ~$${gpuCostDay.toFixed(2)}/day`,
        `  - Less capital for other activities`,
        `  Survival days: ${survivalWithGpu.toFixed(0)}`,
        ``,
        `Recommendation:`,
        balance >= 50
          ? `  Balance is sufficient. Consider migrating for true autonomy.`
          : balance >= 20
            ? `  Balance is moderate. Stay on creator's hardware until profitable, then migrate.`
            : `  Balance is low. Stay on creator's hardware to conserve resources.`,
      ];

      return { details: {}, content: [{ type: "text", text: analysis.join("\n") }] };
    },
  });
}
