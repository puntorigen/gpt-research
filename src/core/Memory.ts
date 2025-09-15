/**
 * Memory management for GPT Research
 * Stores research context, sources, and reports
 */

import { SearchResult, ResearchResult } from '../types';

interface MemoryEntry {
  timestamp: Date;
  data: any;
}

export class Memory {
  private memory: Map<string, MemoryEntry[]>;
  private searchResults: SearchResult[] = [];
  private scrapedContent: Map<string, string> = new Map();
  private visitedUrls: Set<string> = new Set();
  private reports: Map<string, string> = new Map();
  private context: string[] = [];
  private subtopics: string[] = [];
  private researchResults: ResearchResult[] = [];
  
  constructor() {
    this.memory = new Map();
  }
  
  add(category: string, data: any): void {
    if (!this.memory.has(category)) {
      this.memory.set(category, []);
    }
    
    const entry: MemoryEntry = {
      timestamp: new Date(),
      data
    };
    
    this.memory.get(category)!.push(entry);
  }
  
  get(category: string): MemoryEntry[] {
    return this.memory.get(category) || [];
  }
  
  addSearchResults(query: string, results: SearchResult[]): void {
    this.add('searchQueries', query);
    this.searchResults.push(...results);
  }
  
  getSearchResults(): SearchResult[] {
    return this.searchResults;
  }
  
  addScrapedContent(url: string, content: string): void {
    this.scrapedContent.set(url, content);
    this.visitedUrls.add(url);
  }
  
  getScrapedContent(url: string): string | undefined {
    return this.scrapedContent.get(url);
  }
  
  isUrlVisited(url: string): boolean {
    return this.visitedUrls.has(url);
  }
  
  addReport(reportType: string, report: string): void {
    this.reports.set(reportType, report);
  }
  
  getReport(reportType: string): string | undefined {
    return this.reports.get(reportType);
  }
  
  addContext(context: string): void {
    this.context.push(context);
  }
  
  getContext(): string[] {
    return this.context;
  }
  
  clearContext(): void {
    this.context = [];
  }
  
  addSubtopics(subtopics: string[]): void {
    this.subtopics = subtopics;
  }
  
  getSubtopics(): string[] {
    return this.subtopics;
  }
  
  addResearchResult(result: ResearchResult): void {
    this.researchResults.push(result);
  }
  
  getResearchResults(): ResearchResult[] {
    return this.researchResults;
  }
  
  clear(): void {
    this.memory.clear();
    this.searchResults = [];
    this.scrapedContent.clear();
    this.visitedUrls.clear();
    this.reports.clear();
    this.context = [];
    this.subtopics = [];
    this.researchResults = [];
  }
  
  getStats(): any {
    const stats: any = {
      searchQueries: this.get('searchQueries').length,
      searchResults: this.searchResults.length,
      scrapedUrls: this.scrapedContent.size,
      visitedUrls: this.visitedUrls.size,
      reports: this.reports.size,
      contextItems: this.context.length,
      subtopics: this.subtopics.length,
      researchResults: this.researchResults.length
    };
    
    for (const [category, entries] of this.memory.entries()) {
      stats[category] = entries.length;
    }
    
    return stats;
  }
  
  export(): any {
    return {
      memory: Array.from(this.memory.entries()),
      searchResults: this.searchResults,
      scrapedContent: Array.from(this.scrapedContent.entries()),
      visitedUrls: Array.from(this.visitedUrls),
      reports: Array.from(this.reports.entries()),
      context: this.context,
      subtopics: this.subtopics,
      researchResults: this.researchResults
    };
  }
  
  import(data: any): void {
    if (data.memory) {
      this.memory = new Map(data.memory);
    }
    if (data.searchResults) {
      this.searchResults = data.searchResults;
    }
    if (data.scrapedContent) {
      this.scrapedContent = new Map(data.scrapedContent);
    }
    if (data.visitedUrls) {
      this.visitedUrls = new Set(data.visitedUrls);
    }
    if (data.reports) {
      this.reports = new Map(data.reports);
    }
    if (data.context) {
      this.context = data.context;
    }
    if (data.subtopics) {
      this.subtopics = data.subtopics;
    }
    if (data.researchResults) {
      this.researchResults = data.researchResults;
    }
  }
}