import { EventEmitter } from 'events';
import { Config } from '../core/Config';
import { Memory } from '../core/Memory';
import { ChatMessage } from '../types';
import { LLMProvider } from '../providers/LLMProvider';
import { estimateTokens } from '../utils/cost';

export interface ContextChunk {
  content: string;
  source: string;
  relevance: number;
  tokens: number;
}

export class ContextManager extends EventEmitter {
  private config: Config;
  private memory: Memory;
  private maxContextTokens: number;
  private compressionRatio: number;
  
  constructor(config: Config, memory: Memory) {
    super();
    this.config = config;
    this.memory = memory;
    this.maxContextTokens = 8000; // Default max context size
    this.compressionRatio = 0.3; // Target compression ratio
  }
  
  /**
   * Build context from search results and scraped content
   */
  async buildContext(
    sources: Array<{ url: string; content: string }>,
    llmProvider: LLMProvider
  ): Promise<string[]> {
    this.emit('context_building_start', { sources: sources.length });
    
    try {
      // Create context chunks from sources
      const chunks = this.createContextChunks(sources);
      
      // Sort by relevance
      chunks.sort((a, b) => b.relevance - a.relevance);
      
      // Select chunks within token limit
      const selectedChunks = this.selectChunks(chunks);
      
      // Compress if needed
      const compressedContext = await this.compressContext(selectedChunks, llmProvider);
      
      // Store in memory
      compressedContext.forEach(ctx => this.memory.addContext(ctx));
      
      this.emit('context_building_complete', {
        originalSources: sources.length,
        contextItems: compressedContext.length,
        totalTokens: compressedContext.reduce((sum, ctx) => sum + estimateTokens(ctx), 0)
      });
      
      return compressedContext;
      
    } catch (error) {
      this.emit('context_building_error', { error });
      throw error;
    }
  }
  
  /**
   * Create context chunks from sources
   */
  private createContextChunks(
    sources: Array<{ url: string; content: string }>
  ): ContextChunk[] {
    const query = this.config.get('query')?.toLowerCase() || '';
    const queryTerms = query.split(/\s+/).filter((term: string) => term.length > 2);
    
    return sources.map(source => {
      const content = this.cleanContent(source.content);
      const tokens = estimateTokens(content);
      const relevance = this.calculateRelevance(content, queryTerms);
      
      return {
        content,
        source: source.url,
        relevance,
        tokens
      };
    });
  }
  
