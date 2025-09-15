import { EventEmitter } from 'events';
import { Config, ConfigOptions } from './Config';
import { Memory } from './Memory';
import { LLMProvider, LLMProviderFactory } from '../providers/LLMProvider';
import { OpenAIProvider } from '../providers/openai/OpenAIProvider';
import { 
  ResearchConfig, 
  ResearchResult, 
  ResearchContext,
  SearchResult,
  StreamUpdate,
  ReportType
} from '../types';
import {
  ResearchConductor,
  ReportGenerator,
  ContextManager,
  BrowserManager,
  SourceCurator
} from '../skills';
import { ConsoleOutput } from '../utils/logger';
import { CostTracker } from '../utils/cost';
import { ProgressTracker } from '../utils/stream';

// Register providers
LLMProviderFactory.register('openai', OpenAIProvider);

export class GPTResearch extends EventEmitter {
  private config: Config;
  private memory: Memory;
  private llmProvider: LLMProvider;
  private researchConductor: ResearchConductor;
  private reportGenerator: ReportGenerator;
  private contextManager: ContextManager;
  private browserManager: BrowserManager;
  private sourceCurator: SourceCurator;
  private costTracker: CostTracker;
  private progressTracker: ProgressTracker;
  // Logger is ConsoleOutput (static class)
  private startTime: Date;
  private totalCost: number = 0;
  private tokensUsed: number = 0;
  
  constructor(config: ResearchConfig) {
    super();
    
    this.config = Config.getInstance(config as ConfigOptions);
    this.memory = new Memory();
    this.startTime = new Date();
    
    // Initialize LLM provider
    const providerName = this.config.get('llmProvider') || 'openai';
    const apiKey = this.config.getApiKey(providerName);
    
    if (!apiKey) {
      throw new Error(`API key not found for provider: ${providerName}`);
    }
    
    this.llmProvider = LLMProviderFactory.create(providerName, {
      apiKey,
      baseURL: this.config.get('baseURL' as any)
    });
    
    // Initialize skills
    this.researchConductor = new ResearchConductor(this.config, this.memory);
    this.reportGenerator = new ReportGenerator(this.config, this.memory);
    this.contextManager = new ContextManager(this.config, this.memory);
    this.browserManager = new BrowserManager(this.config, this.memory);
    this.sourceCurator = new SourceCurator(this.config, this.memory);
    
    // Initialize utilities
    this.costTracker = new CostTracker();
    this.progressTracker = new ProgressTracker(100);
    // Logger is already assigned as static class
    
    // Setup event handling
    this.setupEventHandlers();
    this.setupEventForwarding();
  }
  
  /**
   * Main method to conduct research
   */
  async conductResearch(): Promise<ResearchResult> {
    const startTime = Date.now();
    
    try {
      // Validate configuration
      this.config.validateRequired();
      
      const query = this.config.get('query');
      if (!query) {
        throw new Error('Research query is required');
      }
      
      this.emit('research_start', { query });
      ConsoleOutput.info(`🔍 Starting research on: "${query}"`);
      
      // Step 1: Plan research outline
      this.progressTracker.update(10, 'Planning research outline...');
      this.emitProgress('Planning research outline', 10);
      const researchQuestions = await this.researchConductor.planResearchOutline(
        query,
        this.llmProvider
      );
      ConsoleOutput.info(`📋 Generated ${researchQuestions.length} research questions`);
      
      // Step 2: Search for information
      this.progressTracker.update(20, 'Searching for information...');
      this.emitProgress('Searching for information', 20);
      const searchResults = await this.researchConductor.searchInformation(
        researchQuestions
      );
      ConsoleOutput.info(`🔎 Found ${searchResults.length} search results`);
      
      // Step 3: Curate and validate sources
      this.progressTracker.update(30, 'Validating sources...');
      this.emitProgress('Validating sources', 30);
      const curatedResults = await this.sourceCurator.curateSearchResults(
        searchResults,
        {
          minCredibilityScore: 30,
          requireHttps: false,
          maxAge: 365 // 1 year
        }
      );
      ConsoleOutput.info(`✅ Validated ${curatedResults.length} credible sources`);
      
      // Step 4: Scrape relevant pages
      this.progressTracker.update(40, 'Scraping web content...');
      this.emitProgress('Processing sources', 40);
      const scrapedResults = await this.browserManager.scrapeSearchResults(
        curatedResults.slice(0, 10), // Limit to top 10 for performance
        {
          maxConcurrency: 3,
          useReadability: true
        }
      );
      ConsoleOutput.info(`🌐 Scraped ${scrapedResults.filter(r => !r.error).length} pages`);
      
      // Step 5: Build context
      this.progressTracker.update(60, 'Building context...');
      this.emitProgress('Building research context', 60);
      const sources = scrapedResults
        .filter(r => !r.error)
        .map(r => ({ url: r.url, content: r.content }));
      
      const contextData = await this.contextManager.buildContext(
        sources,
        this.llmProvider
      );
      ConsoleOutput.info(`📚 Built context from ${contextData.length} sources`);
      
      // Step 6: Create research context
      const researchContext: ResearchContext = {
        query,
        reportType: this.config.get('reportType') || ReportType.ResearchReport,
        findings: contextData,
        sources: curatedResults,
        subtopics: researchQuestions
      };
      
      // Step 7: Generate report
      this.progressTracker.update(80, 'Generating report...');
      this.emitProgress('Writing report', 80);
      const report = await this.reportGenerator.generateReport(
        researchContext,
        this.llmProvider
      );
      ConsoleOutput.success(`📄 Report generated successfully!`);
      
      // Step 8: Add references
      this.emitProgress('Adding references', 90);
      const finalReport = this.addReferences(report, curatedResults);
      
      // Step 9: Complete
      const duration = Date.now() - startTime;
      this.progressTracker.update(100, 'Research complete!');
      this.emitProgress('Research complete', 100);
      
      const result: ResearchResult = {
        report: finalReport,
        sources: curatedResults,
        subtopics: researchQuestions,
        context: contextData,
        costs: {
          total: this.totalCost,
          breakdown: {
            llm: this.totalCost
          }
        },
        metadata: {
          startTime: this.startTime,
          endTime: new Date(),
          tokensUsed: this.tokensUsed,
          queriesRun: this.memory.getStats().searchQueries
        }
      };
      
      // Store in memory
      this.memory.addReport('final', finalReport);
      
      this.emit('research_complete', result);
      ConsoleOutput.info(`✨ Research completed in ${(duration / 1000).toFixed(2)} seconds`);
      
      return result;
      
    } catch (error: any) {
      this.emit('research_error', { error });
      ConsoleOutput.error(`Research failed: ${error.message}`);
      throw error;
    } finally {
      // Cleanup
      await this.browserManager.cleanup();
    }
  }
  
