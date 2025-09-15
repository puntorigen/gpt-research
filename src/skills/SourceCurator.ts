import { EventEmitter } from 'events';
import { Config } from '../core/Config';
import { Memory } from '../core/Memory';
import { SearchResult, ChatMessage } from '../types';
import { LLMProvider } from '../providers/LLMProvider';

export interface SourceValidation {
  url: string;
  isValid: boolean;
  credibilityScore: number;
  reasons: string[];
  warnings: string[];
}

export interface CurationCriteria {
  minCredibilityScore?: number;
  requireHttps?: boolean;
  allowedDomains?: string[];
  blockedDomains?: string[];
  maxAge?: number; // days
  requireDate?: boolean;
  minContentLength?: number;
}

export class SourceCurator extends EventEmitter {
  private config: Config;
  // private memory: Memory; // Not used in current implementation
  private trustedDomains: Set<string>;
  private blockedDomains: Set<string>;
  private domainScores: Map<string, number>;
  
  constructor(config: Config, _memory: Memory) {
    super();
    this.config = config;
    // this.memory = memory; // Not used in current implementation
    
    // Initialize domain lists
    this.trustedDomains = new Set([
      // Academic and research
      'arxiv.org',
      'scholar.google.com',
      'pubmed.ncbi.nlm.nih.gov',
      'ieee.org',
      'acm.org',
      'springer.com',
      'sciencedirect.com',
      'nature.com',
      'science.org',
      
      // News and media
      'reuters.com',
      'apnews.com',
      'bbc.com',
      'nytimes.com',
      'wsj.com',
      'ft.com',
      'economist.com',
      'bloomberg.com',
      
      // Technology
      'github.com',
      'stackoverflow.com',
      'developer.mozilla.org',
      'w3.org',
      
      // Government and organizations
      '.gov',
      '.edu',
      'who.int',
      'un.org',
      'worldbank.org',
      
      // Reference
      'wikipedia.org',
      'britannica.com'
    ]);
    
    this.blockedDomains = new Set([
      // Known unreliable sources
      'example.com',
      'test.com'
    ]);
    
    this.domainScores = new Map();
  }
  
  /**
   * Validate and curate search results
   */
  async curateSearchResults(
    results: SearchResult[],
    criteria?: CurationCriteria
  ): Promise<SearchResult[]> {
    this.emit('curation_start', { total: results.length });
    
    const validations = await this.validateSources(results, criteria);
    const curated = results.filter((_result, index) => 
      validations[index].isValid
    );
    
    // Sort by credibility score
    curated.sort((a, b) => {
      const aScore = validations[results.indexOf(a)].credibilityScore;
      const bScore = validations[results.indexOf(b)].credibilityScore;
      return bScore - aScore;
    });
    
    this.emit('curation_complete', {
      original: results.length,
      curated: curated.length,
      filtered: results.length - curated.length
    });
    
    return curated;
  }
  
  /**
   * Validate multiple sources
   */
  async validateSources(
    sources: SearchResult[],
    criteria?: CurationCriteria
  ): Promise<SourceValidation[]> {
    const validations: SourceValidation[] = [];
    
    for (const source of sources) {
      const validation = await this.validateSource(source, criteria);
      validations.push(validation);
      
      this.emit('source_validated', {
        url: source.url,
        valid: validation.isValid,
        score: validation.credibilityScore
      });
    }
    
    return validations;
  }
  
