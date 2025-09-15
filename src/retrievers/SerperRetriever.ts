import { BaseRetriever, RetrieverConfig } from './BaseRetriever';
import { SearchResult, SearchOptions } from '../types';
import axios from 'axios';

export interface SerperConfig extends RetrieverConfig {
  apiKey: string;
  country?: string;
  location?: string;
  language?: string;
}

export class SerperRetriever extends BaseRetriever {
  private apiKey: string;
  private baseUrl = 'https://google.serper.dev';
  private country?: string;
  private location?: string;
  private language?: string;
  
  constructor(name: string, config: SerperConfig) {
    super(name, config);
    this.apiKey = config.apiKey;
    this.country = config.country || 'us';
    this.location = config.location;
    this.language = config.language || 'en';
    
    if (!this.apiKey) {
      throw new Error('Serper API key is required');
    }
  }
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const maxResults = options?.maxResults || this.config.maxResults || 10;
      
      const response = await axios.post(`${this.baseUrl}/search`, {
        q: query,
        num: maxResults,
        gl: this.country,
        hl: this.language,
        location: this.location
      }, {
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      
      // Combine organic results with other types
      const results: SearchResult[] = [];
      
      // Add organic results
      if (data.organic) {
        data.organic.forEach((result: any) => {
          results.push({
            url: result.link,
            title: result.title,
            content: result.snippet || '',
            snippet: result.snippet,
            score: result.position ? 1 / result.position : 0,
            publishedDate: result.date
          });
        });
      }
      
      // Add answer box if available
      if (data.answerBox) {
        results.unshift({
          url: 'serper:answerbox',
          title: data.answerBox.title || 'Answer',
          content: data.answerBox.answer || data.answerBox.snippet || '',
          snippet: data.answerBox.snippet || data.answerBox.answer || '',
          score: 1.0
        });
      }
      
      // Add knowledge graph if available
      if (data.knowledgeGraph) {
        results.push({
          url: data.knowledgeGraph.website || 'serper:knowledge',
          title: data.knowledgeGraph.title,
          content: data.knowledgeGraph.description || '',
          snippet: data.knowledgeGraph.description || '',
          score: 0.9
        });
      }
      
      return results.slice(0, maxResults);
      
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid Serper API key');
      }
      if (error.response?.status === 429) {
        throw new Error('Serper rate limit exceeded');
      }
      throw new Error(`Serper search failed: ${error.message}`);
    }
  }
  
  /**
   * Search for news articles
   */
  async searchNews(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/news`, {
        q: query,
        num: options?.maxResults || 10,
        gl: this.country,
        hl: this.language
      }, {
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      
      if (!data.news) {
        return [];
      }
      
      return data.news.map((article: any) => ({
        url: article.link,
        title: article.title,
        content: article.snippet || '',
        snippet: article.snippet,
        publishedDate: article.date,
        source: article.source,
        score: article.position ? 1 / article.position : 0
      }));
      
    } catch (error: any) {
      throw new Error(`Serper news search failed: ${error.message}`);
    }
  }
  
  /**
   * Search for images
   */
  async searchImages(query: string, options?: SearchOptions): Promise<{
    url: string;
    title: string;
    source: string;
    thumbnail: string;
  }[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/images`, {
        q: query,
        num: options?.maxResults || 10,
        gl: this.country,
        hl: this.language
      }, {
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      
      if (!data.images) {
        return [];
      }
      
      return data.images.map((image: any) => ({
        url: image.imageUrl,
        title: image.title,
        source: image.source,
        thumbnail: image.thumbnailUrl
      }));
      
    } catch (error: any) {
      throw new Error(`Serper image search failed: ${error.message}`);
    }
  }
  
  /**
   * Search for scholarly articles
   */
  async searchScholar(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    try {
      const response = await axios.post(`${this.baseUrl}/scholar`, {
        q: query,
        num: options?.maxResults || 10,
        gl: this.country,
        hl: this.language
      }, {
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      
      if (!data.organic) {
        return [];
      }
      
      return data.organic.map((result: any) => ({
        url: result.link,
        title: result.title,
        content: result.snippet || '',
        snippet: result.snippet,
        author: result.publication?.authors?.join(', '),
        publishedDate: result.year,
        citations: result.citedBy?.value,
        score: result.position ? 1 / result.position : 0
      }));
      
    } catch (error: any) {
      throw new Error(`Serper scholar search failed: ${error.message}`);
    }
  }
}