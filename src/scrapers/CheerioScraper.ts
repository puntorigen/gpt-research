import * as cheerio from 'cheerio';
import axios, { AxiosRequestConfig } from 'axios';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { BaseScraper, ScraperConfig } from './BaseScraper';
import { ScrapedContent } from '../types';

export interface CheerioScraperConfig extends ScraperConfig {
  useReadability?: boolean; // Use Mozilla Readability for article extraction
  extractImages?: boolean; // Extract image URLs
  extractLinks?: boolean; // Extract all links
  removeScripts?: boolean; // Remove script tags
  removeStyles?: boolean; // Remove style tags
  maxContentLength?: number; // Maximum content length
}

export class CheerioScraper extends BaseScraper {
  protected config: CheerioScraperConfig;
  
  constructor(name: string = 'Cheerio', config?: CheerioScraperConfig) {
    super(name, config);
    this.config = {
      useReadability: true,
      extractImages: true,
      extractLinks: false,
      removeScripts: true,
      removeStyles: true,
      maxContentLength: 50000,
      ...config
    } as CheerioScraperConfig;
  }
  
  async scrape(url: string): Promise<ScrapedContent> {
    try {
      if (!this.validateUrl(url)) {
        throw new Error('Invalid URL');
      }
      
      this.emit('scraping_start', { scraper: this.name, url });
      
      // Fetch the HTML content
      const html = await this.fetchHtml(url);
      
      // Try Readability first if enabled
      if (this.config.useReadability) {
        const readabilityContent = this.extractWithReadability(url, html);
        if (readabilityContent && readabilityContent.content) {
          this.emit('scraping_complete', { 
            scraper: this.name, 
            url, 
            method: 'readability' 
          });
          return readabilityContent;
        }
      }
      
      // Fallback to Cheerio extraction
      const cheerioContent = this.extractWithCheerio(url, html);
      
      this.emit('scraping_complete', { 
        scraper: this.name, 
        url, 
        method: 'cheerio' 
      });
      
      return cheerioContent;
      
    } catch (error: any) {
      return this.handleError(error, url);
    }
  }
  
  private async fetchHtml(url: string): Promise<string> {
    const axiosConfig: AxiosRequestConfig = {
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent!,
        ...this.config.headers
      },
      maxRedirects: this.config.followRedirects ? 5 : 0,
      validateStatus: (status) => status < 400
    };
    
    const response = await this.retry(() => axios.get(url, axiosConfig));
    
    if (typeof response.data !== 'string') {
      // If the response is JSON or other format, convert to string
      return JSON.stringify(response.data);
    }
    
    return response.data;
  }
  
  private extractWithReadability(url: string, html: string): ScrapedContent | null {
    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      
      if (!article) {
        return null;
      }
      
      const $ = cheerio.load(html);
      const images = this.config.extractImages ? this.extractImages($ as any, url) : [];
      
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
        message: 'Readability extraction failed, falling back to Cheerio',
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  
  private extractWithCheerio(url: string, html: string): ScrapedContent {
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    if (this.config.removeScripts) {
      $('script').remove();
    }
    if (this.config.removeStyles) {
      $('style').remove();
    }
    $('noscript').remove();
    $('iframe').remove();
    
    // Extract title
    const title = this.extractTitle($ as any);
    
    // Extract main content
    const content = this.extractContent($ as any);
    
    // Extract images if enabled
    const images = this.config.extractImages ? this.extractImages($ as any, url) : [];
    
    // Extract metadata
    const metadata = this.extractMetadataFromCheerio($ as any);
    
    // Extract links if enabled
    if (this.config.extractLinks) {
      metadata.links = this.extractLinks($ as any, url);
    }
    
    // Convert to markdown
    const markdown = this.htmlToMarkdown($.html());
    
    return {
      url,
      title,
      content: this.cleanText(content),
      markdown,
      images,
      metadata
    };
  }
  
  private extractTitle($: cheerio.CheerioAPI): string {
    // Try multiple strategies to get the title
    return (
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() ||
      $('h1').first().text() ||
      'Untitled'
    ).trim();
  }
  
  private extractContent($: cheerio.CheerioAPI): string {
    // Try to find the main content area
    const contentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '#main',
      '#content',
      '.content',
      '.post',
      '.article',
      '.entry-content',
      '.post-content'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        return element.text();
      }
    }
    
    // Fallback: get body text but try to exclude navigation, footer, etc.
    $('nav, header, footer, aside, .nav, .header, .footer, .sidebar').remove();
    
    let content = $('body').text();
    
    // Truncate if too long
    if (this.config.maxContentLength && content.length > this.config.maxContentLength) {
      content = content.substring(0, this.config.maxContentLength) + '...';
    }
    
    return content;
  }
  
  private extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const images: string[] = [];
    const seen = new Set<string>();
    
    $('img').each((_, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src') || $(elem).attr('data-lazy-src');
      if (src) {
        const absoluteUrl = this.makeAbsoluteUrl(src, baseUrl);
        if (absoluteUrl && !seen.has(absoluteUrl)) {
          seen.add(absoluteUrl);
          images.push(absoluteUrl);
        }
      }
    });
    
    // Also check meta tags for images
    const ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) {
      const absoluteUrl = this.makeAbsoluteUrl(ogImage, baseUrl);
      if (absoluteUrl && !seen.has(absoluteUrl)) {
        images.unshift(absoluteUrl); // Add to beginning as it's likely the main image
      }
    }
    
    return images;
  }
  
  private extractLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const links: string[] = [];
    const seen = new Set<string>();
    
    $('a[href]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        const absoluteUrl = this.makeAbsoluteUrl(href, baseUrl);
        if (absoluteUrl && !seen.has(absoluteUrl)) {
          seen.add(absoluteUrl);
          links.push(absoluteUrl);
        }
      }
    });
    
    return links;
  }
  
  private extractMetadataFromCheerio($: cheerio.CheerioAPI): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // Extract common meta tags
    const metaTags = [
      'description',
      'keywords',
      'author',
      'viewport',
      'robots',
      'canonical',
      'og:type',
      'og:site_name',
      'og:description',
      'article:published_time',
      'article:modified_time',
      'article:author',
      'twitter:card',
      'twitter:site',
      'twitter:creator'
    ];
    
    metaTags.forEach(tag => {
      const content = $(`meta[name="${tag}"]`).attr('content') || 
                     $(`meta[property="${tag}"]`).attr('content');
      if (content) {
        metadata[tag] = content;
      }
    });
    
    // Extract structured data if present
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const jsonLd = JSON.parse($(elem).html() || '{}');
        metadata.structuredData = metadata.structuredData || [];
        metadata.structuredData.push(jsonLd);
      } catch {
        // Ignore parsing errors
      }
    });
    
    return metadata;
  }
  
  private makeAbsoluteUrl(url: string, baseUrl: string): string | null {
    try {
      // Already absolute
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      
      // Protocol-relative
      if (url.startsWith('//')) {
        const base = new URL(baseUrl);
        return `${base.protocol}${url}`;
      }
      
      // Relative URL
      return new URL(url, baseUrl).href;
    } catch {
      return null;
    }
  }
}
