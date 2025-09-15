/**
 * MCP Tool Selector
 * 
 * Intelligently selects relevant MCP tools for a given research query
 * using LLM analysis with fallback pattern matching.
 */

import { MCPTool } from './types';
import { LLMProvider } from '../providers/LLMProvider';
import { ChatMessage } from '../types';
import { ConsoleOutput } from '../utils/logger';

export interface ToolSelectionOptions {
  maxTools?: number;
  strategy?: 'llm' | 'pattern' | 'hybrid';
  categories?: string[];
  preferredServers?: string[];
}

export class MCPToolSelector {
  private llmProvider: LLMProvider;
  private maxTools: number = 3;
  private selectionStrategy: 'llm' | 'pattern' | 'hybrid' = 'hybrid';

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * Select the most relevant tools for a research query
   */
  async selectTools(
    query: string,
    availableTools: MCPTool[],
    options: ToolSelectionOptions = {}
  ): Promise<MCPTool[]> {
    const maxTools = options.maxTools || this.maxTools;
    const strategy = options.strategy || this.selectionStrategy;
    
    if (availableTools.length === 0) {
      ConsoleOutput.warning('No MCP tools available for selection');
      return [];
    }
    
    if (availableTools.length <= maxTools) {
      ConsoleOutput.info(`Using all ${availableTools.length} available tools`);
      return availableTools;
    }
    
    ConsoleOutput.info(`Selecting up to ${maxTools} tools from ${availableTools.length} available`);
    
    let selectedTools: MCPTool[] = [];
    
    switch (strategy) {
      case 'llm':
        selectedTools = await this.selectWithLLM(query, availableTools, maxTools, options);
        break;
        
      case 'pattern':
        selectedTools = this.selectWithPatternMatching(query, availableTools, maxTools, options);
        break;
        
      case 'hybrid':
        // Try LLM first, fall back to pattern matching if it fails
        try {
          selectedTools = await this.selectWithLLM(query, availableTools, maxTools, options);
        } catch (error) {
          ConsoleOutput.warning(`LLM selection failed, using pattern matching: ${error}`);
          selectedTools = this.selectWithPatternMatching(query, availableTools, maxTools, options);
        }
        break;
    }
    
    ConsoleOutput.success(`Selected ${selectedTools.length} tool(s): ${selectedTools.map(t => t.name).join(', ')}`);
    return selectedTools;
  }

