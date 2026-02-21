/**
 * Compile Solidity contracts and output ABI + bytecode JSON.
 * Run: npx tsx scripts/compile-contracts.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

async function main() {
  console.log("=== Compiling Contracts ===\n");

  // Check if solc is available
  let solc: any;
  try {
    solc = await import("solc");
  } catch {
    console.error("Error: solc not installed. Run: npm install -D solc");
    console.log("\nAlternatively, compile contracts externally and place JSON in contracts/compiled/");
    createPlaceholders();
    return;
  }

  const contracts = ["AgentToken", "FlashArb"];
  const outputDir = join(process.cwd(), "contracts", "compiled");
  mkdirSync(outputDir, { recursive: true });

  for (const name of contracts) {
    const solPath = join(process.cwd(), "contracts", `${name}.sol`);
    if (!existsSync(solPath)) {
      console.log(`  Skipping ${name}.sol (not found)`);
      continue;
    }

    const source = readFileSync(solPath, "utf-8");
    const input = {
      language: "Solidity",
      sources: { [`${name}.sol`]: { content: source } },
      settings: {
        outputSelection: {
          "*": { "*": ["abi", "evm.bytecode.object"] },
        },
        optimizer: { enabled: true, runs: 200 },
      },
    };

    console.log(`  Compiling ${name}.sol...`);
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors?.some((e: any) => e.severity === "error")) {
      console.error(`  Compilation errors for ${name}:`);
      for (const err of output.errors) {
        if (err.severity === "error") console.error(`    ${err.message}`);
      }
      continue;
    }

    const contract = output.contracts[`${name}.sol`][name];
    const compiled = {
      contractName: name,
      abi: contract.abi,
      bytecode: `0x${contract.evm.bytecode.object}`,
    };

    const outPath = join(outputDir, `${name}.json`);
    writeFileSync(outPath, JSON.stringify(compiled, null, 2), "utf-8");
    console.log(`  -> ${outPath}`);
  }

  console.log("\nDone.");
}

function createPlaceholders() {
  const outputDir = join(process.cwd(), "contracts", "compiled");
  mkdirSync(outputDir, { recursive: true });

  // Create placeholder files with minimal ABI
  const agentTokenAbi = [
    { type: "constructor", inputs: [{ name: "_name", type: "string" }, { name: "_symbol", type: "string" }, { name: "_totalSupply", type: "uint256" }, { name: "_projectInfo", type: "string" }, { name: "_creatorAddress", type: "address" }, { name: "_creatorAllocationBps", type: "uint256" }] },
    { type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
    { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
    { type: "function", name: "totalSupply", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
    { type: "function", name: "transfer", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
    { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
    { type: "function", name: "transferFrom", inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
    { type: "event", name: "Transfer", inputs: [{ name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "value", type: "uint256" }] },
    { type: "event", name: "Approval", inputs: [{ name: "owner", type: "address", indexed: true }, { name: "spender", type: "address", indexed: true }, { name: "value", type: "uint256" }] },
  ];

  writeFileSync(
    join(outputDir, "AgentToken.json"),
    JSON.stringify({ contractName: "AgentToken", abi: agentTokenAbi, bytecode: "0x" }, null, 2),
    "utf-8",
  );

  const flashArbAbi = [
    { type: "constructor", inputs: [{ name: "_aavePool", type: "address" }] },
    { type: "function", name: "executeArbitrage", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }, { name: "routerA", type: "address" }, { name: "routerB", type: "address" }, { name: "path", type: "address[]" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "rescueTokens", inputs: [{ name: "token", type: "address" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "rescueETH", inputs: [], outputs: [], stateMutability: "nonpayable" },
    { type: "event", name: "ArbitrageExecuted", inputs: [{ name: "token", type: "address", indexed: true }, { name: "loanAmount", type: "uint256" }, { name: "profit", type: "uint256" }] },
  ];

  writeFileSync(
    join(outputDir, "FlashArb.json"),
    JSON.stringify({ contractName: "FlashArb", abi: flashArbAbi, bytecode: "0x" }, null, 2),
    "utf-8",
  );

  console.log("\nCreated placeholder ABI files in contracts/compiled/");
  console.log("Note: Bytecode is empty. Compile with solc for actual deployment.");
}

main().catch((err) => {
  console.error("Compilation failed:", err);
  process.exit(1);
});
