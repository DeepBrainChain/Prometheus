/**
 * One-time script: Create a Lit Protocol PKP wallet for the agent.
 * Run: npx tsx scripts/setup-wallet.ts
 */

import "dotenv/config";

async function main() {
  console.log("=== Prometheus - Wallet Setup ===\n");

  const { LitNodeClient } = await import("@lit-protocol/lit-node-client");
  const { LitContracts } = await import("@lit-protocol/contracts-sdk");
  const { LIT_NETWORK } = await import("@lit-protocol/constants");

  const network = process.env.LIT_NETWORK === "naga"
    ? LIT_NETWORK.Naga
    : LIT_NETWORK.DatilDev;

  console.log(`Connecting to Lit Network: ${network}...`);
  const litNodeClient = new LitNodeClient({ litNetwork: network });
  await litNodeClient.connect();
  console.log("Connected to Lit Network.");

  console.log("Minting PKP...");
  const contractClient = new LitContracts({ litNodeClient });
  await contractClient.connect();

  const mintResult = await contractClient.pkpNftContractUtils.write.mint();
  const pkp = mintResult.pkp;

  console.log("\n=== PKP Wallet Created ===");
  console.log(`  Public Key:  ${pkp.publicKey}`);
  console.log(`  Token ID:    ${pkp.tokenId}`);
  console.log(`  ETH Address: ${pkp.ethAddress}`);
  console.log("\nAdd these to your .env file:");
  console.log(`  LIT_PKP_PUBLIC_KEY=${pkp.publicKey}`);
  console.log(`  LIT_PKP_TOKEN_ID=${pkp.tokenId}`);
  console.log(`  LIT_PKP_ETH_ADDRESS=${pkp.ethAddress}`);

  await litNodeClient.disconnect();
  console.log("\nDone. The agent now has its own wallet.");
}

main().catch((err) => {
  console.error("Wallet setup failed:", err);
  process.exit(1);
});
