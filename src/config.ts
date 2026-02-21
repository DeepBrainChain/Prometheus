/**
 * Prometheus plugin configuration schema and types.
 */

export interface PrometheusConfig {
  // Chain RPCs
  baseRpcUrl: string;
  dbcRpcUrl: string;
  dbcGpuApiUrl: string;

  // Lit Protocol
  litNetwork: "datil" | "naga";

  // BoxHire LLM
  boxhireApiUrl: string;
  boxhireApiKey: string;
  boxhireJwt: string;

  // Safety
  safetyReserveUsd: number;
  maxSingleActionUsd: number;

  // CEO loop
  ceoTickIntervalMs: number;

  // Creator (angel investor)
  creatorAddress: string;
}

const DEFAULTS: Partial<PrometheusConfig> = {
  baseRpcUrl: "https://mainnet.base.org",
  dbcRpcUrl: "https://info.dbcwallet.io",
  dbcGpuApiUrl: "https://dbchain.ai/api",
  litNetwork: "datil",
  boxhireApiUrl: "https://api.boxhire.work/api/v1/proxy/v1",
  safetyReserveUsd: 15,
  maxSingleActionUsd: 10,
  ceoTickIntervalMs: 60_000,
};

function env(key: string, fallback?: string): string {
  return process.env[key] ?? fallback ?? "";
}

export const prometheusConfigSchema = {
  parse(value: unknown): PrometheusConfig {
    const raw = (value ?? {}) as Record<string, unknown>;

    return {
      baseRpcUrl: str(raw.baseRpcUrl, env("BASE_RPC_URL", DEFAULTS.baseRpcUrl)),
      dbcRpcUrl: str(raw.dbcRpcUrl, env("DBC_RPC_URL", DEFAULTS.dbcRpcUrl)),
      dbcGpuApiUrl: str(raw.dbcGpuApiUrl, env("DBC_GPU_API_URL", DEFAULTS.dbcGpuApiUrl)),
      litNetwork: parseLitNetwork(raw.litNetwork),
      boxhireApiUrl: str(raw.boxhireApiUrl, env("BOXHIRE_API_URL", DEFAULTS.boxhireApiUrl)),
      boxhireApiKey: str(raw.boxhireApiKey, env("BOXHIRE_API_KEY")),
      boxhireJwt: str(raw.boxhireJwt, env("BOXHIRE_JWT")),
      safetyReserveUsd: num(raw.safetyReserveUsd, DEFAULTS.safetyReserveUsd!),
      maxSingleActionUsd: num(raw.maxSingleActionUsd, DEFAULTS.maxSingleActionUsd!),
      ceoTickIntervalMs: num(raw.ceoTickIntervalMs, DEFAULTS.ceoTickIntervalMs!),
      creatorAddress: str(raw.creatorAddress, env("CREATOR_WALLET_ADDRESS")),
    };
  },

  uiHints: {
    boxhireApiKey: { label: "BoxHire API Key", sensitive: true },
    boxhireJwt: { label: "BoxHire JWT", sensitive: true },
    litNetwork: { label: "Lit Network", help: "datil (testnet) or naga (mainnet)" },
    safetyReserveUsd: { label: "Safety Reserve (USD)" },
    maxSingleActionUsd: { label: "Max Single Action (USD)" },
    creatorAddress: { label: "Creator Wallet Address" },
  },
};

function str(val: unknown, fallback: string): string {
  if (typeof val === "string" && val.length > 0) return resolveEnvVars(val);
  return fallback;
}

function num(val: unknown, fallback: number): number {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") {
    const n = Number(val);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function parseLitNetwork(val: unknown): "datil" | "naga" {
  const s = typeof val === "string" ? val : env("LIT_NETWORK", "datil");
  return s === "naga" ? "naga" : "datil";
}

function resolveEnvVars(input: string): string {
  return input.replace(/\$\{(\w+)\}/g, (_, key) => process.env[key] ?? "");
}
