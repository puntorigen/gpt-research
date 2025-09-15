import { BaseRetriever, RetrieverConfig } from './BaseRetriever';
import { SearchResult, SearchOptions } from '../types';
import axios from 'axios';

export interface TavilyConfig extends RetrieverConfig {
  apiKey: string;
  searchDepth?: 'basic' | 'advanced';
  includeImages?: boolean;
  includeAnswer?: boolean;
  includeRawContent?: boolean;
  maxResults?: number;
}

export class TavilyRetriever extends BaseRetriever {
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com';
  private searchDepth: 'basic' | 'advanced';
  private includeImages: boolean;
  private includeAnswer: boolean;
  private includeRawContent: boolean;
  
  constructor(name: string, config: TavilyConfig) {
    super(name, config);
    this.apiKey = config.apiKey;
    this.searchDepth = config.searchDepth || 'basic';
    this.includeImages = config.includeImages || false;
    this.includeAnswer = config.includeAnswer || false;
    this.includeRawContent = config.includeRawContent || false;
    
    if (!this.apiKey) {
      throw new Error('Tavily API key is required');
    }
  }
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const maxResults = options?.maxResults || this.config.maxResults || 10;
      
      const response = await axios.post(`${this.baseUrl}/search`, {
        api_key: this.apiKey,
        query,
        search_depth: this.searchDepth,
        include_images: this.includeImages,
        include_answer: this.includeAnswer,
        include_raw_content: this.includeRawContent,
        max_results: maxResults
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      
      // Transform Tavily results to our SearchResult format
      const results: SearchResult[] = data.results.map((result: any) => ({
        url: result.url,
        title: result.title,
        content: result.content,
        snippet: result.content.substring(0, 200),
        score: result.score,
        publishedDate: result.published_date,
        author: result.author,
        images: this.includeImages ? result.images : undefined
      }));
      
      // Include answer as the first result if available
      if (this.includeAnswer && data.answer) {
        results.unshift({
          url: 'tavily:answer',
          title: 'Tavily Answer',
          content: data.answer,
          snippet: data.answer.substring(0, 200),
          score: 1.0
        });
      }
      
      return results;
      
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Tavily API key');
      }
      if (error.response?.status === 429) {
        throw new Error('Tavily rate limit exceeded');
      }
      throw new Error(`Tavily search failed: ${error.message}`);
    }
  }
  
  /**
   * Get search context for a query (includes answer and related queries)
   */
  async getContext(query: string): Promise<{
    answer?: string;
    results: SearchResult[];
    relatedQueries?: string[];
  }> {
    try {
      const response = await axios.post(`${this.baseUrl}/search`, {
        api_key: this.apiKey,
        query,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: true,
        max_results: 10
      });
      
      const data = response.data;
      
      const results = data.results.map((result: any) => ({
        url: result.url,
        title: result.title,
        content: result.raw_content || result.content,
        snippet: result.content.substring(0, 200),
        score: result.score,
        publishedDate: result.published_date
      }));
      
      return {
        answer: data.answer,
        results,
        relatedQueries: data.related_queries
      };
      
    } catch (error: any) {
      throw new Error(`Failed to get Tavily context: ${error.message}`);
    }
  }
  
  /**
   * Get news results for a query
   */
  async searchNews(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/news`, {
        api_key: this.apiKey,
        query,
        max_results: options?.maxResults || 10,
        days: 7 // Last 7 days
      });
      
      const data = response.data;
      
      return data.results.map((result: any) => ({
        url: result.url,
        title: result.title,
        content: result.content,
        snippet: result.content.substring(0, 200),
        score: result.score,
        publishedDate: result.published_date,
        source: result.source
      }));
      
    } catch (error: any) {
      throw new Error(`Tavily news search failed: ${error.message}`);
    }
  }
}