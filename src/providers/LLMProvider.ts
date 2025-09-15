import { ChatMessage, ChatOptions, EmbeddingOptions, LLMCosts } from '../types';
import { EventEmitter } from 'events';

export interface LLMProviderConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
}

export abstract class LLMProvider extends EventEmitter {
  protected config: LLMProviderConfig;
  protected modelCosts: Map<string, { input: number; output: number }>;
  
  constructor(config: LLMProviderConfig) {
    super();
    this.config = config;
    this.modelCosts = new Map();
    this.initializeModelCosts();
  }
  
  // Abstract methods that must be implemented by each provider
  abstract createChatCompletion(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<string>;
  
  abstract createChatCompletionStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string>;
  
  abstract createEmbedding(
    text: string | string[],
    options?: EmbeddingOptions
  ): Promise<number[] | number[][]>;
  
  abstract getAvailableModels(): Promise<string[]>;
  
  // Common methods with default implementations
  protected abstract initializeModelCosts(): void;
  
  public estimateCost(
    input: string,
    output: string,
    model: string
  ): LLMCosts {
    const costs = this.modelCosts.get(model) || { input: 0, output: 0 };
    
    // Rough token estimation (1 token ≈ 4 characters)
    const inputTokens = Math.ceil(input.length / 4);
    const outputTokens = Math.ceil(output.length / 4);
    
    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    
    return {
      inputTokens,
      outputTokens,
      totalCost: inputCost + outputCost,
      model
    };
  }
  
  public async validateApiKey(): Promise<boolean> {
    try {
      const models = await this.getAvailableModels();
      return models.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  protected handleError(error: any): never {
    const errorMessage = error?.response?.data?.error?.message || 
                        error?.message || 
                        'Unknown error occurred';
    
    const statusCode = error?.response?.status || 500;
    
    const customError = new Error(errorMessage) as any;
    customError.statusCode = statusCode;
    customError.provider = this.constructor.name;
    
    this.emit('error', customError);
    throw customError;
  }
  
  protected async retry<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (retries === 0 || error?.statusCode === 401) {
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retry(fn, retries - 1, delay * 2);
    }
  }
  
  // Token counting utilities
  protected countTokens(text: string): number {
    // This is a rough approximation
    // For accurate counting, use tiktoken or the provider's tokenizer
    return Math.ceil(text.length / 4);
  }
  
  protected truncateToTokenLimit(text: string, maxTokens: number): string {
    const estimatedTokens = this.countTokens(text);
    if (estimatedTokens <= maxTokens) {
      return text;
    }
    
    // Rough truncation based on character count
    const maxChars = maxTokens * 4;
    return text.substring(0, maxChars);
  }
}

// Factory for creating LLM providers
export class LLMProviderFactory {
  private static providers: Map<string, typeof LLMProvider> = new Map();
  
  public static register(name: string, provider: typeof LLMProvider): void {
    this.providers.set(name.toLowerCase(), provider);
  }
  
  public static create(name: string, config: LLMProviderConfig): LLMProvider {
    const Provider = this.providers.get(name.toLowerCase());
    if (!Provider) {
      throw new Error(`Unknown LLM provider: ${name}`);
    }
    
    return new (Provider as any)(config);
  }
  
  public static getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
