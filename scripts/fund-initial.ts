/**
 * One-time script: Send initial seed funds to the agent's wallet.
 * Run: npx tsx scripts/fund-initial.ts
 *
 * This is the "angel investment" — the creator sends DBC, DLP credits, and USDT.
 */

import "dotenv/config";

async function main() {
  console.log("=== Prometheus - Initial Funding ===\n");

  const agentAddress = process.env.LIT_PKP_ETH_ADDRESS;
  if (!agentAddress) {
    console.error("Error: LIT_PKP_ETH_ADDRESS not set. Run setup-wallet first.");
    process.exit(1);
  }

  console.log(`Agent wallet: ${agentAddress}`);
  console.log("\nTo fund the agent, send tokens to the address above:");
  console.log("  1. DBC tokens → DBC chain (for GPU rental)");
  console.log("  2. DLP credits → BoxHire (for LLM inference)");
  console.log("  3. USDT → Base L2 (for working capital)");
  console.log("  4. Small ETH → Base L2 (for gas fees)");
  console.log("\nRecommended initial funding:");
  console.log("  - 100-500 DBC (GPU rental: ~$0.50/day)");
  console.log("  - 50+ DLP credits (inference: ~$0.10/day)");
  console.log("  - $50-100 USDT (working capital for DeFi/projects)");
  console.log("  - 0.01 ETH (gas on Base L2)");
  console.log("\nThis is a seed investment. Returns come via the agent's project tokens.");
  console.log("The agent will analyze its situation and generate a business plan.");
}

main().catch((err) => {
  console.error("Funding script failed:", err);
  process.exit(1);
});
