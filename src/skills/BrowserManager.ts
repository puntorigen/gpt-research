import { EventEmitter } from 'events';
import { Config } from '../core/Config';
import { Memory } from '../core/Memory';
import { SearchResult } from '../types';
import { BaseScraper, ScraperFactory } from '../scrapers';
import { getBestScraper } from '../scrapers';
// import { WorkerPool, BatchProcessor } from '../utils/workers'; // Reserved for future use

export interface ScrapingOptions {
  scraperType?: string;
  maxConcurrency?: number;
  timeout?: number;
  extractImages?: boolean;
  useReadability?: boolean;
}

export interface ScrapingResult {
  url: string;
  content: string;
  title: string;
  images?: string[];
  error?: string;
}

export class BrowserManager extends EventEmitter {
  private config: Config;
  private memory: Memory;
  // private workerPool: WorkerPool; // Reserved for future use
  // private batchProcessor: BatchProcessor<string, ScrapedContent>; // Reserved for future use
  private activeScrapers: Map<string, BaseScraper>;
  
  constructor(config: Config, memory: Memory) {
    super();
    this.config = config;
    this.memory = memory;
    
    // Initialize worker pool for concurrent scraping
    // const concurrency = config.get('scrapingConcurrency' as any) || 3; // Reserved for future use
    // this.workerPool = new WorkerPool(concurrency); // Reserved for future use
    // this.batchProcessor = new BatchProcessor(concurrency); // Reserved for future use
    
    // Store active scraper instances
    this.activeScrapers = new Map();
  }
  
  /**
   * Scrape multiple URLs
   */
  async scrapeUrls(
    urls: string[],
    options?: ScrapingOptions
  ): Promise<ScrapingResult[]> {
    this.emit('scraping_start', { urls: urls.length });
    
    const results: ScrapingResult[] = [];
    const uniqueUrls = this.filterUniqueUrls(urls);
    
    // Process URLs in batches
    const batchSize = options?.maxConcurrency || 3;
    const batches = this.createBatches(uniqueUrls, batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      this.emit('batch_start', { 
        batch: i + 1, 
        total: batches.length,
        urls: batches[i].length 
      });
      
      const batchResults = await this.scrapeBatch(batches[i], options);
      results.push(...batchResults);
      
      this.emit('batch_complete', {
        batch: i + 1,
        successful: batchResults.filter(r => !r.error).length,
        failed: batchResults.filter(r => r.error).length
      });
    }
    
    this.emit('scraping_complete', {
      total: uniqueUrls.length,
      successful: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length
    });
    
    return results;
  }
  
  /**
   * Scrape URLs from search results
   */
  async scrapeSearchResults(
    searchResults: SearchResult[],
    options?: ScrapingOptions
  ): Promise<ScrapingResult[]> {
    const urls = searchResults.map(result => result.url);
    const scrapingResults = await this.scrapeUrls(urls, options);
    
    // Combine search results with scraped content
    const combined = searchResults.map(searchResult => {
      const scrapedResult = scrapingResults.find(r => r.url === searchResult.url);
      
      if (scrapedResult && !scrapedResult.error) {
        // Store in memory
        this.memory.addScrapedContent(searchResult.url, scrapedResult.content);
        
        return {
          ...scrapedResult,
          snippet: searchResult.snippet,
          score: searchResult.score
        };
      }
      
      // Use search result content as fallback
      return {
        url: searchResult.url,
        title: searchResult.title,
        content: searchResult.content || searchResult.snippet || '',
        error: scrapedResult?.error
      };
    });
    
    return combined;
  }
  
