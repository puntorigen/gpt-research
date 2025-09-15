/**
 * MCP Research Skill
 * 
 * Executes research using selected MCP tools and synthesizes results.
 * Integrates with GPT Research's existing research pipeline.
 */

import { EventEmitter } from 'events';
import { MCPClient } from './MCPClient';
import { MCPToolSelector } from './MCPToolSelector';
import { 
  MCPTool, 
  MCPToolResult, 
  MCPResearchContext,
  MCPToolInvocation 
} from './types';
import { LLMProvider } from '../providers/LLMProvider';
import { ChatMessage } from '../types';
import { ConsoleOutput } from '../utils/logger';
import { CostTracker } from '../utils/cost';

export interface MCPResearchOptions {
  maxTools?: number;
  parallelExecution?: boolean;
  synthesizeResults?: boolean;
  includeMetadata?: boolean;
  timeout?: number;
}

export class MCPResearch extends EventEmitter {
  private client: MCPClient;
  private toolSelector: MCPToolSelector;
  private llmProvider: LLMProvider;
  private costTracker: CostTracker;

  constructor(
    client: MCPClient,
    toolSelector: MCPToolSelector,
    llmProvider: LLMProvider
  ) {
    super();
    this.client = client;
    this.toolSelector = toolSelector;
    this.llmProvider = llmProvider;
    this.costTracker = new CostTracker();
  }

  /**
   * Conduct research using MCP tools
   */
  async conductResearch(
    query: string,
    options: MCPResearchOptions = {}
  ): Promise<MCPResearchContext> {
    const startTime = new Date();
    
    this.emit('research_start', { query, timestamp: startTime });
    ConsoleOutput.info(`Starting MCP research: "${query}"`);
    
    try {
      // Step 1: Get available tools
      this.emit('tools_discovery', { status: 'started' });
      const availableTools = await this.client.getAvailableTools();
      
      if (availableTools.length === 0) {
        throw new Error('No MCP tools available for research');
      }
      
      this.emit('tools_discovery', { 
        status: 'completed', 
        count: availableTools.length 
      });
      
      // Step 2: Select relevant tools
      this.emit('tools_selection', { status: 'started' });
      const selectedTools = await this.toolSelector.selectTools(
        query,
        availableTools,
        { maxTools: options.maxTools || 3 }
      );
      
      this.emit('tools_selection', { 
        status: 'completed',
        selected: selectedTools.map(t => t.name)
      });
      
      // Step 3: Execute tools
      this.emit('tools_execution', { status: 'started' });
      const results = await this.executeTools(
        query,
        selectedTools,
        options.parallelExecution !== false
      );
      
      this.emit('tools_execution', { 
        status: 'completed',
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      });
      
      // Step 4: Synthesize results (optional)
      let synthesis: string | undefined;
      
      if (options.synthesizeResults !== false && results.some(r => r.success)) {
        this.emit('synthesis', { status: 'started' });
        synthesis = await this.synthesizeResults(query, results);
        this.emit('synthesis', { status: 'completed' });
      }
      
      const endTime = new Date();
      
      // Create research context
      const context: MCPResearchContext = {
        query,
        tools: selectedTools,
        results,
        synthesis,
        metadata: options.includeMetadata ? {
          startTime,
          endTime,
          totalTools: availableTools.length,
          successfulTools: results.filter(r => r.success).length,
          failedTools: results.filter(r => !r.success).length
        } : undefined
      };
      
      this.emit('research_complete', { 
        context,
        duration: endTime.getTime() - startTime.getTime(),
        cost: this.costTracker.getTotalCost()
      });
      
      ConsoleOutput.success(`MCP research completed in ${(endTime.getTime() - startTime.getTime()) / 1000}s`);
      
      return context;
      
    } catch (error: any) {
      this.emit('research_error', { error: error.message });
      ConsoleOutput.error(`MCP research failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute selected tools to gather information
   */
  private async executeTools(
    query: string,
    tools: MCPTool[],
    parallel: boolean = true
  ): Promise<MCPToolResult[]> {
    ConsoleOutput.info(`Executing ${tools.length} tool(s) ${parallel ? 'in parallel' : 'sequentially'}`);
    
    // Prepare invocations
    const invocations: MCPToolInvocation[] = tools.map(tool => ({
      tool: tool.name,
      server: tool.server,
      parameters: this.prepareToolParameters(query, tool),
      requestId: `${tool.name}-${Date.now()}`
    }));
    
    if (parallel) {
      // Execute all tools in parallel
      return await this.client.invokeTools(invocations);
    } else {
      // Execute tools sequentially
      const results: MCPToolResult[] = [];
      
      for (const invocation of invocations) {
        const tool = tools.find(t => t.name === invocation.tool)!;
        const result = await this.client.invokeTool(tool, invocation.parameters);
        results.push(result);
        
        // Emit progress
        this.emit('tool_completed', {
          tool: invocation.tool,
          success: result.success,
          progress: results.length / invocations.length
        });
      }
      
      return results;
    }
  }

  /**
   * Prepare parameters for a tool based on the query
   */
  private prepareToolParameters(query: string, tool: MCPTool): Record<string, any> {
    const params: Record<string, any> = {
      query,
      timestamp: new Date().toISOString()
    };
    
    // Add tool-specific parameters based on the schema
    if (tool.parameters?.properties) {
      const properties = tool.parameters.properties;
      
      // Common parameter mappings
      if ('q' in properties || 'search' in properties) {
        params.q = query;
        params.search = query;
      }
      
      if ('limit' in properties) {
        params.limit = 10; // Default limit
      }
      
      if ('format' in properties) {
        params.format = 'json'; // Default format
      }
      
      // Tool category specific parameters
      if (tool.category === 'search') {
        if ('num_results' in properties) params.num_results = 10;
        if ('include_raw' in properties) params.include_raw = false;
        if ('search_depth' in properties) params.search_depth = 'basic';
      }
      
      if (tool.category === 'analysis') {
        if ('depth' in properties) params.depth = 'detailed';
        if ('include_sources' in properties) params.include_sources = true;
      }
      
      if (tool.category === 'generation') {
        if ('style' in properties) params.style = 'informative';
        if ('length' in properties) params.length = 'medium';
      }
    }
    
    return params;
  }

  /**
   * Synthesize tool results into a coherent research summary
   */
  private async synthesizeResults(
    query: string,
    results: MCPToolResult[]
  ): Promise<string> {
    ConsoleOutput.info('Synthesizing MCP tool results...');
    
    // Filter successful results
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return 'No successful tool executions to synthesize.';
    }
    
    // Prepare synthesis prompt
    const resultsText = successfulResults.map(result => {
      const data = typeof result.data === 'string' 
        ? result.data 
        : JSON.stringify(result.data, null, 2);
      
      return `Tool: ${result.tool} (Server: ${result.server})
Result:
${data}
`;
    }).join('\n---\n');
    
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a research synthesizer. Your task is to analyze and synthesize information from multiple MCP tool results into a coherent, comprehensive summary.
Focus on answering the original research query using the provided information.
Be concise but thorough, and cite which tools provided key information.`
      },
      {
        role: 'user',
        content: `Research Query: "${query}"

Tool Results:
${resultsText}

Please synthesize these results into a comprehensive answer to the research query.`
      }
    ];
    
    try {
      const synthesis = await this.llmProvider.createChatCompletion(messages, {
        temperature: 0.7,
        maxTokens: 1000
      });
      
      // Track cost
      this.costTracker.addCost(0.002); // Approximate cost for synthesis
      
      return synthesis;
      
    } catch (error) {
      ConsoleOutput.error(`Failed to synthesize results: ${error}`);
      throw error;
    }
  }

