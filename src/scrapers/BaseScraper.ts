import { EventEmitter } from 'events';
import { ScrapedContent } from '../types';

export interface ScraperConfig {
  timeout?: number;
  headers?: Record<string, string>;
  userAgent?: string;
  maxRetries?: number;
  followRedirects?: boolean;
}

export abstract class BaseScraper extends EventEmitter {
  protected config: ScraperConfig;
  protected name: string;
  
  constructor(name: string, config?: ScraperConfig) {
    super();
    this.name = name;
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      followRedirects: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...config
    };
  }
  
  /**
   * Main scraping method that must be implemented by each scraper
   */
  abstract scrape(url: string): Promise<ScrapedContent>;
  
  /**
   * Batch scraping for multiple URLs
   */
  async scrapeMultiple(
    urls: string[],
    concurrency: number = 3
  ): Promise<ScrapedContent[]> {
    const results: ScrapedContent[] = [];
    const chunks: string[][] = [];
    
    // Split URLs into chunks for concurrent processing
    for (let i = 0; i < urls.length; i += concurrency) {
      chunks.push(urls.slice(i, i + concurrency));
    }
    
    // Process chunks sequentially, URLs within each chunk concurrently
    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(url => this.scrape(url))
      );
      
      for (let i = 0; i < chunkResults.length; i++) {
        const result = chunkResults[i];
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Add error result
          results.push({
            url: chunk[i],
            title: 'Error',
            content: '',
            error: result.reason?.message || 'Failed to scrape'
          });
        }
      }
    }
    
    return results;
  }
  
  /**
   * Get the name of the scraper
   */
  getName(): string {
    return this.name;
  }
  
  /**
   * Validate URL before scraping
   */
  protected validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }
  
  /**
   * Clean and normalize text content
   */
  protected cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
      .replace(/\t+/g, ' ') // Replace tabs with spaces
      .trim();
  }
  
  /**
   * Extract metadata from HTML
   */
  protected extractMetadata(html: string): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Extract meta tags (basic regex approach)
    const metaRegex = /<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]+)"/gi;
    let match;
    
    while ((match = metaRegex.exec(html)) !== null) {
      metadata[match[1]] = match[2];
    }
    
    return metadata;
  }
  
  /**
   * Convert HTML to Markdown (basic implementation)
   */
  protected htmlToMarkdown(html: string): string {
    // This is a very basic implementation
    // For production, use a proper HTML to Markdown converter
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (_match, content) => {
        return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n';
      })
      .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (_match, content) => {
        let counter = 0;
        return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => {
          counter++;
          return `${counter}. $1\n`;
        }) + '\n';
      })
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n')
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n')
      .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .trim();
  }
  
  /**
   * Handle errors consistently
   */
  protected handleError(error: any, url: string): ScrapedContent {
    const errorMessage = error?.message || 'Unknown scraping error';
    
    this.emit('error', {
      scraper: this.name,
      url,
      error: errorMessage
    });
    
    return {
      url,
      title: 'Error',
      content: '',
      error: errorMessage
    };
  }
  
  /**
   * Retry logic for scraping
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    retries?: number,
    delay: number = 1000
  ): Promise<T> {
    const maxRetries = retries ?? this.config.maxRetries ?? 3;
    
    try {
      return await fn();
    } catch (error: any) {
      if (maxRetries === 0) {
        throw error;
      }
      
      this.emit('retry', {
        scraper: this.name,
        retriesLeft: maxRetries,
        error: error.message
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retry(fn, maxRetries - 1, delay * 2);
    }
  }
}

// Factory for creating scrapers
export class ScraperFactory {
  private static scrapers: Map<string, typeof BaseScraper> = new Map();
  
  public static register(name: string, scraper: typeof BaseScraper): void {
    this.scrapers.set(name.toLowerCase(), scraper);
  }
  
  public static create(name: string, config?: ScraperConfig): BaseScraper {
    const Scraper = this.scrapers.get(name.toLowerCase());
    if (!Scraper) {
      throw new Error(`Unknown scraper: ${name}`);
    }
    
    return new (Scraper as any)(name, config);
  }
  
  public static getAvailableScrapers(): string[] {
    return Array.from(this.scrapers.keys());
  }
}
