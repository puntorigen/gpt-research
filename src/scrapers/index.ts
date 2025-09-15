// Export all scrapers
export { BaseScraper, ScraperConfig, ScraperFactory } from './BaseScraper';
export { CheerioScraper, CheerioScraperConfig } from './CheerioScraper';
export { PuppeteerScraper, PuppeteerScraperConfig } from './PuppeteerScraper';

// Register scrapers with factory
import { ScraperFactory } from './BaseScraper';
import { CheerioScraper } from './CheerioScraper';
import { PuppeteerScraper } from './PuppeteerScraper';

// Register all scrapers
ScraperFactory.register('cheerio', CheerioScraper);
ScraperFactory.register('puppeteer', PuppeteerScraper);

// Helper function to create a scraper
export function createScraper(
  name: string = 'cheerio',
  config?: any
): any {
  return ScraperFactory.create(name, config);
}

// Determine best scraper for a URL
export function getBestScraper(url: string): string {
  // Simple heuristics to choose scraper
  // This can be enhanced based on actual requirements
  
  // Sites known to require JavaScript
  const jsRequiredDomains = [
    'twitter.com',
    'instagram.com',
    'facebook.com',
    'linkedin.com',
    'medium.com',
    'bloomberg.com',
    'wsj.com'
  ];
  
  const urlLower = url.toLowerCase();
  
  for (const domain of jsRequiredDomains) {
    if (urlLower.includes(domain)) {
      return 'puppeteer';
    }
  }
  
  // Default to Cheerio for better performance
  return 'cheerio';
}
