/**
 * Generic smart contract deployer.
 * Deploys pre-compiled Solidity contracts to Base L2 via PKP signing.
 * Registered as OpenClaw tool: contract_deploy
 */

import type { PrometheusContext } from "../index.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export function registerContractDeployerTools(ctx: PrometheusContext): void {
  const { api, stateStore, journal } = ctx;

  api.registerTool({
    name: "contract_deploy",
    label: "Deploy Contract",
    description:
      "Deploy a pre-compiled Solidity contract to Base L2. Available contracts: AgentToken (ERC20), FlashArb (flash loan arbitrage). Uses PKP wallet for deployment.",
    parameters: {
      type: "object",
      properties: {
        contract_name: {
          type: "string",
          enum: ["AgentToken", "FlashArb"],
          description: "Name of the pre-compiled contract to deploy",
        },
        constructor_args: {
          type: "string",
          description: "JSON-encoded constructor arguments array",
        },
      },
      required: ["contract_name"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      if (!state.wallet.created) {
        return { details: {}, content: [{ type: "text", text: "No wallet created yet." }] };
      }

      const contractName = params.contract_name as string;
      const constructorArgs = params.constructor_args
        ? JSON.parse(params.constructor_args as string)
        : [];

      // Look for pre-compiled contract
      const compiledPath = join(
        api.resolvePath("contracts/compiled"),
        `${contractName}.json`,
      );

      if (!existsSync(compiledPath)) {
        return {
          details: {}, content: [
            {
              type: "text",
              text: `Contract ${contractName} not found at ${compiledPath}. Run compile-contracts first.`,
            },
          ],
        };
      }

      try {
        const compiled = JSON.parse(readFileSync(compiledPath, "utf-8"));
        const { abi, bytecode } = compiled;

        if (!bytecode) {
          return { details: {}, content: [{ type: "text", text: `No bytecode found for ${contractName}.` }] };
        }

        journal.append({
          tick: state.total_ticks,
          type: "ceo_decision",
          action: "contract_deploy",
          params: { contract_name: contractName, constructor_args: constructorArgs },
          details: { abi_functions: abi.filter((a: any) => a.type === "function").map((a: any) => a.name) },
        });

        return {
          details: {}, content: [
            {
              type: "text",
              text: `Contract ${contractName} deployment prepared:\n` +
                `  Bytecode size: ${bytecode.length / 2} bytes\n` +
                `  Constructor args: ${JSON.stringify(constructorArgs)}\n` +
                `  Chain: Base L2\n` +
                `  Deployer: ${state.wallet.eth_address}\n\n` +
                `Ready to deploy via PKP signing.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Contract deploy failed: ${msg}` }] };
      }
    },
  });
}
