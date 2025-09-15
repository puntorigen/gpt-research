/**
 * Memory management for GPT Research
 * Stores research context, sources, and reports
 */

import { SearchResult, ResearchResult } from '../types';

interface MemoryEntry {
  id: string;
  type: string;
  content: any;
  metadata?: any;
  timestamp: Date;
}

export class Memory {
  private entries: Map<string, MemoryEntry> = new Map();
  private entriesByType: Map<string, MemoryEntry[]> = new Map();
  private searchResults: SearchResult[] = [];
  private scrapedContent: Map<string, string> = new Map();
  private visitedUrls: Set<string> = new Set();
  private reports: Map<string, string> = new Map();
  private context: string[] = [];
  private subtopics: Set<string> = new Set();
  private researchResults: ResearchResult[] = [];
  private nextId: number = 1;
  
  constructor() {
    // Initialize maps
  }
  
  add(type: string, content: any, metadata?: any): string {
    const id = `${type}_${this.nextId++}`;
    const entry: MemoryEntry = {
      id,
      type,
      content,
      metadata,
      timestamp: new Date()
    };
    
    this.entries.set(id, entry);
    
    if (!this.entriesByType.has(type)) {
      this.entriesByType.set(type, []);
    }
    this.entriesByType.get(type)!.push(entry);
    
    return id;
  }
  
  get(id: string): MemoryEntry | undefined {
    return this.entries.get(id);
  }
  
  getByType(type: string): MemoryEntry[] {
    return this.entriesByType.get(type) || [];
  }
  
  addSearchResults(query: string, results: SearchResult[]): void {
    this.add('searchQueries', query);
    this.searchResults.push(...results);
    // Mark URLs as visited
    results.forEach(result => {
      if (result.url) {
        this.visitedUrls.add(result.url);
      }
    });
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
  
  getAllScrapedContent(): Map<string, string> {
    return this.scrapedContent;
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
  
  getAllReports(): Map<string, string> {
    return this.reports;
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
  
  addSubtopic(subtopic: string): void {
    this.subtopics.add(subtopic);
  }
  
  addSubtopics(subtopics: string[]): void {
    subtopics.forEach(topic => this.subtopics.add(topic));
  }
  
  getSubtopics(): string[] {
    return Array.from(this.subtopics);
  }
  
  addResearchResult(result: ResearchResult): void {
    this.researchResults.push(result);
  }
  
  getResearchResults(): ResearchResult[] {
    return this.researchResults;
  }
  
  clear(): void {
    this.entries.clear();
    this.entriesByType.clear();
    this.searchResults = [];
    this.scrapedContent.clear();
    this.visitedUrls.clear();
    this.reports.clear();
    this.context = [];
    this.subtopics.clear();
    this.researchResults = [];
    this.nextId = 1;
  }
  
  getStats(): any {
    const stats: any = {
      totalEntries: this.entries.size,
      searchQueries: this.getByType('searchQueries').length,
      searchResults: this.searchResults.length,
      scrapedUrls: this.scrapedContent.size,
      visitedUrls: this.visitedUrls.size,
      reports: this.reports.size,
      contextItems: this.context.length,
      subtopics: this.subtopics.size,
      researchResults: this.researchResults.length
    };
    
    for (const [type, entries] of this.entriesByType.entries()) {
      stats[type] = entries.length;
    }
    
    return stats;
  }
  
  export(): any {
    return {
      entries: Array.from(this.entries.entries()),
      entriesByType: Array.from(this.entriesByType.entries()).map(([type, entries]) => [
        type,
        entries
      ]),
      searchResults: this.searchResults,
      scrapedContent: Array.from(this.scrapedContent.entries()),
      visitedUrls: Array.from(this.visitedUrls),
      reports: Array.from(this.reports.entries()),
      context: this.context,
      subtopics: Array.from(this.subtopics),
      researchResults: this.researchResults,
      nextId: this.nextId
    };
  }
  
  import(data: string | any): void {
    let parsedData: any;
    
    // If data is a string, try to parse it as JSON
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (error) {
        throw new Error('Invalid JSON data');
      }
    } else {
      parsedData = data;
    }
    
    if (parsedData.entries) {
      this.entries = new Map(parsedData.entries);
    }
    if (parsedData.entriesByType) {
      this.entriesByType = new Map(parsedData.entriesByType);
    }
    if (parsedData.searchResults) {
      this.searchResults = parsedData.searchResults;
    }
    if (parsedData.scrapedContent) {
      this.scrapedContent = new Map(parsedData.scrapedContent);
    }
    if (parsedData.visitedUrls) {
      this.visitedUrls = new Set(parsedData.visitedUrls);
    }
    if (parsedData.reports) {
      this.reports = new Map(parsedData.reports);
    }
    if (parsedData.context) {
      this.context = parsedData.context;
    }
    if (parsedData.subtopics) {
      this.subtopics = new Set(parsedData.subtopics);
    }
    if (parsedData.researchResults) {
      this.researchResults = parsedData.researchResults;
    }
    if (parsedData.nextId) {
      this.nextId = parsedData.nextId;
    }
  }
}