  /**
   * Write a report based on the research conducted
   */
  async writeReport(context?: ResearchContext): Promise<string> {
    if (!context) {
      // Use existing memory if no context provided
      context = {
        query: this.config.get('query'),
        reportType: this.config.get('reportType'),
        findings: this.memory.getContext(),
        sources: this.memory.getSearchResults(),
        subtopics: this.memory.getSubtopics()
      };
    }
    
    try {
      this.emit('report_start', { query: context.query });
      
      const report = await this.reportGenerator.generateReport(
        context,
        this.llmProvider
      );
      
      this.emit('report_complete', { report });
      return report;
      
    } catch (error) {
      this.emit('report_error', { error });
      throw error;
    }
  }
  
  /**
   * Stream research updates
   */
  async *streamResearch(): AsyncGenerator<StreamUpdate> {
    // const startTime = Date.now(); // Not used in streaming
    
    try {
      const query = this.config.get('query');
      if (!query) {
        throw new Error('Research query is required');
      }
      
      // Yield start event
      yield {
        type: 'progress',
        message: 'Starting research',
        progress: 0
      };
      
      // Step 1: Plan research
      yield {
        type: 'progress',
        message: 'Planning research outline',
        progress: 10
      };
      
      const researchQuestions = await this.researchConductor.planResearchOutline(
        query,
        this.llmProvider
      );
      
      yield {
        type: 'data',
        data: { subtopics: researchQuestions }
      };
      
      // Step 2: Search
      yield {
        type: 'progress',
        message: 'Searching for information',
        progress: 20
      };
      
      const searchResults = await this.researchConductor.searchInformation(
        researchQuestions
      );
      
      yield {
        type: 'data',
        data: { sources: searchResults.length }
      };
      
      // Step 3: Validate sources
      yield {
        type: 'progress',
        message: 'Validating sources',
        progress: 30
      };
      
      const curatedResults = await this.sourceCurator.curateSearchResults(
        searchResults,
        {
          minCredibilityScore: 30,
          requireHttps: false,
          maxAge: 365
        }
      );
      
      // Step 4: Scrape
      yield {
        type: 'progress',
        message: 'Processing sources',
        progress: 40
      };
      
      const scrapedResults = await this.browserManager.scrapeSearchResults(
        curatedResults.slice(0, 10),
        {
          maxConcurrency: 3,
          useReadability: true
        }
      );
      
      // Step 5: Build context
      yield {
        type: 'progress',
        message: 'Building research context',
        progress: 60
      };
      
      const sources = scrapedResults
        .filter(r => !r.error)
        .map(r => ({ url: r.url, content: r.content }));
      
      const contextData = await this.contextManager.buildContext(
        sources,
        this.llmProvider
      );
      
      // Step 6: Generate report with streaming
      yield {
        type: 'progress',
        message: 'Writing report',
        progress: 80
      };
      
      const researchContext: ResearchContext = {
        query,
        reportType: this.config.get('reportType') || ReportType.ResearchReport,
        findings: contextData,
        sources: curatedResults,
        subtopics: researchQuestions
      };
      
      // Stream report generation
      let fullReport = '';
      for await (const chunk of this.reportGenerator.generateReportStream(
        researchContext,
        this.llmProvider
      )) {
        fullReport += chunk;
        yield {
          type: 'data',
          data: { reportChunk: chunk }
        };
      }
      
      // Add references
      yield {
        type: 'progress',
        message: 'Adding references',
        progress: 90
      };
      
      const finalReport = this.addReferences(fullReport, curatedResults);
      
      // Complete
      yield {
        type: 'complete',
        data: { report: finalReport }
      };
      
    } catch (error: any) {
      yield {
        type: 'error',
        message: error.message
      };
      throw error;
    } finally {
      await this.browserManager.cleanup();
    }
  }
  
