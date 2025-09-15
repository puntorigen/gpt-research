/**
 * Cost calculation utilities for LLM usage
 */

// Token costs per 1000 tokens (in USD)
export const MODEL_COSTS = {
  // OpenAI models
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-32k': { input: 0.06, output: 0.12 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  'o1-preview': { input: 0.015, output: 0.06 },
  'o1-mini': { input: 0.003, output: 0.012 },
  'o3-mini': { input: 0.003, output: 0.015 }, // Hypothetical
  
  // Anthropic models
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-2.1': { input: 0.008, output: 0.024 },
  'claude-instant': { input: 0.0008, output: 0.0024 },
  
  // Google models
  'gemini-pro': { input: 0.00025, output: 0.0005 },
  'gemini-pro-vision': { input: 0.00025, output: 0.0005 },
  'gemini-ultra': { input: 0.007, output: 0.021 },
  
  // Groq models (very competitive pricing)
  'llama-3.1-70b': { input: 0.00059, output: 0.00079 },
  'llama-3.1-8b': { input: 0.00005, output: 0.00008 },
  'mixtral-8x7b': { input: 0.00027, output: 0.00027 },
  
  // Cohere models
  'command': { input: 0.0015, output: 0.002 },
  'command-light': { input: 0.00015, output: 0.0002 },
  
  // Perplexity models
  'pplx-70b-online': { input: 0.001, output: 0.001 },
  'pplx-70b-chat': { input: 0.001, output: 0.001 },
  
  // Embedding models
  'text-embedding-3-small': { input: 0.00002, output: 0 },
  'text-embedding-3-large': { input: 0.00013, output: 0 },
  'text-embedding-ada-002': { input: 0.0001, output: 0 },
  'voyage-large-2': { input: 0.00012, output: 0 },
  'embed-english-v3.0': { input: 0.0001, output: 0 },
};

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  model: string;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Estimate token count from text
 * This is a rough approximation - for accurate counts use tiktoken
 */
export function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  // This can vary significantly based on language and content
  const charCount = text.length;
  const wordCount = text.split(/\s+/).length;
  
  // Use a weighted average of character and word-based estimates
  const charEstimate = charCount / 4;
  const wordEstimate = wordCount * 1.3; // Average ~1.3 tokens per word
  
  return Math.ceil((charEstimate + wordEstimate) / 2);
}

/**
 * Calculate cost for token usage
 */
export function calculateCost(usage: TokenUsage): CostBreakdown {
  const modelCost = MODEL_COSTS[usage.model as keyof typeof MODEL_COSTS];
  
  if (!modelCost) {
    // Default to GPT-3.5 pricing if model not found
    console.warn(`Unknown model: ${usage.model}, using GPT-3.5 pricing`);
    const defaultCost = MODEL_COSTS['gpt-3.5-turbo'];
    return {
      inputCost: (usage.inputTokens / 1000) * defaultCost.input,
      outputCost: (usage.outputTokens / 1000) * defaultCost.output,
      totalCost: (usage.inputTokens / 1000) * defaultCost.input + 
                 (usage.outputTokens / 1000) * defaultCost.output,
      model: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens
    };
  }
  
  const inputCost = (usage.inputTokens / 1000) * modelCost.input;
  const outputCost = (usage.outputTokens / 1000) * modelCost.output;
  
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  } else if (cost < 1) {
    return `$${cost.toFixed(3)}`;
  } else {
    return `$${cost.toFixed(2)}`;
  }
}

/**
 * Track cumulative costs
 */
export class CostTracker {
  private costs: CostBreakdown[] = [];
  
  add(usage: TokenUsage): CostBreakdown {
    const cost = calculateCost(usage);
    this.costs.push(cost);
    return cost;
  }
  
  getTotalCost(): number {
    return this.costs.reduce((sum, cost) => sum + cost.totalCost, 0);
  }
  
  getTotalTokens(): { input: number; output: number; total: number } {
    const input = this.costs.reduce((sum, cost) => sum + cost.inputTokens, 0);
    const output = this.costs.reduce((sum, cost) => sum + cost.outputTokens, 0);
    
    return {
      input,
      output,
      total: input + output
    };
  }
  
  getCostByModel(): Record<string, number> {
    const costByModel: Record<string, number> = {};
    
    this.costs.forEach(cost => {
      if (!costByModel[cost.model]) {
        costByModel[cost.model] = 0;
      }
      costByModel[cost.model] += cost.totalCost;
    });
    
    return costByModel;
  }
  
  getSummary(): {
    totalCost: number;
    totalTokens: { input: number; output: number; total: number };
    costByModel: Record<string, number>;
    averageCostPerRequest: number;
    requestCount: number;
  } {
    return {
      totalCost: this.getTotalCost(),
      totalTokens: this.getTotalTokens(),
      costByModel: this.getCostByModel(),
      averageCostPerRequest: this.costs.length > 0 ? 
        this.getTotalCost() / this.costs.length : 0,
      requestCount: this.costs.length
    };
  }
  
  reset(): void {
    this.costs = [];
  }
  
  addCost(cost: number): void {
    this.costs.push({
      model: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      inputCost: 0,
      outputCost: 0,
      totalCost: cost
    });
  }
  
  getStats(): any {
    return this.getSummary();
  }
  
  formatSummary(): string {
    const summary = this.getSummary();
    
    let output = `Cost Summary:\n`;
    output += `─────────────────────────\n`;
    output += `Total Cost: ${formatCost(summary.totalCost)}\n`;
    output += `Requests: ${summary.requestCount}\n`;
    output += `Average Cost/Request: ${formatCost(summary.averageCostPerRequest)}\n`;
    output += `\nTokens:\n`;
    output += `  Input: ${summary.totalTokens.input.toLocaleString()}\n`;
    output += `  Output: ${summary.totalTokens.output.toLocaleString()}\n`;
    output += `  Total: ${summary.totalTokens.total.toLocaleString()}\n`;
    
    if (Object.keys(summary.costByModel).length > 1) {
      output += `\nCost by Model:\n`;
      Object.entries(summary.costByModel).forEach(([model, cost]) => {
        output += `  ${model}: ${formatCost(cost)}\n`;
      });
    }
    
    return output;
  }
}

/**
 * Estimate cost for a research task
 */
export function estimateResearchCost(
  config: {
    queries: number;
    averageQueryLength: number;
    averageResponseLength: number;
    model: string;
    includeEmbeddings?: boolean;
    embeddingModel?: string;
    documentsToEmbed?: number;
    averageDocumentLength?: number;
  }
): CostBreakdown {
  // Estimate tokens for main queries
  const inputTokens = estimateTokens(
    ' '.repeat(config.averageQueryLength * config.queries)
  );
  const outputTokens = estimateTokens(
    ' '.repeat(config.averageResponseLength * config.queries)
  );
  
  let totalCost = calculateCost({
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    model: config.model
  });
  
  // Add embedding costs if applicable
  if (config.includeEmbeddings && config.documentsToEmbed) {
    const embeddingTokens = estimateTokens(
      ' '.repeat((config.averageDocumentLength || 1000) * config.documentsToEmbed)
    );
    
    const embeddingCost = calculateCost({
      inputTokens: embeddingTokens,
      outputTokens: 0,
      totalTokens: embeddingTokens,
      model: config.embeddingModel || 'text-embedding-3-small'
    });
    
    totalCost.inputTokens += embeddingCost.inputTokens;
    totalCost.inputCost += embeddingCost.inputCost;
    totalCost.totalCost += embeddingCost.totalCost;
  }
  
  return totalCost;
}
