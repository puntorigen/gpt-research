// Main exports for GPT Research Node.js implementation

// Core
export { GPTResearch } from './core/Agent';
export { Config, ConfigOptions } from './core/Config';
export { Memory } from './core/Memory';

// Types
export {
  ResearchConfig,
  ResearchResult,
  ResearchContext,
  ResearchSection,
  ReportType,
  ReportFormat,
  ReportSource,
  Tone,
  ChatMessage,
  ChatOptions,
  EmbeddingOptions,
  SearchOptions,
  SearchResult,
  ScrapedContent,
  LLMCosts,
  StreamUpdate
} from './types';

// Providers
export { LLMProvider, LLMProviderConfig, LLMProviderFactory } from './providers/LLMProvider';
export { OpenAIProvider } from './providers/openai/OpenAIProvider';

// Retrievers
export {
  BaseRetriever,
  RetrieverConfig,
  RetrieverFactory,
  TavilyRetriever,
  SerperRetriever,
  GoogleRetriever,
  createRetriever
} from './retrievers';

// Scrapers
export {
  BaseScraper,
  ScraperConfig,
  ScraperFactory,
  CheerioScraper,
  PuppeteerScraper,
  createScraper,
  getBestScraper
} from './scrapers';

// Skills
export {
  ResearchConductor,
  ReportGenerator,
  ReportSection,
  ReportTemplate,
  ContextManager,
  ContextChunk,
  BrowserManager,
  ScrapingOptions,
  ScrapingResult,
  SourceCurator,
  SourceValidation,
  CurationCriteria
} from './skills';

// Utilities
export {
  logger,
  ConsoleOutput,
  calculateCost,
  estimateTokens,
  formatCost,
  CostTracker,
  WorkerPool,
  BatchProcessor,
  StreamProcessor,
  ProgressTracker,
  retryWithBackoff,
  sleep
} from './utils';

// MCP Components
export {
  MCPClient,
  MCPToolSelector,
  MCPResearch,
  MCPStreamer,
  MCPConfig,
  MCPTool,
  MCPToolInvocation,
  MCPToolResult,
  MCPMessage,
  MCPConnectionState,
  MCPConnection,
  MCPProxyConfig,
  MCPResearchContext,
  VercelMCPConfig,
  ToolSelectionOptions,
  MCPResearchOptions,
  StreamEvent,
  StreamOptions
} from './mcp';

// Version
export const VERSION = '0.1.0';