  // Private helper methods
  
  private addReferences(report: string, sources: SearchResult[]): string {
    if (sources.length === 0) {
      return report;
    }
    
    // Check if references already exist
    if (report.toLowerCase().includes('## references')) {
      return report;
    }
    
    const references = sources
      .slice(0, 20) // Limit to 20 references
      .map((source, index) => `${index + 1}. [${source.title}](${source.url})`)
      .join('\n');
    
    return `${report}\n\n## References\n\n${references}`;
  }
  
  private emitProgress(message: string, progress: number): void {
    const update: StreamUpdate = {
      type: 'progress',
      message,
      progress
    };
    
    this.emit('progress', update);
    
    if (this.config.get('verbose')) {
      console.log(`[${progress}%] ${message}`);
    }
  }
  
  /**
   * Setup event handlers for LLM provider
   */
  private setupEventHandlers(): void {
    // Listen to provider events
    this.llmProvider.on('usage', (usage) => {
      this.tokensUsed += usage.totalTokens || 0;
      const cost = this.llmProvider.estimateCost(
        ' '.repeat(usage.inputTokens * 4),
        ' '.repeat(usage.outputTokens * 4),
        usage.model
      );
      this.totalCost += cost.totalCost;
      this.costTracker.addCost(cost.totalCost);
    });
    
    this.llmProvider.on('error', (error) => {
      this.emit('error', error);
    });
  }
  
  /**
   * Setup event forwarding from skills to main agent
   */
  private setupEventForwarding(): void {
    // Forward ResearchConductor events
    this.researchConductor.on('planning_start', (data) => 
      this.emit('planning_start', data));
    this.researchConductor.on('planning_complete', (data) => 
      this.emit('planning_complete', data));
    this.researchConductor.on('search_start', (data) => 
      this.emit('search_start', data));
    this.researchConductor.on('search_complete', (data) => 
      this.emit('search_complete', data));
    
    // Forward ReportGenerator events
    this.reportGenerator.on('report_generation_start', (data) => 
      this.emit('report_generation_start', data));
    this.reportGenerator.on('report_generation_complete', (data) => 
      this.emit('report_generation_complete', data));
    
    // Forward BrowserManager events
    this.browserManager.on('scraping_start', (data) => 
      this.emit('scraping_start', data));
    this.browserManager.on('scraping_complete', (data) => 
      this.emit('scraping_complete', data));
    
    // Forward SourceCurator events
    this.sourceCurator.on('curation_start', (data) => 
      this.emit('curation_start', data));
    this.sourceCurator.on('curation_complete', (data) => 
      this.emit('curation_complete', data));
    
    // Forward ContextManager events
    this.contextManager.on('context_building_start', (data) => 
      this.emit('context_building_start', data));
    this.contextManager.on('context_building_complete', (data) => 
      this.emit('context_building_complete', data));
  }
  
  // Public utility methods
  
  public getMemory(): Memory {
    return this.memory;
  }
  
  public getConfig(): Config {
    return this.config;
  }
  
  public getStats(): any {
    return {
      memory: this.memory.getStats(),
      research: this.researchConductor.getStats(),
      browser: this.browserManager.getStats(),
      sources: this.sourceCurator.getDomainStats(),
      context: this.contextManager.getStats(),
      costs: {
        total: this.totalCost,
        tracker: this.costTracker.getStats()
      },
      tokensUsed: this.tokensUsed,
      runtime: new Date().getTime() - this.startTime.getTime()
    };
  }
  
  /**
   * Clear all memory and reset state
   */
  public clearMemory(): void {
    this.memory.clear();
    this.contextManager.clearContext();
    this.costTracker.reset();
    this.progressTracker.reset();
  }
  
  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ResearchConfig>): void {
    Object.assign(this.config['config'], config);
  }
  
  /**
   * Get current configuration
   */
  public getCurrentConfig(): ResearchConfig {
    return this.config['config'] as ResearchConfig;
  }
  
  public exportResearch(): string {
    return JSON.stringify({
      config: this.config.getAll(),
      memory: this.memory.export(),
      stats: this.getStats()
    }, null, 2);
  }
}