  /**
   * Validate a single source
   */
  async validateSource(
    source: SearchResult,
    criteria?: CurationCriteria
  ): Promise<SourceValidation> {
    const validation: SourceValidation = {
      url: source.url,
      isValid: true,
      credibilityScore: 50, // Start with neutral score
      reasons: [],
      warnings: []
    };
    
    try {
      const url = new URL(source.url);
      const domain = url.hostname;
      
      // Check HTTPS requirement
      if (criteria?.requireHttps && url.protocol !== 'https:') {
        validation.warnings.push('Not using HTTPS');
        validation.credibilityScore -= 10;
      }
      
      // Check domain trust level
      const domainCheck = this.checkDomain(domain);
      validation.credibilityScore += domainCheck.score;
      if (domainCheck.trusted) {
        validation.reasons.push(`Trusted domain: ${domain}`);
      }
      if (domainCheck.blocked) {
        validation.isValid = false;
        validation.reasons.push(`Blocked domain: ${domain}`);
      }
      
      // Check allowed domains
      if (criteria?.allowedDomains && criteria.allowedDomains.length > 0) {
        const allowed = criteria.allowedDomains.some(allowed => 
          domain.includes(allowed)
        );
        if (!allowed) {
          validation.isValid = false;
          validation.reasons.push('Domain not in allowed list');
        }
      }
      
      // Check blocked domains
      if (criteria?.blockedDomains && criteria.blockedDomains.length > 0) {
        const blocked = criteria.blockedDomains.some(blocked => 
          domain.includes(blocked)
        );
        if (blocked) {
          validation.isValid = false;
          validation.reasons.push('Domain in blocked list');
        }
      }
      
      // Check content age
      if (criteria?.maxAge && source.publishedDate) {
        const ageInDays = (Date.now() - new Date(source.publishedDate).getTime()) / 
                         (24 * 60 * 60 * 1000);
        if (ageInDays > criteria.maxAge) {
          validation.warnings.push(`Content is ${Math.floor(ageInDays)} days old`);
          validation.credibilityScore -= 5;
        }
      }
      
      // Check for date requirement
      if (criteria?.requireDate && !source.publishedDate) {
        validation.warnings.push('No publication date available');
        validation.credibilityScore -= 5;
      }
      
      // Check content length
      if (criteria?.minContentLength) {
        const contentLength = (source.content || source.snippet || '').length;
        if (contentLength < criteria.minContentLength) {
          validation.warnings.push('Content too short');
          validation.credibilityScore -= 10;
        }
      }
      
      // Score based on content quality indicators
      validation.credibilityScore += this.scoreContent(source);
      
      // Apply minimum credibility threshold
      if (criteria?.minCredibilityScore && 
          validation.credibilityScore < criteria.minCredibilityScore) {
        validation.isValid = false;
        validation.reasons.push(`Credibility score too low: ${validation.credibilityScore}`);
      }
      
      // Ensure score is within bounds
      validation.credibilityScore = Math.max(0, Math.min(100, validation.credibilityScore));
      
    } catch (error) {
      validation.isValid = false;
      validation.reasons.push('Invalid URL');
      validation.credibilityScore = 0;
    }
    
    return validation;
  }
  
  /**
   * Check domain trust level
   */
  private checkDomain(domain: string): {
    trusted: boolean;
    blocked: boolean;
    score: number;
  } {
    // Check if cached
    if (this.domainScores.has(domain)) {
      const score = this.domainScores.get(domain)!;
      return {
        trusted: score > 20,
        blocked: score < -20,
        score
      };
    }
    
    let score = 0;
    let trusted = false;
    let blocked = false;
    
    // Check trusted domains
    for (const trustedDomain of this.trustedDomains) {
      if (domain.includes(trustedDomain) || 
          (trustedDomain.startsWith('.') && domain.endsWith(trustedDomain))) {
        trusted = true;
        score += 30;
        break;
      }
    }
    
    // Check blocked domains
    for (const blockedDomain of this.blockedDomains) {
      if (domain.includes(blockedDomain)) {
        blocked = true;
        score -= 50;
        break;
      }
    }
    
    // Additional scoring based on TLD
    if (domain.endsWith('.edu')) score += 20;
    if (domain.endsWith('.gov')) score += 25;
    if (domain.endsWith('.org')) score += 10;
    if (domain.endsWith('.io')) score -= 5;
    if (domain.endsWith('.info')) score -= 10;
    
    // Cache the score
    this.domainScores.set(domain, score);
    
    return { trusted, blocked, score };
  }
  