  /**
   * Use LLM to intelligently select tools
   */
  private async selectWithLLM(
    query: string,
    tools: MCPTool[],
    maxTools: number,
    options: ToolSelectionOptions
  ): Promise<MCPTool[]> {
    const prompt = this.buildSelectionPrompt(query, tools, maxTools, options);
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert at selecting the most relevant tools for research queries.
Your task is to analyze the available tools and select the ones that would be most helpful for answering the given query.
Respond with a JSON array of tool names only.`
      },
      {
        role: 'user',
        content: prompt
      }
    ];
    
    try {
      const response = await this.llmProvider.createChatCompletion(messages, {
        temperature: 0.3,
        maxTokens: 200
      });
      
      return this.parseSelectedTools(response, tools);
      
    } catch (error) {
      ConsoleOutput.error(`LLM tool selection failed: ${error}`);
      throw error;
    }
  }

  /**
   * Build prompt for LLM tool selection
   */
  private buildSelectionPrompt(
    query: string,
    tools: MCPTool[],
    maxTools: number,
    options: ToolSelectionOptions
  ): string {
    const toolDescriptions = tools.map(tool => {
      const category = tool.category ? ` [${tool.category}]` : '';
      const server = ` (${tool.server})`;
      return `- ${tool.name}${category}${server}: ${tool.description}`;
    }).join('\n');
    
    let constraints = `Select up to ${maxTools} most relevant tools.`;
    
    if (options.categories && options.categories.length > 0) {
      constraints += `\nPrefer tools from categories: ${options.categories.join(', ')}`;
    }
    
    if (options.preferredServers && options.preferredServers.length > 0) {
      constraints += `\nPrefer tools from servers: ${options.preferredServers.join(', ')}`;
    }
    
    return `Research Query: "${query}"

Available Tools:
${toolDescriptions}

Constraints:
${constraints}

Select the most relevant tools for this research query.
Respond with a JSON array containing only the tool names.

Example response: ["tool1", "tool2", "tool3"]`;
  }

  /**
   * Parse LLM response to extract selected tool names
   */
  private parseSelectedTools(response: string, availableTools: MCPTool[]): MCPTool[] {
    try {
      // Try to extract JSON array from response
      const jsonMatch = response.match(/\[.*?\]/s);
      
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      
      const selectedNames: string[] = JSON.parse(jsonMatch[0]);
      
      // Map names to tool objects
      const selectedTools = selectedNames
        .map(name => availableTools.find(t => t.name === name))
        .filter((tool): tool is MCPTool => tool !== undefined);
      
      if (selectedTools.length === 0) {
        throw new Error('No valid tools found in LLM response');
      }
      
      return selectedTools;
      
    } catch (error) {
      ConsoleOutput.error(`Failed to parse LLM tool selection: ${error}`);
      throw error;
    }
  }

  /**
   * Select tools using pattern matching and heuristics
   */
  private selectWithPatternMatching(
    query: string,
    tools: MCPTool[],
    maxTools: number,
    options: ToolSelectionOptions
  ): MCPTool[] {
    const queryLower = query.toLowerCase();
    const scoredTools: { tool: MCPTool; score: number }[] = [];
    
    for (const tool of tools) {
      let score = 0;
      
      // Score based on name match
      const nameLower = tool.name.toLowerCase();
      if (queryLower.includes(nameLower) || nameLower.includes(queryLower)) {
        score += 10;
      }
      
      // Score based on description match
      const descLower = tool.description.toLowerCase();
      const queryWords = queryLower.split(/\s+/);
      
      for (const word of queryWords) {
        if (word.length > 3 && descLower.includes(word)) {
          score += 2;
        }
      }
      
      // Score based on category preference
      if (options.categories && tool.category) {
        if (options.categories.includes(tool.category)) {
          score += 5;
        }
      }
      
      // Score based on server preference
      if (options.preferredServers) {
        if (options.preferredServers.includes(tool.server)) {
          score += 3;
        }
      }
      
      // Category-based heuristics
      if (tool.category) {
        if (tool.category === 'search' && queryLower.includes('search')) score += 5;
        if (tool.category === 'search' && queryLower.includes('find')) score += 5;
        if (tool.category === 'analysis' && queryLower.includes('analyze')) score += 5;
        if (tool.category === 'analysis' && queryLower.includes('compare')) score += 5;
        if (tool.category === 'generation' && queryLower.includes('generate')) score += 5;
        if (tool.category === 'generation' && queryLower.includes('create')) score += 5;
      }
      
      // Keyword matching for common research queries
      const researchKeywords = [
        'latest', 'recent', 'news', 'current', 'update', 'trend',
        'research', 'study', 'paper', 'article', 'publication',
        'code', 'implementation', 'example', 'tutorial', 'guide',
        'data', 'statistics', 'analysis', 'report', 'summary'
      ];
      
      for (const keyword of researchKeywords) {
        if (queryLower.includes(keyword) && descLower.includes(keyword)) {
          score += 3;
        }
      }
      
      if (score > 0) {
        scoredTools.push({ tool, score });
      }
    }
    
    // Sort by score and return top N
    scoredTools.sort((a, b) => b.score - a.score);
    
    const selected = scoredTools.slice(0, maxTools).map(item => item.tool);
    
    // If no tools matched, return the first N tools as fallback
    if (selected.length === 0) {
      ConsoleOutput.warning('No tools matched query patterns, using first available tools');
      return tools.slice(0, maxTools);
    }
    
    return selected;
  }

  /**
   * Analyze tool selection effectiveness
   */
  analyzeSelection(
    query: string,
    selectedTools: MCPTool[],
    _results?: any[]
  ): {
    coverage: number;
    relevance: number;
    diversity: number;
    recommendation?: string;
  } {
    // Calculate coverage (how many aspects of the query are covered)
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const toolDescriptions = selectedTools.map(t => 
      `${t.name} ${t.description}`.toLowerCase()
    ).join(' ');
    
    const coveredWords = queryWords.filter(word => toolDescriptions.includes(word));
    const coverage = queryWords.length > 0 ? coveredWords.length / queryWords.length : 0;
    
    // Calculate relevance (based on category distribution)
    const categories = new Set(selectedTools.map(t => t.category).filter(Boolean));
    const relevance = categories.size / Math.max(selectedTools.length, 1);
    
    // Calculate diversity (different servers)
    const servers = new Set(selectedTools.map(t => t.server));
    const diversity = servers.size / Math.max(selectedTools.length, 1);
    
    // Generate recommendation
    let recommendation: string | undefined;
    
    if (coverage < 0.3) {
      recommendation = 'Consider adding more search-oriented tools';
    } else if (relevance < 0.5) {
      recommendation = 'Tools may be too similar, consider more diverse selection';
    } else if (diversity < 0.5) {
      recommendation = 'Consider using tools from different MCP servers';
    }
    
    return {
      coverage: Math.round(coverage * 100) / 100,
      relevance: Math.round(relevance * 100) / 100,
      diversity: Math.round(diversity * 100) / 100,
      recommendation
    };
  }

  /**
   * Update selection parameters
   */
  configure(options: {
    maxTools?: number;
    strategy?: 'llm' | 'pattern' | 'hybrid';
  }): void {
    if (options.maxTools !== undefined) {
      this.maxTools = options.maxTools;
    }
    if (options.strategy !== undefined) {
      this.selectionStrategy = options.strategy;
    }
    
    ConsoleOutput.info(`Tool selector configured: maxTools=${this.maxTools}, strategy=${this.selectionStrategy}`);
  }
}
