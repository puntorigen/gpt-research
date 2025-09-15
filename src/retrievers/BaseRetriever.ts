import { SearchResult, SearchOptions } from '../types';
import { EventEmitter } from 'events';

export interface RetrieverConfig {
  apiKey?: string;
  maxResults?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

export abstract class BaseRetriever extends EventEmitter {
  protected config: RetrieverConfig;
  protected name: string;
  
  constructor(name: string, config: RetrieverConfig) {
    super();
    this.name = name;
    this.config = config;
  }
  
  /**
   * Main search method that must be implemented by each retriever
   */
  abstract search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]>;
  
  /**
   * Get the name of the retriever
   */
  getName(): string {
    return this.name;
  }
  
  /**
   * Validate that the retriever is properly configured
   */
  async validate(): Promise<boolean> {
    if (!this.config.apiKey && this.requiresApiKey()) {
      throw new Error(`API key is required for ${this.name} retriever`);
    }
    return true;
  }
  
  /**
   * Check if this retriever requires an API key
   */
  protected requiresApiKey(): boolean {
    return true;
  }
  
  /**
   * Format raw search results into standard format
   */
  protected formatResult(raw: any): SearchResult {
    return {
      url: raw.url || raw.link || '',
      title: raw.title || raw.name || '',
      content: raw.content || raw.snippet || raw.description || '',
      snippet: raw.snippet || raw.description || '',
      score: raw.score || raw.relevance || undefined,
      publishedDate: raw.publishedDate || raw.date || undefined,
      author: raw.author || undefined,
      images: raw.images || []
    };
  }
  
  /**
   * Filter and deduplicate results
   */
  protected processResults(results: SearchResult[]): SearchResult[] {
    // Remove duplicates based on URL
    const seen = new Set<string>();
    const unique = results.filter(result => {
      if (seen.has(result.url)) {
        return false;
      }
      seen.add(result.url);
      return true;
    });
    
    // Sort by score if available
    if (unique.some(r => r.score !== undefined)) {
      unique.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    
    return unique;
  }
  
  /**
   * Handle errors consistently
   */
  protected handleError(error: any): never {
    const errorMessage = error?.response?.data?.error || 
                        error?.message || 
                        `Unknown error in ${this.name} retriever`;
    
    const customError = new Error(errorMessage) as any;
    customError.retriever = this.name;
    customError.statusCode = error?.response?.status || 500;
    
    this.emit('error', customError);
    throw customError;
  }
  
  /**
   * Retry logic for API calls
   */
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
      
      this.emit('retry', { 
        retriever: this.name, 
        retriesLeft: retries, 
        error: error.message 
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retry(fn, retries - 1, delay * 2);
    }
  }
}

// Factory for creating retrievers
export class RetrieverFactory {
  private static retrievers: Map<string, typeof BaseRetriever> = new Map();
  
  public static register(name: string, retriever: typeof BaseRetriever): void {
    this.retrievers.set(name.toLowerCase(), retriever);
  }
  
  public static create(name: string, config: RetrieverConfig): BaseRetriever {
    const Retriever = this.retrievers.get(name.toLowerCase());
    if (!Retriever) {
      throw new Error(`Unknown retriever: ${name}`);
    }
    
    return new (Retriever as any)(name, config);
  }
  
  public static getAvailableRetrievers(): string[] {
    return Array.from(this.retrievers.keys());
  }
}
