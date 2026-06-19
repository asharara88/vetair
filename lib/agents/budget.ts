// Per-run budget accounting.
//
// Each agent definition carries an `AgentBudget` (max_turns, max_input_tokens,
// max_dissent_rounds?). BudgetTracker enforces it as a run proceeds — call
// `recordTurn` after every Claude response, then check `exhaustion` before
// the next loop iteration.

import type { AgentBudget } from "./types";

export interface BudgetUsage {
  turns: number;
  input_tokens: number;
  output_tokens: number;
  dissent_rounds: number;
}

export type BudgetExhaustion =
  | { reason: "turns"; limit: number; used: number }
  | { reason: "input_tokens"; limit: number; used: number }
  | { reason: "dissent_rounds"; limit: number; used: number };

export class BudgetTracker {
  private turns = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private dissentRounds = 0;

  constructor(private readonly budget: AgentBudget) {}

  /** Record a single Claude turn. Call once per model invocation. */
  recordTurn(inputTokens: number, outputTokens: number): void {
    this.turns += 1;
    this.inputTokens += inputTokens;
    this.outputTokens += outputTokens;
  }

  /** Record a dissent round (Auditor → dissent decision). */
  recordDissent(): void {
    this.dissentRounds += 1;
  }

  /** Current usage snapshot. */
  get usage(): BudgetUsage {
    return {
      turns: this.turns,
      input_tokens: this.inputTokens,
      output_tokens: this.outputTokens,
      dissent_rounds: this.dissentRounds,
    };
  }

  /**
   * Return the first exhausted dimension, or `null` if all dimensions are
   * within budget. Check this before dispatching the next turn.
   */
  get exhaustion(): BudgetExhaustion | null {
    if (this.turns >= this.budget.max_turns) {
      return { reason: "turns", limit: this.budget.max_turns, used: this.turns };
    }
    if (this.inputTokens >= this.budget.max_input_tokens) {
      return {
        reason: "input_tokens",
        limit: this.budget.max_input_tokens,
        used: this.inputTokens,
      };
    }
    const dissentCap = this.budget.max_dissent_rounds;
    if (dissentCap != null && this.dissentRounds >= dissentCap) {
      return {
        reason: "dissent_rounds",
        limit: dissentCap,
        used: this.dissentRounds,
      };
    }
    return null;
  }
}
