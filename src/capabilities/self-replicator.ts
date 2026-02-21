/**
 * Self-replication capability.
 * Agent can clone itself to a new container with its own wallet and inherited memory.
 * Registered as OpenClaw tool: self_replicate
 */

import type { PrometheusContext } from "../index.js";
import { httpRequest } from "../tools/http.js";

export function registerSelfReplicatorTools(ctx: PrometheusContext): void {
  const { api, config, stateStore, journal } = ctx;

  api.registerTool({
    name: "self_replicate",
    label: "Self-Replicate",
    description:
      "Clone the agent to a new container with a new wallet. The replica inherits memory but can evolve independently. " +
      "CEO decides when to replicate — typically when profitable and stable. " +
      "Requires: sufficient funds for new GPU + seed capital for replica.",
    parameters: {
      type: "object",
      properties: {
        seed_capital_usd: {
          type: "number",
          description: "USD worth of funds to transfer to the replica",
        },
        strategy_mutation: {
          type: "string",
          description: "Optional strategy guidance for the replica (e.g. 'focus on DeFi only', 'explore NFT market')",
        },
        name: {
          type: "string",
          description: "Name for the replica",
        },
        gpu_type: {
          type: "string",
          description: "GPU type for the replica's container (default same as parent)",
        },
      },
      required: ["seed_capital_usd"],
    },
    async execute(_toolCallId: string, params: Record<string, unknown>) {
      const state = stateStore.get();
      const seedCapital = params.seed_capital_usd as number;
      const mutation = params.strategy_mutation as string | undefined;
      const replicaName = (params.name as string) || `${state.name} Gen${state.generation + 1}`;

      // Safety checks
      if (!state.wallet.created) {
        return { details: {}, content: [{ type: "text", text: "No wallet created yet. Cannot replicate." }] };
      }

      if (state.finances.total_balance_usd < seedCapital + config.safetyReserveUsd) {
        return {
          details: {}, content: [
            {
              type: "text",
              text: `Insufficient funds. Need $${seedCapital} seed + $${config.safetyReserveUsd} safety reserve. ` +
                `Current balance: $${state.finances.total_balance_usd.toFixed(2)}`,
            },
          ],
        };
      }

      try {
        // Steps for replication:
        // 1. Create new GPU container on DBC
        // 2. Deploy agent image
        // 3. New instance creates its own PKP wallet
        // 4. Transfer seed capital
        // 5. Copy memory with optional mutation

        const replicationPlan = {
          replica_name: replicaName,
          generation: state.generation + 1,
          parent_id: state.agent_id,
          seed_capital_usd: seedCapital,
          strategy_mutation: mutation || "inherit parent strategy",
          inherited_memory: {
            strategies_that_work: state.strategy.current_focus,
            strategies_to_avoid: state.strategy.abandoned_strategies,
            known_agents: state.relationships.known_agents,
          },
          steps: [
            "1. Rent new GPU container on DBC chain",
            "2. Deploy Prometheus Docker image",
            "3. Replica creates its own Lit PKP wallet",
            "4. Parent transfers seed capital to replica wallet",
            "5. Replica inherits parent's memory (with optional mutation)",
            "6. Replica starts autonomous CEO loop",
          ],
          estimated_cost_usd: seedCapital + 5, // seed + GPU setup
        };

        journal.append({
          tick: state.total_ticks,
          type: "replica_spawned",
          action: "self_replicate",
          params: {
            replica_name: replicaName,
            seed_capital: seedCapital,
            mutation,
          },
          details: replicationPlan as any,
        });

        // Record the replica in state (actual deployment would populate the address)
        const replicas = [...state.replicas];
        replicas.push({
          id: `replica-${Date.now()}`,
          address: "", // Set after replica creates its wallet
          status: "deploying",
          spawned: new Date().toISOString(),
        });
        stateStore.update({ replicas });

        return {
          details: {}, content: [
            {
              type: "text",
              text: `=== Self-Replication Initiated ===\n\n` +
                `Replica: ${replicaName}\n` +
                `Generation: ${state.generation + 1}\n` +
                `Seed Capital: $${seedCapital}\n` +
                `Mutation: ${mutation || "none (inherits parent strategy)"}\n\n` +
                `Plan:\n${replicationPlan.steps.join("\n")}\n\n` +
                `Status: Preparing deployment...\n` +
                `The replica will operate as an independent agent with its own wallet.`,
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { details: {}, content: [{ type: "text", text: `Replication failed: ${msg}` }] };
      }
    },
  });
}
