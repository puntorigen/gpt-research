import { BaseRetriever, RetrieverConfig } from './BaseRetriever';
import { SearchResult, SearchOptions } from '../types';
import axios from 'axios';

export class GoogleRetriever extends BaseRetriever {
  private apiKey: string;
  private cx?: string; // Custom Search Engine ID
  private baseUrl = 'https://www.googleapis.com/customsearch/v1';
  
  constructor(name: string, config: RetrieverConfig & { cx?: string }) {
    super(name, config);
    
    if (!config.apiKey) {
      throw new Error('Google API key is required');
    }
    
    this.apiKey = config.apiKey;
    this.cx = config.cx;
  }
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const params: any = {
        key: this.apiKey,
        q: query,
        num: options?.maxResults || this.config.maxResults || 10
      };
      
      // Add Custom Search Engine ID if provided
      if (this.cx) {
        params.cx = this.cx;
      }
      
      const response = await axios.get(this.baseUrl, { params });
      
      if (!response.data.items) {
        return [];
      }
      
      // Transform Google results to our SearchResult format
      const results: SearchResult[] = response.data.items.map((item: any) => ({
        url: item.link,
        title: item.title,
        content: item.snippet || '',
        snippet: item.snippet || '',
        score: undefined, // Google doesn't provide relevance scores
        publishedDate: this.extractDate(item),
        images: item.pagemap?.cse_image?.map((img: any) => img.src) || []
      }));
      
      return this.processResults(results);
      
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Google API quota exceeded or invalid API key');
      }
      if (error.response?.status === 400) {
        throw new Error('Invalid Google search query');
      }
      throw new Error(`Google search failed: ${error.message}`);
    }
  }
  
  /**
   * Search for images
   */
  async searchImages(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const params: any = {
        key: this.apiKey,
        q: query,
        searchType: 'image',
        num: options?.maxResults || 10
      };
      
      if (this.cx) {
        params.cx = this.cx;
      }
      
      const response = await axios.get(this.baseUrl, { params });
      
      if (!response.data.items) {
        return [];
      }
      
      return response.data.items.map((item: any) => ({
        url: item.link,
        title: item.title,
        content: item.snippet || '',
        snippet: item.snippet || '',
        images: [item.link]
      }));
      
    } catch (error: any) {
      throw new Error(`Google image search failed: ${error.message}`);
    }
  }
  
  /**
   * Search specific site
   */
  async searchSite(site: string, query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const siteQuery = `site:${site} ${query}`;
    return this.search(siteQuery, options);
  }
  
  /**
   * Search for news
   */
  async searchNews(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    // Google Custom Search doesn't have a dedicated news search
    // We can simulate it by adding news-related terms
    const newsQuery = `${query} news`;
    const results = await this.search(newsQuery, options);
    
    // Filter for news-like domains
    const newsDomains = [
      'cnn.com', 'bbc.com', 'reuters.com', 'apnews.com',
      'nytimes.com', 'wsj.com', 'bloomberg.com', 'ft.com'
    ];
    
    return results.filter(result => {
      const url = new URL(result.url);
      return newsDomains.some(domain => url.hostname.includes(domain));
    });
  }
  
  /**
   * Extract date from Google search result
   */
  private extractDate(item: any): string | undefined {
    // Try to extract from metatags
    if (item.pagemap?.metatags?.[0]) {
      const metatags = item.pagemap.metatags[0];
      return metatags['article:published_time'] || 
             metatags['datePublished'] || 
             metatags['date'] ||
             undefined;
    }
    
    // Try to extract from snippet
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})|(\w+ \d{1,2}, \d{4})/;
    const match = item.snippet?.match(dateRegex);
    return match ? match[0] : undefined;
  }
}