  /**
   * Score content quality
   */
  private scoreContent(source: SearchResult): number {
    let score = 0;
    const content = source.content || source.snippet || '';
    
    // Check for author
    if (source.author) score += 5;
    
    // Check content length
    if (content.length > 500) score += 5;
    if (content.length > 1000) score += 5;
    
    // Check for citations/references (simple heuristic)
    if (content.match(/\[\d+\]/g) || content.match(/\(\d{4}\)/g)) {
      score += 10;
    }
    
    // Check for structured content
    if (source.title && source.title.length > 10) score += 5;
    
    // Penalize clickbait indicators
    const clickbaitWords = ['shocking', 'you won\'t believe', 'one weird trick', 'doctors hate'];
    const titleLower = source.title.toLowerCase();
    if (clickbaitWords.some(word => titleLower.includes(word))) {
      score -= 15;
    }
    
    return score;
  }
  
  /**
   * Verify source with LLM
   */
  async verifyWithLLM(
    source: SearchResult,
    llmProvider: LLMProvider
  ): Promise<{
    credible: boolean;
    analysis: string;
    concerns: string[];
  }> {
    const systemPrompt = `You are a source credibility analyst. Evaluate the given source for credibility, bias, and reliability. Be objective and thorough.`;
    
    const userPrompt = `Evaluate the credibility of this source:

Title: ${source.title}
URL: ${source.url}
Content Preview: ${source.snippet || source.content?.substring(0, 500)}
${source.author ? `Author: ${source.author}` : ''}
${source.publishedDate ? `Published: ${source.publishedDate}` : ''}

Provide:
1. Overall credibility assessment (credible/not credible)
2. Brief analysis of the source
3. Any concerns or red flags

Format your response as JSON with keys: credible (boolean), analysis (string), concerns (array of strings)`;
    
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    try {
      const response = await llmProvider.createChatCompletion(messages, {
        model: this.config.get('fastLLMModel'),
        temperature: 0.3,
        maxTokens: 500
      });
      
      // Parse JSON response
      const result = JSON.parse(response);
      return {
        credible: result.credible || false,
        analysis: result.analysis || '',
        concerns: result.concerns || []
      };
      
    } catch (error) {
      this.emit('llm_verification_error', { error, url: source.url });
      
      // Fallback to basic validation
      return {
        credible: true,
        analysis: 'LLM verification unavailable',
        concerns: []
      };
    }
  }
  
  /**
   * Add trusted domain
   */
  addTrustedDomain(domain: string): void {
    this.trustedDomains.add(domain);
    this.domainScores.delete(domain); // Clear cache
  }
  
  /**
   * Add blocked domain
   */
  addBlockedDomain(domain: string): void {
    this.blockedDomains.add(domain);
    this.domainScores.delete(domain); // Clear cache
  }
  
  /**
   * Get domain statistics
   */
  getDomainStats(): {
    trusted: number;
    blocked: number;
    cached: number;
    averageScore: number;
  } {
    const scores = Array.from(this.domainScores.values());
    const averageScore = scores.length > 0 
      ? scores.reduce((a, b) => a + b, 0) / scores.length 
      : 0;
    
    return {
      trusted: this.trustedDomains.size,
      blocked: this.blockedDomains.size,
      cached: this.domainScores.size,
      averageScore
    };
  }
  
  /**
   * Export configuration
   */
  exportConfig(): {
    trustedDomains: string[];
    blockedDomains: string[];
  } {
    return {
      trustedDomains: Array.from(this.trustedDomains),
      blockedDomains: Array.from(this.blockedDomains)
    };
  }
  
  /**
   * Import configuration
   */
  importConfig(config: {
    trustedDomains?: string[];
    blockedDomains?: string[];
  }): void {
    if (config.trustedDomains) {
      config.trustedDomains.forEach(domain => this.trustedDomains.add(domain));
    }
    if (config.blockedDomains) {
      config.blockedDomains.forEach(domain => this.blockedDomains.add(domain));
    }
    
    // Clear domain score cache
    this.domainScores.clear();
  }
}
