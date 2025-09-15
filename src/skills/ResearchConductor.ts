import { EventEmitter } from 'events';
import { Config } from '../core/Config';
import { Memory } from '../core/Memory';
import { SearchResult, SearchOptions, ResearchContext } from '../types';
import { BaseRetriever, RetrieverFactory } from '../retrievers';
// import { WorkerPool, BatchProcessor } from '../utils/workers'; // Reserved for future use
import { LLMProvider } from '../providers/LLMProvider';

export interface ResearchQuery {
  query: string;
  purpose?: string;
  maxResults?: number;
}

export class ResearchConductor extends EventEmitter {
  private config: Config;
  private memory: Memory;
  // private retriever: BaseRetriever; // Created dynamically
  // private workerPool: WorkerPool; // Reserved for future use
  // private batchProcessor: BatchProcessor<string, SearchResult[]>; // Reserved for future use
  
  constructor(config: Config, memory: Memory) {
    super();
    this.config = config;
    this.memory = memory;
    
    // Initialize retriever
    // const retrieverName = this.config.get('defaultRetriever') || 'tavily'; // Used dynamically
    // const apiKey = this.config.getApiKey(retrieverName); // Used dynamically in getRetriever
    
    // Retriever is created dynamically in search methods
    // this.retriever = RetrieverFactory.create(retrieverName, {
    //   apiKey,
    //   maxResults: this.config.get('maxSearchResults')
    // });
    
    // Initialize worker pool for concurrent operations
    // this.workerPool = new WorkerPool(3); // Reserved for future use
    // this.batchProcessor = new BatchProcessor(3); // Reserved for future use
  }
  