  /**
   * Calculate relevance score for content
   */
  private calculateRelevance(content: string, queryTerms: string[]): number {
    const contentLower = content.toLowerCase();
    let score = 0;
    
    // Count query term occurrences
    queryTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = contentLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    });
    
    // Normalize by content length
    const words = content.split(/\s+/).length;
    const normalizedScore = (score / Math.max(words, 1)) * 100;
    
    // Add position bonus (earlier content is often more relevant)
    const positionBonus = 1.0; // Could be adjusted based on position in original doc
    
    return normalizedScore * positionBonus;
  }
  
  /**
   * Select chunks within token limit
   */
  private selectChunks(chunks: ContextChunk[]): ContextChunk[] {
    const selected: ContextChunk[] = [];
    let totalTokens = 0;
    
    for (const chunk of chunks) {
      if (totalTokens + chunk.tokens <= this.maxContextTokens) {
        selected.push(chunk);
        totalTokens += chunk.tokens;
      } else if (chunk.relevance > selected[selected.length - 1]?.relevance) {
        // Replace least relevant chunk if this one is more relevant
        const leastRelevantIndex = selected.reduce((minIdx, curr, idx, arr) => 
          curr.relevance < arr[minIdx].relevance ? idx : minIdx, 0
        );
        
        if (chunk.relevance > selected[leastRelevantIndex].relevance) {
          totalTokens = totalTokens - selected[leastRelevantIndex].tokens + chunk.tokens;
          if (totalTokens <= this.maxContextTokens) {
            selected[leastRelevantIndex] = chunk;
          }
        }
      }
    }
    
    return selected;
  }
  
  /**
   * Compress context using LLM
   */
  async compressContext(
    chunks: ContextChunk[],
    llmProvider: LLMProvider
  ): Promise<string[]> {
    this.emit('compression_start', { chunks: chunks.length });
    
    const compressed: string[] = [];
    
    for (const chunk of chunks) {
      // Skip if already small enough
      if (chunk.tokens < 500) {
        compressed.push(chunk.content);
        continue;
      }
      
      try {
        const compressedContent = await this.compressChunk(chunk, llmProvider);
        compressed.push(compressedContent);
        
        this.emit('chunk_compressed', {
          original: chunk.tokens,
          compressed: estimateTokens(compressedContent),
          source: chunk.source
        });
      } catch (error) {
        // If compression fails, use original
        this.emit('compression_error', { error, source: chunk.source });
        compressed.push(chunk.content);
      }
    }
    
    this.emit('compression_complete', {
      original: chunks.length,
      compressed: compressed.length
    });
    
    return compressed;
  }
  
  /**
   * Compress a single chunk
   */
  private async compressChunk(
    chunk: ContextChunk,
    llmProvider: LLMProvider
  ): Promise<string> {
    const systemPrompt = `You are a content compression assistant. Your task is to compress the given text while preserving all key information, facts, and insights. Remove redundancy and verbose language but keep all important details.`;
    
    const userPrompt = `Compress the following text to approximately ${Math.floor(chunk.tokens * this.compressionRatio)} tokens while preserving all key information:

${chunk.content}

Compressed version:`;
    
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    const compressed = await llmProvider.createChatCompletion(messages, {
      model: this.config.get('fastLLMModel'),
      temperature: 0.3,
      maxTokens: Math.floor(chunk.tokens * this.compressionRatio * 1.2)
    });
    
    return compressed;
  }
  
  /**
   * Clean content for processing
   */
  private cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
      .replace(/#+\s/g, '') // Remove markdown headers
      .trim();
  }
  
  /**
   * Merge and deduplicate context
   */
  mergeContext(contexts: string[][]): string[] {
    const merged: Map<string, string> = new Map();
    
    for (const contextGroup of contexts) {
      for (const context of contextGroup) {
        // Simple deduplication based on content similarity
        const key = this.generateContextKey(context);
        if (!merged.has(key)) {
          merged.set(key, context);
        }
      }
    }
    
    return Array.from(merged.values());
  }
  
  /**
   * Generate a key for context deduplication
   */
  private generateContextKey(context: string): string {
    // Use first 100 characters as key (simple approach)
    // Could be enhanced with hashing or similarity detection
    return context.substring(0, 100).toLowerCase().replace(/\s+/g, '');
  }
  
  /**
   * Extract key points from context
   */
  async extractKeyPoints(
    context: string[],
    llmProvider: LLMProvider
  ): Promise<string[]> {
    this.emit('extraction_start', { contexts: context.length });
    
    const systemPrompt = `You are an expert at extracting key points from text. Extract the most important facts, insights, and information as bullet points.`;
    
    const keyPoints: string[] = [];
    
    for (const ctx of context) {
      const userPrompt = `Extract key points from the following text as bullet points:

${ctx}

Key points:`;
      
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];
      
      try {
        const points = await llmProvider.createChatCompletion(messages, {
          model: this.config.get('fastLLMModel'),
          temperature: 0.3,
          maxTokens: 500
        });
        
        keyPoints.push(points);
      } catch (error) {
        this.emit('extraction_error', { error });
      }
    }
    
    this.emit('extraction_complete', { 
      contexts: context.length,
      keyPoints: keyPoints.length 
    });
    
    return keyPoints;
  }
  
  /**
   * Rank context by relevance to query
   */
  rankContext(context: string[], query: string): string[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    
    const scored = context.map(ctx => ({
      content: ctx,
      score: this.calculateRelevance(ctx, queryTerms)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    
    return scored.map(item => item.content);
  }
  
  /**
   * Split context into manageable chunks
   */
  splitIntoChunks(text: string, maxTokensPerChunk: number = 1000): string[] {
    const chunks: string[] = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    
    let currentChunk = '';
    let currentTokens = 0;
    
    for (const sentence of sentences) {
      const sentenceTokens = estimateTokens(sentence);
      
      if (currentTokens + sentenceTokens > maxTokensPerChunk && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
        currentTokens = sentenceTokens;
      } else {
        currentChunk += ' ' + sentence;
        currentTokens += sentenceTokens;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  /**
   * Get context statistics
   */
  getStats(): {
    totalContextItems: number;
    totalTokens: number;
    averageRelevance: number;
    compressionRatio: number;
  } {
    const contexts = this.memory.getContext();
    const totalTokens = contexts.reduce((sum, ctx) => sum + estimateTokens(ctx), 0);
    
    return {
      totalContextItems: contexts.length,
      totalTokens,
      averageRelevance: 0, // Would need to track this
      compressionRatio: this.compressionRatio
    };
  }
  
  /**
   * Clear context from memory
   */
  clearContext(): void {
    this.memory.clearContext();
    this.emit('context_cleared');
  }
  
  /**
   * Set maximum context tokens
   */
  setMaxTokens(maxTokens: number): void {
    this.maxContextTokens = maxTokens;
  }
  
  /**
   * Set compression ratio
   */
  setCompressionRatio(ratio: number): void {
    this.compressionRatio = Math.max(0.1, Math.min(1.0, ratio));
  }
}
