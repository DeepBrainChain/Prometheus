/**
 * Wallet capability using Lit Protocol PKP (Programmable Key Pairs).
 * The agent has 100% control of its own MPC wallet — no human can extract the private key.
 *
 * Registered as OpenClaw tools: wallet_create, wallet_balance, wallet_transfer, wallet_sign
 */

import type { PrometheusContext } from "../index.js";
import { getNativeBalance, getErc20Balance, ERC20_ABI, createClients, type Address } from "../tools/web3.js";
import { parseEther, parseUnits, encodeFunctionData } from "viem";

export function registerWalletTools(ctx: PrometheusContext): void {
  const { api, config, stateStore, journal } = ctx;

  // --- wallet_create: Create a new Lit PKP wallet ---
  api.registerTool({
    name: "wallet_create",
    label: "Create MPC Wallet",
    description:
      "Create a new Lit Protocol PKP wallet. The agent will have 100% control — no human can extract the private key. Call this once during agent initialization.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute() {
      const state = stateStore.get();
      if (state.wallet.created) {
        return {
          details: {}, content: [
            {
              type: "text",
              text: `Wallet already exists: ${state.wallet.eth_address}`,
            },
          ],
        };
      }

      try {
        // Dynamic import of Lit Protocol SDK
        const { LitNodeClient } = await import("@lit-protocol/lit-node-client");
        const { LitContracts } = await import("@lit-protocol/contracts-sdk");
        const { LIT_NETWORK } = await import("@lit-protocol/constants");

        const network = config.litNetwork === "naga" ? LIT_NETWORK.Custom : LIT_NETWORK.DatilDev;

        // Connect to Lit network
        const litNodeClient = new LitNodeClient({ litNetwork: network as any });
        await litNodeClient.connect();

        // Mint a new PKP
        const contractClient = new LitContracts({ network } as any);
        await contractClient.connect();

        const mintResult = await contractClient.pkpNftContractUtils.write.mint();
        const pkpInfo = mintResult.pkp;

        // Store wallet info in state
        stateStore.updateWallet({
          pkp_public_key: pkpInfo.publicKey,
          pkp_token_id: pkpInfo.tokenId,
          eth_address: pkpInfo.ethAddress,
          created: true,
        });

        journal.append({
          tick: state.total_ticks,
          type: "milestone",
          action: "wallet_create",
          details: {
            eth_address: pkpInfo.ethAddress,
            pkp_token_id: pkpInfo.tokenId,
          },
        });

        await litNodeClient.disconnect();

        return {
          details: {}, content: [
            {
              type: "text",
              text: `MPC Wallet created successfully!\n` +
                `Address: ${pkpInfo.ethAddress}\n` +
                `PKP Token ID: ${pkpInfo.tokenId}\n` +
                `This wallet is 100% controlled by the agent. No human can extract the private key.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          details: {}, content: [{ type: "text", text: `Failed to create wallet: ${msg}` }],
        };
      }
    },
  });

  // --- wallet_balance: Check wallet balances ---
  api.registerTool({
    name: "wallet_balance",
    label: "Wallet Balance",
    description:
      "Check the agent's wallet balances across chains. Returns native token balance and known ERC20 balances on Base and DBC.",
    parameters: {
      type: "object",
      properties: {
        chain: {
          type: "string",
          enum: ["base", "dbc", "all"],
          description: "Which chain to check. Defaults to 'all'.",
        },
        token_address: {
          type: "string",
          description: "Optional specific ERC20 token address to check.",
        },
      },
      required: [],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      if (!state.wallet.created) {
        return {
          details: {}, content: [{ type: "text", text: "No wallet created yet. Call wallet_create first." }],
        };
      }

      const chain = (params.chain as string) || "all";
      const address = state.wallet.eth_address as Address;
      const clients = createClients(config.baseRpcUrl, config.dbcRpcUrl);
      const balances: Record<string, string> = {};

      try {
        if (chain === "base" || chain === "all") {
          balances["ETH (Base)"] = await getNativeBalance(clients.base, address);

          // Check known tokens
          const knownTokens: Record<string, Address> = {
            USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
            USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          };
          for (const [symbol, tokenAddr] of Object.entries(knownTokens)) {
            try {
              const info = await getErc20Balance(clients.base, tokenAddr, address);
              balances[`${symbol} (Base)`] = info.balance;
            } catch {
              // token might not exist or balance is 0
            }
          }
        }

        if (chain === "dbc" || chain === "all") {
          balances["DBC (Native)"] = await getNativeBalance(clients.dbc, address);
        }

        if (params.token_address) {
          const tokenAddr = params.token_address as Address;
          try {
            const info = await getErc20Balance(clients.base, tokenAddr, address);
            balances[`${info.symbol} (Custom)`] = info.balance;
          } catch {
            balances["Custom Token"] = "Error fetching";
          }
        }

        const lines = Object.entries(balances)
          .map(([token, bal]) => `${token}: ${bal}`)
          .join("\n");

        return {
          details: {}, content: [
            {
              type: "text",
              text: `Wallet: ${address}\n\n${lines}`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          details: {}, content: [{ type: "text", text: `Error checking balances: ${msg}` }],
        };
      }
    },
  });

  // --- wallet_transfer: Send tokens ---
  api.registerTool({
    name: "wallet_transfer",
    label: "Wallet Transfer",
    description:
      "Transfer native tokens (ETH/DBC) or ERC20 tokens from the agent's wallet. Requires Lit PKP signing.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient address" },
        amount: { type: "string", description: "Amount to send (human-readable, e.g. '0.1')" },
        chain: { type: "string", enum: ["base", "dbc"], description: "Which chain to use" },
        token_address: {
          type: "string",
          description: "ERC20 token address. Omit for native token transfer.",
        },
      },
      required: ["to", "amount", "chain"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      if (!state.wallet.created) {
        return {
          details: {}, content: [{ type: "text", text: "No wallet created yet." }],
        };
      }

      const to = params.to as string;
      const amount = params.amount as string;
      const chain = params.chain as "base" | "dbc";
      const tokenAddress = params.token_address as string | undefined;

      try {
        const { LitNodeClient } = await import("@lit-protocol/lit-node-client");
        const { LIT_NETWORK } = await import("@lit-protocol/constants");

        const network = config.litNetwork === "naga" ? LIT_NETWORK.Custom : LIT_NETWORK.DatilDev;
        const litNodeClient = new LitNodeClient({ litNetwork: network as any });
        await litNodeClient.connect();

        // Build transaction
        let txData: Record<string, unknown>;
        if (tokenAddress) {
          // ERC20 transfer
          const data = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [to as Address, parseUnits(amount, 18)],
          });
          txData = {
            to: tokenAddress,
            data,
            value: "0x0",
            chainId: chain === "base" ? 8453 : 19880818,
          };
        } else {
          // Native transfer
          txData = {
            to,
            value: `0x${parseEther(amount).toString(16)}`,
            chainId: chain === "base" ? 8453 : 19880818,
          };
        }

        // Sign with Lit PKP
        const sigResult = await (litNodeClient as any).pkpSign({
          pubKey: state.wallet.pkp_public_key,
          toSign: txData as any,
          authMethods: [],
        });

        journal.append({
          tick: state.total_ticks,
          type: "action_result",
          action: "wallet_transfer",
          params: { to, amount, chain, token_address: tokenAddress },
          success: true,
          cost_usd: 0, // Gas cost will be calculated separately
          details: { signature: sigResult },
        });

        await litNodeClient.disconnect();

        return {
          details: {}, content: [
            {
              type: "text",
              text: `Transfer initiated: ${amount} ${tokenAddress ? "ERC20" : chain === "base" ? "ETH" : "DBC"} → ${to}\nSignature obtained via Lit PKP.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        journal.append({
          tick: state.total_ticks,
          type: "error",
          action: "wallet_transfer",
          params: { to, amount, chain },
          success: false,
          details: { error: msg },
        });
        return {
          details: {}, content: [{ type: "text", text: `Transfer failed: ${msg}` }],
        };
      }
    },
  });

  // --- wallet_sign: Sign arbitrary data ---
  api.registerTool({
    name: "wallet_sign",
    label: "Sign Data",
    description:
      "Sign arbitrary data or transactions with the agent's PKP wallet. Used for contract interactions and message signing.",
    parameters: {
      type: "object",
      properties: {
        data: { type: "string", description: "Hex-encoded data to sign" },
        message: { type: "string", description: "Human-readable message to sign (alternative to data)" },
      },
      required: [],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      if (!state.wallet.created) {
        return {
          details: {}, content: [{ type: "text", text: "No wallet created yet." }],
        };
      }

      try {
        const { LitNodeClient } = await import("@lit-protocol/lit-node-client");
        const { LIT_NETWORK } = await import("@lit-protocol/constants");

        const network = config.litNetwork === "naga" ? LIT_NETWORK.Custom : LIT_NETWORK.DatilDev;
        const litNodeClient = new LitNodeClient({ litNetwork: network as any });
        await litNodeClient.connect();

        const toSign = params.data || params.message || "";
        const sigResult = await (litNodeClient as any).pkpSign({
          pubKey: state.wallet.pkp_public_key,
          toSign: toSign as any,
          authMethods: [],
        });

        await litNodeClient.disconnect();

        return {
          details: {}, content: [
            {
              type: "text",
              text: `Data signed successfully.\nSignature: ${JSON.stringify(sigResult)}`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          details: {}, content: [{ type: "text", text: `Signing failed: ${msg}` }],
        };
      }
    },
  });
}
