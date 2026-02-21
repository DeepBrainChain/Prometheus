/**
 * JSONL action journal for recording every decision and action.
 * Append-only log for full audit trail.
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type JournalEntryType =
  | "ceo_decision"
  | "action_result"
  | "reflection"
  | "balance_update"
  | "error"
  | "milestone"
  | "funding_received"
  | "token_deployed"
  | "replica_spawned"
  | "phase_change"
  | "resource_request"
  | "resource_received";

export interface JournalEntry {
  time: string;
  tick: number;
  type: JournalEntryType;
  reasoning?: string;
  action?: string;
  params?: Record<string, unknown>;
  success?: boolean;
  cost_usd?: number;
  revenue_usd?: number;
  tx?: string;
  insights?: string[];
  details?: Record<string, unknown>;
}

export class Journal {
  private filePath: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, "journal.jsonl");
  }

  /** Append a new entry to the journal */
  append(entry: Partial<JournalEntry> & { type: JournalEntryType }): void {
    const full: JournalEntry = {
      time: new Date().toISOString(),
      tick: 0,
      ...entry,
    };
    appendFileSync(this.filePath, JSON.stringify(full) + "\n", "utf-8");
  }

  /** Read the last N entries */
  readLast(n: number): JournalEntry[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean);
    const start = Math.max(0, lines.length - n);
    return lines.slice(start).map((line) => {
      try {
        return JSON.parse(line) as JournalEntry;
      } catch {
        return { time: "", tick: 0, type: "error" as const, details: { raw: line } };
      }
    });
  }

  /** Read all entries of a specific type */
  readByType(type: JournalEntryType, limit = 100): JournalEntry[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean);

    const results: JournalEntry[] = [];
    for (let i = lines.length - 1; i >= 0 && results.length < limit; i--) {
      try {
        const entry = JSON.parse(lines[i]) as JournalEntry;
        if (entry.type === type) results.push(entry);
      } catch {
        // skip malformed
      }
    }
    return results.reverse();
  }

  /** Get total revenue and cost from the journal */
  getFinancialSummary(): { totalRevenue: number; totalCost: number } {
    if (!existsSync(this.filePath)) return { totalRevenue: 0, totalCost: 0 };
    const lines = readFileSync(this.filePath, "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean);

    let totalRevenue = 0;
    let totalCost = 0;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as JournalEntry;
        if (entry.revenue_usd) totalRevenue += entry.revenue_usd;
        if (entry.cost_usd) totalCost += entry.cost_usd;
      } catch {
        // skip
      }
    }
    return { totalRevenue, totalCost };
  }

  /** Get entries from the last N hours */
  readLastHours(hours: number): JournalEntry[] {
    if (!existsSync(this.filePath)) return [];
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const lines = readFileSync(this.filePath, "utf-8")
      .trim()
      .split("\n")
      .filter(Boolean);

    const results: JournalEntry[] = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const entry = JSON.parse(lines[i]) as JournalEntry;
        if (new Date(entry.time).getTime() >= cutoff) {
          results.push(entry);
        } else {
          break; // entries are chronological, stop early
        }
      } catch {
        // skip
      }
    }
    return results.reverse();
  }

  /** Count entries */
  count(): number {
    if (!existsSync(this.filePath)) return 0;
    return readFileSync(this.filePath, "utf-8").trim().split("\n").filter(Boolean).length;
  }
}
