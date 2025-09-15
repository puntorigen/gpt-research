import puppeteer, { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { BaseScraper, ScraperConfig } from './BaseScraper';
import { ScrapedContent } from '../types';

export interface PuppeteerScraperConfig extends ScraperConfig {
  headless?: boolean;
  useReadability?: boolean;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  waitForSelector?: string;
  scrollToBottom?: boolean;
  extractImages?: boolean;
  blockResources?: string[]; // Resource types to block (e.g., ['image', 'font'])
  viewport?: { width: number; height: number };
  executablePath?: string;
  isVercel?: boolean; // Auto-detect Vercel environment
}

export class PuppeteerScraper extends BaseScraper {
  protected config: PuppeteerScraperConfig;
  private browser: Browser | null = null;
  
  constructor(name: string = 'Puppeteer', config?: PuppeteerScraperConfig) {
    super(name, config);
    
    // Detect if running on Vercel
    const isVercel = process.env.VERCEL === '1' || process.env.NOW_REGION !== undefined;
    
    this.config = {
      headless: true,
      useReadability: true,
      waitUntil: 'networkidle2',
      scrollToBottom: true,
      extractImages: true,
      viewport: { width: 1920, height: 1080 },
      isVercel,
      ...config
    } as PuppeteerScraperConfig;
  }
  
  async scrape(url: string): Promise<ScrapedContent> {
    let page: Page | null = null;
    
    try {
      if (!this.validateUrl(url)) {
        throw new Error('Invalid URL');
      }
      
      this.emit('scraping_start', { scraper: this.name, url });
      
      // Launch browser if not already launched
      if (!this.browser) {
        await this.launchBrowser();
      }
      
      // Create new page
      page = await this.browser!.newPage();
      
      // Set viewport
      if (this.config.viewport) {
        await page.setViewport(this.config.viewport);
      }
      
      // Set user agent
      if (this.config.userAgent) {
        await page.setUserAgent(this.config.userAgent);
      }
      
      // Block unnecessary resources to speed up loading
      if (this.config.blockResources && this.config.blockResources.length > 0) {
        await page.setRequestInterception(true);
        page.on('request', (request) => {
          if (this.config.blockResources!.includes(request.resourceType())) {
            request.abort();
          } else {
            request.continue();
          }
        });
      }
      
      // Navigate to the page
      await page.goto(url, {
        waitUntil: this.config.waitUntil,
        timeout: this.config.timeout
      });
      
      // Wait for specific selector if provided
      if (this.config.waitForSelector) {
        await page.waitForSelector(this.config.waitForSelector, {
          timeout: 5000
        }).catch(() => {
          this.emit('warning', {
            message: `Selector ${this.config.waitForSelector} not found, continuing anyway`
          });
        });
      }
      
      // Scroll to bottom to trigger lazy loading
      if (this.config.scrollToBottom) {
        await this.autoScroll(page);
      }
      
      // Get the page content
      const html = await page.content();
      
      // Extract content
      let result: ScrapedContent;
      
      if (this.config.useReadability) {
        result = await this.extractWithReadability(page, url, html);
      } else {
        result = await this.extractWithPuppeteer(page, url);
      }
      
      this.emit('scraping_complete', { 
        scraper: this.name, 
        url, 
        method: this.config.useReadability ? 'readability' : 'puppeteer' 
      });
      
      return result;
      
    } catch (error: any) {
      return this.handleError(error, url);
    } finally {
      // Close the page
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }
  
  private async launchBrowser(): Promise<void> {
    const options: PuppeteerLaunchOptions = {
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // For serverless environments
        '--disable-gpu'
      ]
    };
    
    // Configure for Vercel/serverless environment
    if (this.config.isVercel) {
      options.args = [...(chromium.args || []), ...(options.args || [])];
      options.defaultViewport = chromium.defaultViewport;
      options.executablePath = await chromium.executablePath();
      options.headless = chromium.headless;
    } else if (this.config.executablePath) {
      options.executablePath = this.config.executablePath;
    } else {
      // Try to use system Chrome/Chromium
      // Try to import regular puppeteer (not installed in this setup)
      // const puppeteerDefault = (await import('puppeteer')).default;
      const puppeteerDefault = null; // Use puppeteer-core only
      if (puppeteerDefault) {
        this.browser = await (puppeteerDefault as any).launch(options);
      } else {
        throw new Error('Puppeteer not available');
      }
      return;
    }
    
    this.browser = await puppeteer.launch(options);
  }
  
  private async autoScroll(page: Page): Promise<void> {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
        
        // Maximum scroll time: 10 seconds
        setTimeout(() => {
          clearInterval(timer);
          resolve();
        }, 10000);
      });
    });
  }
  
  private async extractWithReadability(
    page: Page,
    url: string,
    html: string
  ): Promise<ScrapedContent> {
    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      
      if (!article) {
        // Fallback to Puppeteer extraction
        return this.extractWithPuppeteer(page, url);
      }
      
      // Extract images if enabled
      const images = this.config.extractImages ? 
        await this.extractImages(page) : [];
      
      return {
        url,
        title: article.title,
        content: this.cleanText(article.textContent || ''),
        markdown: this.htmlToMarkdown(article.content || ''),
        images,
        metadata: {
          byline: article.byline,
          excerpt: article.excerpt,
          length: article.length,
          siteName: article.siteName
        }
      };
    } catch (error) {
      this.emit('warning', {
        message: 'Readability extraction failed, falling back to Puppeteer',
        error: error instanceof Error ? error.message : String(error)
      });
      return this.extractWithPuppeteer(page, url);
    }
  }
  
  private async extractWithPuppeteer(
    page: Page,
    url: string
  ): Promise<ScrapedContent> {
    // Extract data using Puppeteer's evaluation
    const data = await page.evaluate(() => {
      // Helper function to get text content
      const getText = (selector: string): string => {
        const element = document.querySelector(selector);
        return element?.textContent?.trim() || '';
      };
      
      // Extract title
      const title = 
        document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
        document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
        document.title ||
        getText('h1') ||
        'Untitled';
      
      // Extract main content
      const contentSelectors = [
        'main',
        'article',
        '[role="main"]',
        '#main',
        '#content',
        '.content',
        '.post',
        '.article'
      ];
      
      let content = '';
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          content = element.textContent || '';
          break;
        }
      }
      
      if (!content) {
        // Fallback: get body text
        const body = document.body.cloneNode(true) as HTMLElement;
        // Remove unwanted elements
        const unwanted = body.querySelectorAll('script, style, nav, header, footer');
        unwanted.forEach(el => el.remove());
        content = body.textContent || '';
      }
      
      // Extract metadata
      const metadata: Record<string, any> = {};
      const metaTags = document.querySelectorAll('meta[name], meta[property]');
      metaTags.forEach(tag => {
        const name = tag.getAttribute('name') || tag.getAttribute('property');
        const content = tag.getAttribute('content');
        if (name && content) {
          metadata[name] = content;
        }
      });
      
      // Extract structured data
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      if (jsonLdScripts.length > 0) {
        metadata.structuredData = [];
        jsonLdScripts.forEach(script => {
          try {
            metadata.structuredData.push(JSON.parse(script.textContent || '{}'));
          } catch {
            // Ignore parsing errors
          }
        });
      }
      
      return {
        title,
        content,
        metadata
      };
    });
    
    // Extract images if enabled
    const images = this.config.extractImages ? 
      await this.extractImages(page) : [];
    
    return {
      url,
      title: data.title,
      content: this.cleanText(data.content),
      markdown: this.htmlToMarkdown(data.content),
      images,
      metadata: data.metadata
    };
  }
  
  private async extractImages(page: Page): Promise<string[]> {
    return page.evaluate(() => {
      const images: string[] = [];
      const seen = new Set<string>();
      
      // Get all img elements
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        if (src && !seen.has(src)) {
          seen.add(src);
          images.push(src);
        }
      });
      
      // Get og:image
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (ogImage && !seen.has(ogImage)) {
        images.unshift(ogImage); // Add to beginning
      }
      
      return images;
    });
  }
  
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
  
  // Override scrapeMultiple to reuse browser
  async scrapeMultiple(
    urls: string[],
    concurrency: number = 3
  ): Promise<ScrapedContent[]> {
    try {
      // Launch browser once for all URLs
      if (!this.browser) {
        await this.launchBrowser();
      }
      
      // Use parent's scrapeMultiple which will reuse the browser
      return super.scrapeMultiple(urls, concurrency);
    } finally {
      // Close browser after all scraping is done
      await this.close();
    }
  }
}
