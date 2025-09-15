// Core Types for GPT Research Node.js Implementation

export interface ResearchConfig {
  query: string;
  reportType?: ReportType;
  reportFormat?: ReportFormat;
  reportSource?: ReportSource;
  tone?: Tone;
  sourceUrls?: string[];
  documentUrls?: string[];
  complementSourceUrls?: boolean;
  queryDomains?: string[];
  maxSubtopics?: number;
  maxSearchResults?: number;
  verbose?: boolean;
  llmProvider?: string;
  fastLLMModel?: string;
  smartLLMModel?: string;
  strategicLLMModel?: string;
  temperature?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
}

export enum ReportType {
  ResearchReport = 'research_report',
  DetailedReport = 'detailed_report',
  QuickSummary = 'quick_summary',
  ResourceReport = 'resource_report',
  OutlineReport = 'outline_report',
  CustomReport = 'custom_report',
  SubtopicReport = 'subtopic_report',
  MultiAgentReport = 'multi_agent'
}

export enum ReportFormat {
  Markdown = 'markdown',
  PDF = 'pdf',
  Word = 'docx',
  HTML = 'html',
  JSON = 'json'
}

export enum ReportSource {
  Web = 'web',
  Local = 'local',
  Hybrid = 'hybrid',
  LangChainDocuments = 'langchain_documents'
}

export enum Tone {
  Objective = 'objective',
  Formal = 'formal',
  Academic = 'academic',
  Casual = 'casual',
  Creative = 'creative',
  Analytical = 'analytical',
  Informative = 'informative',
  Persuasive = 'persuasive',
  Explanatory = 'explanatory',
  Descriptive = 'descriptive',
  Critical = 'critical',
  Enthusiastic = 'enthusiastic',
  Neutral = 'neutral',
  Professional = 'professional',
  Humorous = 'humorous',
  Empathetic = 'empathetic',
  Authoritative = 'authoritative'
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export interface SearchOptions {
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  country?: string;
  language?: string;
  includeAnswer?: boolean;
  includeRawContent?: boolean;
  includeImages?: boolean;
  useCache?: boolean;
  days?: number;
}

export interface SearchResult {
  url: string;
  title: string;
  content: string;
  snippet?: string;
  score?: number;
  publishedDate?: string;
  author?: string;
  images?: string[];
}

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  markdown?: string;
  images?: string[];
  metadata?: Record<string, any>;
  error?: string;
}

export interface ResearchResult {
  report: string;
  sources: SearchResult[];
  subtopics?: string[];
  context?: string[];
  costs?: {
    total: number;
    breakdown: Record<string, number>;
  };
  metadata?: {
    startTime: Date;
    endTime: Date;
    tokensUsed: number;
    queriesRun: number;
  };
}

export interface ResearchContext {
  query: string;
  reportType: ReportType;
  findings: string[];
  sources: SearchResult[];
  sections?: ResearchSection[];
  subtopics?: string[];
}

export interface ResearchSection {
  title: string;
  content: string;
  sources: string[];
}

export interface LLMCosts {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  model: string;
}

export interface StreamUpdate {
  type: 'progress' | 'data' | 'error' | 'complete';
  message?: string;
  data?: any;
  progress?: number;
}
