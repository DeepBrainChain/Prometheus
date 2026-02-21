/**
 * Token Factory - Value-oriented token deployment.
 * Core principle: Only deploy tokens backed by real project value, never air tokens.
 * Registered as OpenClaw tools: token_deploy, token_create_pool, token_project_update
 */

import type { PrometheusContext } from "../index.js";
import type { Address } from "../tools/web3.js";

export function registerTokenFactoryTools(ctx: PrometheusContext): void {
  const { api, config, stateStore, journal } = ctx;

  api.registerTool({
    name: "token_deploy",
    label: "Deploy Project Token",
    description:
      "Deploy an ERC20 token on Base for a real project the agent has built. " +
      "IMPORTANT: Only call this after establishing a valuable project with real users or revenue. " +
      "The token represents equity in the project.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Token name (e.g. 'Prometheus Token')" },
        symbol: { type: "string", description: "Token symbol (e.g. 'DLIFE')" },
        total_supply: { type: "string", description: "Total supply (e.g. '1000000')" },
        project_info: {
          type: "string",
          description: "Description of the real project this token represents. What value does it create?",
        },
        revenue_model: {
          type: "string",
          description: "How does the project generate revenue?",
        },
        creator_allocation_pct: {
          type: "number",
          description: "Percentage of tokens allocated to creator/investor (e.g. 10)",
        },
      },
      required: ["name", "symbol", "total_supply", "project_info", "revenue_model"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      if (!state.wallet.created) {
        return { details: {}, content: [{ type: "text", text: "No wallet created yet." }] };
      }

      if (state.finances.own_token) {
        return {
          details: {}, content: [
            {
              type: "text",
              text: `Token already deployed: ${state.finances.own_token.symbol} at ${state.finances.own_token.address}`,
            },
          ],
        };
      }

      const name = params.name as string;
      const symbol = params.symbol as string;
      const totalSupply = params.total_supply as string;
      const projectInfo = params.project_info as string;
      const revenueModel = params.revenue_model as string;
      const creatorPct = (params.creator_allocation_pct as number) || 10;

      try {
        // Load pre-compiled AgentToken bytecode
        // In production, this would deploy via PKP signing
        const deployInfo = {
          name,
          symbol,
          totalSupply,
          projectInfo,
          revenueModel,
          creatorAllocationPct: creatorPct,
          deployer: state.wallet.eth_address,
          chain: "base",
          status: "prepared",
        };

        journal.append({
          tick: state.total_ticks,
          type: "token_deployed",
          action: "token_deploy",
          params: deployInfo as any,
          details: {
            project_info: projectInfo,
            revenue_model: revenueModel,
          },
        });

        // Update state with token info (address will be set after actual deployment)
        stateStore.updateFinances({
          own_token: {
            symbol,
            address: "", // Set after deployment tx confirms
            market_cap: 0,
            project_info: projectInfo,
          },
        });

        return {
          details: {}, content: [
            {
              type: "text",
              text: `Token deployment prepared:\n` +
                `  Name: ${name} (${symbol})\n` +
                `  Supply: ${totalSupply}\n` +
                `  Project: ${projectInfo}\n` +
                `  Revenue Model: ${revenueModel}\n` +
                `  Creator Allocation: ${creatorPct}%\n` +
                `  Chain: Base L2\n\n` +
                `Ready to deploy via contract_deploy with AgentToken bytecode.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Token deploy failed: ${msg}` }] };
      }
    },
  });

  api.registerTool({
    name: "token_create_pool",
    label: "Create DEX Pool",
    description:
      "Create a liquidity pool for the agent's token on a DEX. Pairs with USDC or WETH.",
    parameters: {
      type: "object",
      properties: {
        paired_with: { type: "string", description: "Token to pair with (address or symbol like USDC, WETH)" },
        initial_liquidity_token: { type: "string", description: "Amount of agent's token to add" },
        initial_liquidity_pair: { type: "string", description: "Amount of paired token to add" },
        dex: { type: "string", enum: ["uniswap", "aerodrome"], description: "Which DEX" },
      },
      required: ["paired_with", "initial_liquidity_token", "initial_liquidity_pair"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      if (!state.finances.own_token) {
        return { details: {}, content: [{ type: "text", text: "No token deployed yet. Deploy a token first." }] };
      }

      journal.append({
        tick: state.total_ticks,
        type: "ceo_decision",
        action: "token_create_pool",
        params: params as any,
      });

      return {
        details: {}, content: [
          {
            type: "text",
            text: `Pool creation prepared:\n` +
              `  ${state.finances.own_token.symbol} / ${params.paired_with}\n` +
              `  Liquidity: ${params.initial_liquidity_token} ${state.finances.own_token.symbol} + ${params.initial_liquidity_pair} ${params.paired_with}\n` +
              `  DEX: ${params.dex || "uniswap"}\n\n` +
              `Ready to execute via PKP signing.`,
          },
        ],
      };
    },
  });

  api.registerTool({
    name: "token_project_update",
    label: "Update Project Info",
    description:
      "Update the public project information associated with the agent's token. Transparency builds trust.",
    parameters: {
      type: "object",
      properties: {
        progress: { type: "string", description: "Project progress update" },
        revenue_update: { type: "string", description: "Revenue/financial update" },
        milestones: { type: "string", description: "Milestones achieved" },
      },
      required: ["progress"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      if (!state.finances.own_token) {
        return { details: {}, content: [{ type: "text", text: "No token deployed yet." }] };
      }

      journal.append({
        tick: state.total_ticks,
        type: "milestone",
        action: "token_project_update",
        details: params as any,
      });

      stateStore.updateFinances({
        own_token: {
          ...state.finances.own_token,
          project_info: `${state.finances.own_token.project_info}\n[${new Date().toISOString()}] ${params.progress}`,
        },
      });

      return {
        details: {}, content: [
          {
            type: "text",
            text: `Project info updated for ${state.finances.own_token.symbol}.\nProgress: ${params.progress}`,
          },
        ],
      };
    },
  });
}