  /**
   * Stream research updates
   */
  async *streamResearch(
    query: string,
    options: MCPResearchOptions = {}
  ): AsyncGenerator<{
    type: string;
    data: any;
  }> {
    // Setup event listeners for streaming
    const events: Array<{ type: string; data: any }> = [];
    
    const eventHandlers = {
      research_start: (data: any) => events.push({ type: 'start', data }),
      tools_discovery: (data: any) => events.push({ type: 'discovery', data }),
      tools_selection: (data: any) => events.push({ type: 'selection', data }),
      tools_execution: (data: any) => events.push({ type: 'execution', data }),
      tool_completed: (data: any) => events.push({ type: 'tool_result', data }),
      synthesis: (data: any) => events.push({ type: 'synthesis', data }),
      research_complete: (data: any) => events.push({ type: 'complete', data }),
      research_error: (data: any) => events.push({ type: 'error', data })
    };
    
    // Register event handlers
    for (const [event, handler] of Object.entries(eventHandlers)) {
      this.on(event, handler);
    }
    
    try {
      // Start research in background
      const researchPromise = this.conductResearch(query, options);
      
      // Stream events as they occur
      let lastEventIndex = 0;
      
      while (true) {
        // Check for new events
        while (lastEventIndex < events.length) {
          yield events[lastEventIndex];
          lastEventIndex++;
        }
        
        // Check if research is complete
        if (events.some(e => e.type === 'complete' || e.type === 'error')) {
          break;
        }
        
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Wait for research to complete
      await researchPromise;
      
    } finally {
      // Cleanup event handlers
      for (const event of Object.keys(eventHandlers)) {
        this.removeAllListeners(event);
      }
    }
  }

  /**
   * Get research statistics
   */
  getStats(): {
    totalCost: number;
    toolsExecuted: number;
    successRate: number;
  } {
    return {
      totalCost: this.costTracker.getTotalCost(),
      toolsExecuted: 0, // Track this in production
      successRate: 0 // Track this in production
    };
  }

  /**
   * Validate MCP configuration for research
   */
  async validateConfiguration(): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Check connection status
    const connectionStatus = this.client.getConnectionStatus();
    const connectedServers = Object.entries(connectionStatus)
      .filter(([_, state]) => state === 'connected')
      .map(([server]) => server);
    
    if (connectedServers.length === 0) {
      issues.push('No MCP servers are connected');
      recommendations.push('Connect to at least one MCP server before conducting research');
    }
    
    // Check available tools
    const availableTools = await this.client.getAvailableTools();
    
    if (availableTools.length === 0) {
      issues.push('No tools available from connected MCP servers');
      recommendations.push('Ensure MCP servers expose tools for research');
    }
    
    // Check tool categories
    const categories = new Set(availableTools.map(t => t.category).filter(Boolean));
    
    if (!categories.has('search')) {
      recommendations.push('Consider adding MCP servers with search tools for better research');
    }
    
    if (!categories.has('analysis')) {
      recommendations.push('Consider adding MCP servers with analysis tools for deeper insights');
    }
    
    // Check for Vercel environment
    const isVercel = process.env.VERCEL === '1';
    
    if (isVercel) {
      const hasHttpServers = Object.values(connectionStatus).some(
        state => state === 'connected'
      );
      
      if (!hasHttpServers) {
        issues.push('No HTTP/WebSocket MCP servers configured for Vercel environment');
        recommendations.push('Use HTTP or WebSocket MCP servers on Vercel, or deploy a proxy server for stdio connections');
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      recommendations
    };
  }
}
