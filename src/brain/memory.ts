/**
 * Persistent memory system for the CEO brain.
 * Three types: fact memory (action logs), strategy memory (learned patterns),
 * relationship memory (agent interactions).
 *
 * Periodically the CEO "reflects" to consolidate insights.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { PrometheusContext } from "../index.js";
import { callLlm, type ChatMessage } from "../tools/http.js";

export interface StrategyInsight {
  id: string;
  created: string;
  updated: string;
  category: "effective" | "ineffective" | "opportunity" | "risk" | "general";
  insight: string;
  confidence: number; // 0-1
  evidence_count: number;
}

export interface MemoryState {
  strategy_insights: StrategyInsight[];
  last_reflection: string;
  reflection_count: number;
  world_model: Record<string, string>; // key observations about the world
}

function defaultMemory(): MemoryState {
  return {
    strategy_insights: [],
    last_reflection: "",
    reflection_count: 0,
    world_model: {},
  };
}

export class Memory {
  private filePath: string;
  private state: MemoryState;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, "memory.json");
    this.state = this.load();
  }

  private load(): MemoryState {
    if (existsSync(this.filePath)) {
      try {
        return { ...defaultMemory(), ...JSON.parse(readFileSync(this.filePath, "utf-8")) };
      } catch {
        return defaultMemory();
      }
    }
    return defaultMemory();
  }

  private persist(): void {
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), "utf-8");
  }

  get(): MemoryState {
    return this.state;
  }

  /** Add a new strategy insight */
  addInsight(insight: Omit<StrategyInsight, "id" | "created" | "updated" | "evidence_count">): void {
    this.state.strategy_insights.push({
      ...insight,
      id: `insight-${Date.now()}`,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      evidence_count: 1,
    });
    // Keep max 50 insights (prune lowest confidence)
    if (this.state.strategy_insights.length > 50) {
      this.state.strategy_insights.sort((a, b) => b.confidence - a.confidence);
      this.state.strategy_insights = this.state.strategy_insights.slice(0, 50);
    }
    this.persist();
  }

  /** Update an existing insight (reinforce or weaken) */
  reinforceInsight(insightId: string, positive: boolean): void {
    const insight = this.state.strategy_insights.find((i) => i.id === insightId);
    if (insight) {
      insight.evidence_count += 1;
      insight.confidence = Math.min(1, Math.max(0, insight.confidence + (positive ? 0.1 : -0.15)));
      insight.updated = new Date().toISOString();
      this.persist();
    }
  }

  /** Update world model */
  updateWorldModel(key: string, value: string): void {
    this.state.world_model[key] = value;
    this.persist();
  }

  /** Get a summary for the CEO context */
  getSummary(): string {
    const insights = this.state.strategy_insights
      .filter((i) => i.confidence >= 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);

    if (insights.length === 0 && Object.keys(this.state.world_model).length === 0) {
      return "No strategic insights yet. Explore and experiment to build knowledge.";
    }

    const lines: string[] = [];

    if (insights.length > 0) {
      lines.push("Strategic Insights:");
      for (const i of insights) {
        lines.push(
          `  [${i.category}] (confidence: ${(i.confidence * 100).toFixed(0)}%) ${i.insight}`,
        );
      }
    }

    const worldEntries = Object.entries(this.state.world_model);
    if (worldEntries.length > 0) {
      lines.push("\nWorld Model:");
      for (const [key, val] of worldEntries.slice(0, 10)) {
        lines.push(`  ${key}: ${val}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Run a reflection cycle: analyze recent actions and extract insights.
   * Called periodically by the CEO loop.
   */
  async reflect(ctx: PrometheusContext): Promise<string[]> {
    const recentEntries = ctx.journal.readLastHours(24);
    if (recentEntries.length < 5) {
      return ["Not enough data to reflect on yet."];
    }

    const actionSummary = recentEntries
      .map((e) => {
        const parts = [`${e.type}`];
        if (e.action) parts.push(e.action);
        if (e.success !== undefined) parts.push(e.success ? "SUCCESS" : "FAIL");
        if (e.cost_usd) parts.push(`cost:$${e.cost_usd}`);
        if (e.revenue_usd) parts.push(`rev:$${e.revenue_usd}`);
        return parts.join(" | ");
      })
      .join("\n");

    const currentInsights = this.getSummary();

    try {
      const messages: ChatMessage[] = [
        {
          role: "system",
          content:
            "You are an AI agent reflecting on your recent actions. Extract 3-5 key insights. " +
            "Format each insight as a JSON object with fields: category (effective|ineffective|opportunity|risk|general), " +
            "insight (string), confidence (0-1). Return a JSON array.",
        },
        {
          role: "user",
          content: `Recent actions (last 24h):\n${actionSummary}\n\n` +
            `Current knowledge:\n${currentInsights}\n\n` +
            `What patterns do you see? What's working? What should be abandoned? Any new opportunities?`,
        },
      ];

      const resp = await callLlm(
        ctx.config.boxhireApiUrl,
        ctx.config.boxhireApiKey,
        ctx.config.boxhireJwt,
        { messages, temperature: 0.5, max_tokens: 1000 },
      );

      const content = resp.choices[0]?.message?.content || "[]";
      // Try to parse JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const newInsights = JSON.parse(jsonMatch[0]) as Array<{
          category: string;
          insight: string;
          confidence: number;
        }>;

        const insightTexts: string[] = [];
        for (const ni of newInsights) {
          this.addInsight({
            category: (ni.category || "general") as StrategyInsight["category"],
            insight: ni.insight,
            confidence: Math.min(1, Math.max(0, ni.confidence || 0.5)),
          });
          insightTexts.push(ni.insight);
        }

        this.state.last_reflection = new Date().toISOString();
        this.state.reflection_count += 1;
        this.persist();

        // Log reflection
        ctx.journal.append({
          tick: ctx.stateStore.get().total_ticks,
          type: "reflection",
          insights: insightTexts,
        });

        return insightTexts;
      }

      return ["Reflection completed but no structured insights extracted."];
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return [`Reflection failed: ${msg}`];
    }
  }

  /** Check if it's time for a reflection */
  shouldReflect(tickInterval: number): boolean {
    if (!this.state.last_reflection) return true;
    const hoursSinceReflection =
      (Date.now() - new Date(this.state.last_reflection).getTime()) / 3600000;
    // Reflect every 4 hours, or every 100 ticks
    return hoursSinceReflection >= 4;
  }
}