  /**
   * Scrape a batch of URLs
   */
  private async scrapeBatch(
    urls: string[],
    options?: ScrapingOptions
  ): Promise<ScrapingResult[]> {
    const scrapePromises = urls.map(url => 
      this.scrapeUrl(url, options)
    );
    
    const results = await Promise.allSettled(scrapePromises);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          url: urls[index],
          title: 'Error',
          content: '',
          error: result.reason?.message || 'Scraping failed'
        };
      }
    });
  }
  
  /**
   * Scrape a single URL
   */
  async scrapeUrl(
    url: string,
    options?: ScrapingOptions
  ): Promise<ScrapingResult> {
    try {
      // Check if already scraped
      const cached = this.memory.getScrapedContent(url);
      if (cached) {
        this.emit('cache_hit', { url });
        return {
          url,
          title: 'Cached Content',
          content: cached
        };
      }
      
      // Determine best scraper
      const scraperType = options?.scraperType || 
                         this.config.get('defaultScraper') || 
                         getBestScraper(url);
      
      // Get or create scraper instance
      const scraper = this.getScraper(scraperType, options);
      
      // Scrape the URL
      const result = await scraper.scrape(url);
      
      // Process successful result
      if (!result.error) {
        // Store in memory
        this.memory.addScrapedContent(url, result.content);
        
        this.emit('url_scraped', {
          url,
          scraperType,
          contentLength: result.content.length,
          hasImages: result.images && result.images.length > 0
        });
        
        return {
          url,
          title: result.title,
          content: result.content,
          images: result.images
        };
      } else {
        throw new Error(result.error);
      }
      
    } catch (error: any) {
      this.emit('scraping_error', { url, error: error.message });
      
      return {
        url,
        title: 'Error',
        content: '',
        error: error.message || 'Failed to scrape URL'
      };
    }
  }
  
  /**
   * Get or create a scraper instance
   */
  private getScraper(scraperType: string, options?: ScrapingOptions): BaseScraper {
    const key = `${scraperType}_${JSON.stringify(options || {})}`;
    
    if (!this.activeScrapers.has(key)) {
      const scraperConfig = {
        timeout: options?.timeout || 30000,
        useReadability: options?.useReadability !== false,
        extractImages: options?.extractImages !== false,
        userAgent: this.config.get('userAgent' as any)
      };
      
      const scraper = ScraperFactory.create(scraperType, scraperConfig);
      this.activeScrapers.set(key, scraper);
      
      // Listen to scraper events
      scraper.on('error', (error) => {
        this.emit('scraper_error', { scraperType, error });
      });
      
      scraper.on('retry', (info) => {
        this.emit('scraper_retry', { scraperType, ...info });
      });
    }
    
    return this.activeScrapers.get(key)!;
  }
  
  /**
   * Filter out already visited URLs
   */
  private filterUniqueUrls(urls: string[]): string[] {
    const unique: string[] = [];
    const seen = new Set<string>();
    
    for (const url of urls) {
      // Normalize URL
      const normalized = this.normalizeUrl(url);
      
      if (!seen.has(normalized) && !this.memory.isUrlVisited(normalized)) {
        seen.add(normalized);
        unique.push(url);
      }
    }
    
    return unique;
  }
  
  /**
   * Normalize URL for comparison
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove hash and trailing slash
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`
        .replace(/\/$/, '');
    } catch {
      return url;
    }
  }
  
  /**
   * Create batches of URLs
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
  
  /**
   * Extract images from scraped content
   */
  async extractImages(urls: string[]): Promise<Map<string, string[]>> {
    const imageMap = new Map<string, string[]>();
    
    for (const url of urls) {
      const scraper = this.getScraper('cheerio', { extractImages: true });
      
      try {
        const result = await scraper.scrape(url);
        if (result.images && result.images.length > 0) {
          imageMap.set(url, result.images);
        }
      } catch (error) {
        this.emit('image_extraction_error', { url, error });
      }
    }
    
    return imageMap;
  }
  
  /**
   * Clean up scraper instances
   */
  async cleanup(): Promise<void> {
    // Close any browser instances (for Puppeteer)
    for (const scraper of this.activeScrapers.values()) {
      if ('close' in scraper && typeof scraper.close === 'function') {
        try {
          await (scraper as any).close();
        } catch (error) {
          this.emit('cleanup_error', { error });
        }
      }
    }
    
    this.activeScrapers.clear();
  }
  
  /**
   * Get scraping statistics
   */
  getStats(): {
    totalScraped: number;
    cachedHits: number;
    failedUrls: number;
    activeScrapers: number;
    visitedUrls: number;
  } {
    const memoryStats = this.memory.getStats();
    
    return {
      totalScraped: memoryStats.scrapedUrls,
      cachedHits: 0, // Would need to track this
      failedUrls: 0, // Would need to track this
      activeScrapers: this.activeScrapers.size,
      visitedUrls: memoryStats.visitedUrls
    };
  }
  
  /**
   * Validate URLs before scraping
   */
  validateUrls(urls: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];
    
    for (const url of urls) {
      try {
        const parsed = new URL(url);
        if (['http:', 'https:'].includes(parsed.protocol)) {
          valid.push(url);
        } else {
          invalid.push(url);
        }
      } catch {
        invalid.push(url);
      }
    }
    
    return { valid, invalid };
  }
  
  /**
   * Priority scraping for important URLs
   */
  async scrapePriority(
    urls: string[],
    priorityUrls: string[],
    options?: ScrapingOptions
  ): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];
    
    // Scrape priority URLs first
    if (priorityUrls.length > 0) {
      this.emit('priority_scraping_start', { urls: priorityUrls.length });
      const priorityResults = await this.scrapeUrls(priorityUrls, {
        ...options,
        maxConcurrency: 1 // Process priority URLs sequentially
      });
      results.push(...priorityResults);
    }
    
    // Then scrape remaining URLs
    const remainingUrls = urls.filter(url => !priorityUrls.includes(url));
    if (remainingUrls.length > 0) {
      const remainingResults = await this.scrapeUrls(remainingUrls, options);
      results.push(...remainingResults);
    }
    
    return results;
  }
}