  /**
   * Plan research outline based on the main query
   */
  async planResearchOutline(
    query: string,
    llmProvider: LLMProvider
  ): Promise<string[]> {
    this.emit('planning_start', { query });
    
    const systemPrompt = `You are a research planning assistant. Generate 3-5 specific research questions that would help comprehensively answer the main query. Each question should explore a different aspect of the topic.`;
    
    const userPrompt = `Main research query: "${query}"
    
Generate specific research questions that would help gather comprehensive information about this topic. Return only the questions, one per line.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt }
    ];
    
    try {
      const response = await llmProvider.createChatCompletion(messages, {
        model: this.config.get('smartLLMModel'),
        temperature: 0.7,
        maxTokens: 500
      });
      
      // Parse questions from response
      const questions = response
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'))
        .map(line => line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''))
        .slice(0, 5);
      
      this.emit('planning_complete', { query, questions });
      
      return questions;
    } catch (error) {
      this.emit('planning_error', { query, error });
      // Return the original query as fallback
      return [query];
    }
  }
  
  /**
   * Conduct searches for the given queries
   */
  async searchInformation(
    queries: string[],
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    this.emit('search_start', { queries: queries.length });
    
    const allResults: SearchResult[] = [];
    const searchOptions = {
      maxResults: this.config.get('maxSearchResults') || 10,
      ...options
    };
    
    // Search for each query concurrently
    const searchPromises = queries.map(query => 
      this.searchSingleQuery(query, searchOptions)
    );
    
    const results = await Promise.allSettled(searchPromises);
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
        this.memory.addSearchResults(queries[i], result.value);
      } else {
        this.emit('search_error', {
          query: queries[i],
          error: result.reason
        });
      }
    }
    
    // Deduplicate results based on URL
    const uniqueResults = this.deduplicateResults(allResults);
    
    this.emit('search_complete', {
      totalQueries: queries.length,
      totalResults: uniqueResults.length
    });
    
    return uniqueResults;
  }
  
  /**
   * Search for a single query
   */
  private async searchSingleQuery(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    try {
      // Try multiple retrievers if the first one fails
      const retrievers = this.getAvailableRetrievers();
      let lastError: Error | null = null;
      
      for (const retrieverName of retrievers) {
        try {
          const retriever = this.getRetriever(retrieverName);
          if (!retriever) continue;
          
          const results = await retriever.search(query, options);
          
          if (results.length > 0) {
            this.emit('search_success', {
              query,
              retriever: retrieverName,
              resultsCount: results.length
            });
            return results;
          }
        } catch (error) {
          lastError = error as Error;
          this.emit('retriever_error', {
            query,
            retriever: retrieverName,
            error: lastError.message
          });
        }
      }
      
      // If all retrievers failed, throw the last error
      if (lastError) {
        throw lastError;
      }
      
      return [];
    } catch (error) {
      this.emit('search_error', { query, error });
      return [];
    }
  }
  
  /**
   * Get available retrievers based on configuration
   */
  private getAvailableRetrievers(): string[] {
    const retrievers: string[] = [];
    const defaultRetriever = this.config.get('defaultRetriever') || 'tavily';
    
    // Add default retriever first
    retrievers.push(defaultRetriever);
    
    // Add other retrievers if API keys are available
    const potentialRetrievers = ['tavily', 'serper', 'google'];
    for (const retriever of potentialRetrievers) {
      if (retriever !== defaultRetriever && this.config.getApiKey(retriever)) {
        retrievers.push(retriever);
      }
    }
    
    return retrievers;
  }
  
  /**
   * Get or create a retriever instance
   */
  private getRetriever(name: string): BaseRetriever | null {
    const apiKey = this.config.getApiKey(name);
    if (!apiKey) {
      return null;
    }
    
    try {
      const config: any = {
        apiKey,
        maxResults: this.config.get('maxSearchResults')
      };
      
      // Add Google-specific config
      if (name === 'google') {
        config.cx = this.config.get('googleCx');
      }
      
      return RetrieverFactory.create(name, config);
    } catch (error) {
      this.emit('retriever_init_error', { name, error });
      return null;
    }
  }
  
  /**
   * Deduplicate search results based on URL
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const unique: SearchResult[] = [];
    
    for (const result of results) {
      if (!seen.has(result.url)) {
        seen.add(result.url);
        unique.push(result);
      }
    }
    
    // Sort by relevance score if available
    if (unique.some(r => r.score !== undefined)) {
      unique.sort((a, b) => (b.score || 0) - (a.score || 0));
    }
    
    return unique;
  }
  
  /**
   * Filter search results based on criteria
   */
  filterResults(
    results: SearchResult[],
    criteria: {
      minContentLength?: number;
      requireSnippet?: boolean;
      domains?: string[];
      excludeDomains?: string[];
      maxAge?: number; // days
    }
  ): SearchResult[] {
    return results.filter(result => {
      // Check content length
      if (criteria.minContentLength && 
          result.content.length < criteria.minContentLength) {
        return false;
      }
      
      // Check snippet
      if (criteria.requireSnippet && !result.snippet) {
        return false;
      }
      
      // Check domains
      if (criteria.domains && criteria.domains.length > 0) {
        const url = new URL(result.url);
        if (!criteria.domains.some(domain => url.hostname.includes(domain))) {
          return false;
        }
      }
      
      // Check excluded domains
      if (criteria.excludeDomains && criteria.excludeDomains.length > 0) {
        const url = new URL(result.url);
        if (criteria.excludeDomains.some(domain => url.hostname.includes(domain))) {
          return false;
        }
      }
      
      // Check age
      if (criteria.maxAge && result.publishedDate) {
        const publishedDate = new Date(result.publishedDate);
        const maxAgeMs = criteria.maxAge * 24 * 60 * 60 * 1000;
        if (Date.now() - publishedDate.getTime() > maxAgeMs) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Rank search results based on relevance
   */
  rankResults(
    results: SearchResult[],
    query: string
  ): SearchResult[] {
    // Simple ranking based on query term occurrence
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    const scoredResults = results.map(result => {
      let score = result.score || 0;
      
      // Check title matches
      const titleLower = result.title.toLowerCase();
      queryTerms.forEach(term => {
        if (titleLower.includes(term)) {
          score += 2; // Title matches are more important
        }
      });
      
      // Check content/snippet matches
      const contentLower = (result.snippet || result.content).toLowerCase();
      queryTerms.forEach(term => {
        if (contentLower.includes(term)) {
          score += 1;
        }
      });
      
      // Boost recent results
      if (result.publishedDate) {
        const ageInDays = (Date.now() - new Date(result.publishedDate).getTime()) / 
                         (24 * 60 * 60 * 1000);
        if (ageInDays < 7) score += 2;
        else if (ageInDays < 30) score += 1;
      }
      
      return { ...result, score };
    });
    
    // Sort by score
    scoredResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    return scoredResults;
  }
  
  /**
   * Create research context from search results
   */
  createContext(results: SearchResult[]): ResearchContext {
    const query = this.config.get('query');
    const reportType = this.config.get('reportType');
    
    // Extract key findings from results
    const findings = results.map(result => 
      `Source: ${result.title}\nURL: ${result.url}\n${result.snippet || result.content}`
    );
    
    return {
      query,
      reportType,
      findings,
      sources: results,
      subtopics: this.memory.getSubtopics()
    };
  }
  
  /**
   * Get statistics about the research conducted
   */
  getStats(): {
    searchQueries: number;
    totalResults: number;
    uniqueUrls: number;
    retrieversUsed: string[];
  } {
    const memoryStats = this.memory.getStats();
    const searchResults = this.memory.getSearchResults();
    const uniqueUrls = new Set(searchResults.map(r => r.url));
    
    return {
      searchQueries: memoryStats.searchQueries,
      totalResults: searchResults.length,
      uniqueUrls: uniqueUrls.size,
      retrieversUsed: this.getAvailableRetrievers()
    };
  }
}
