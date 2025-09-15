import * as dotenv from 'dotenv';
import { ResearchConfig, ReportType, ReportFormat, ReportSource, Tone } from '../types';
import * as path from 'path';
import * as fs from 'fs';

export interface ConfigOptions extends ResearchConfig {
  // Environment variables
  openaiApiKey?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
  groqApiKey?: string;
  perplexityApiKey?: string;
  togetherApiKey?: string;
  cohereApiKey?: string;
  tavilyApiKey?: string;
  serperApiKey?: string;
  serpapiApiKey?: string;
  googleCx?: string;
  bingApiKey?: string;
  
  // Vercel KV
  vercelKvUrl?: string;
  vercelKvRestApiUrl?: string;
  vercelKvRestApiToken?: string;
  vercelKvRestApiReadOnlyToken?: string;
  
  // Default models
  fastLLMModel?: string;
  smartLLMModel?: string;
  strategicLLMModel?: string;
  
  // Default settings
  defaultRetriever?: string;
  defaultScraper?: string;
}

export class Config {
  private static instance: Config;
  private config: ConfigOptions;
  
  constructor(overrides?: Partial<ConfigOptions>) {
    this.config = this.loadDefaultConfig();
    this.loadEnvironment();
    if (overrides) {
      this.applyOverrides(overrides);
    }
  }
  
  private loadDefaultConfig(): ConfigOptions {
    return {
      query: '',
      reportType: ReportType.ResearchReport,
      reportFormat: ReportFormat.Markdown,
      reportSource: ReportSource.Web,
      tone: Tone.Objective,
      maxSubtopics: 5,
      maxSearchResults: 10,
      temperature: 0.4,
      maxTokens: 4000,
      verbose: true,
      llmProvider: 'openai',
      fastLLMModel: 'gpt-3.5-turbo',
      smartLLMModel: 'gpt-4-turbo',
      strategicLLMModel: 'o1-preview',
      defaultRetriever: 'tavily',
      defaultScraper: 'cheerio',
      complementSourceUrls: false
    };
  }
  
  private loadEnvironment(): void {
    // Load .env file if it exists
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    } else {
      dotenv.config();
    }
    
    // Load API keys from environment
    this.config.openaiApiKey = process.env.OPENAI_API_KEY || this.config.openaiApiKey;
    this.config.anthropicApiKey = process.env.ANTHROPIC_API_KEY || this.config.anthropicApiKey;
    this.config.googleApiKey = process.env.GOOGLE_API_KEY || this.config.googleApiKey;
    this.config.groqApiKey = process.env.GROQ_API_KEY || this.config.groqApiKey;
    this.config.perplexityApiKey = process.env.PERPLEXITY_API_KEY || this.config.perplexityApiKey;
    this.config.togetherApiKey = process.env.TOGETHER_API_KEY || this.config.togetherApiKey;
    this.config.cohereApiKey = process.env.COHERE_API_KEY || this.config.cohereApiKey;
    
    // Search services
    this.config.tavilyApiKey = process.env.TAVILY_API_KEY || this.config.tavilyApiKey;
    this.config.serperApiKey = process.env.SERPER_API_KEY || this.config.serperApiKey;
    this.config.serpapiApiKey = process.env.SERPAPI_API_KEY || this.config.serpapiApiKey;
    this.config.googleCx = process.env.GOOGLE_CX || this.config.googleCx;
    this.config.bingApiKey = process.env.BING_API_KEY || this.config.bingApiKey;
    
    // Vercel KV
    this.config.vercelKvUrl = process.env.VERCEL_KV_URL || this.config.vercelKvUrl;
    this.config.vercelKvRestApiUrl = process.env.VERCEL_KV_REST_API_URL || this.config.vercelKvRestApiUrl;
    this.config.vercelKvRestApiToken = process.env.VERCEL_KV_REST_API_TOKEN || this.config.vercelKvRestApiToken;
    this.config.vercelKvRestApiReadOnlyToken = process.env.VERCEL_KV_REST_API_READ_ONLY_TOKEN || this.config.vercelKvRestApiReadOnlyToken;
    
    // Model configuration
    if (process.env.FAST_LLM_MODEL) {
      this.config.fastLLMModel = process.env.FAST_LLM_MODEL;
    }
    if (process.env.SMART_LLM_MODEL) {
      this.config.smartLLMModel = process.env.SMART_LLM_MODEL;
    }
    if (process.env.STRATEGIC_LLM_MODEL) {
      this.config.strategicLLMModel = process.env.STRATEGIC_LLM_MODEL;
    }
    
    // Default settings
    if (process.env.DEFAULT_RETRIEVER) {
      this.config.defaultRetriever = process.env.DEFAULT_RETRIEVER;
    }
    if (process.env.DEFAULT_SCRAPER) {
      this.config.defaultScraper = process.env.DEFAULT_SCRAPER;
    }
    if (process.env.REPORT_TYPE) {
      this.config.reportType = process.env.REPORT_TYPE as ReportType;
    }
    if (process.env.MAX_SEARCH_RESULTS) {
      this.config.maxSearchResults = parseInt(process.env.MAX_SEARCH_RESULTS, 10);
    }
    if (process.env.MAX_SUBTOPICS) {
      this.config.maxSubtopics = parseInt(process.env.MAX_SUBTOPICS, 10);
    }
    if (process.env.TEMPERATURE) {
      this.config.temperature = parseFloat(process.env.TEMPERATURE);
    }
    if (process.env.MAX_TOKENS) {
      this.config.maxTokens = parseInt(process.env.MAX_TOKENS, 10);
    }
  }
  
  private applyOverrides(overrides: Partial<ConfigOptions>): void {
    this.config = { ...this.config, ...overrides };
  }
  
  public get(key: keyof ConfigOptions): any {
    return this.config[key];
  }
  
  public getAll(): ConfigOptions {
    return { ...this.config };
  }
  
  public set(key: keyof ConfigOptions, value: any): void {
    (this.config as any)[key] = value;
  }
  
  public update(updates: Partial<ConfigOptions>): void {
    this.applyOverrides(updates);
  }
  
  public getApiKey(provider: string): string | undefined {
    const keyMap: Record<string, keyof ConfigOptions> = {
      openai: 'openaiApiKey',
      anthropic: 'anthropicApiKey',
      google: 'googleApiKey',
      groq: 'groqApiKey',
      perplexity: 'perplexityApiKey',
      together: 'togetherApiKey',
      cohere: 'cohereApiKey',
      tavily: 'tavilyApiKey',
      serper: 'serperApiKey',
      serpapi: 'serpapiApiKey',
      bing: 'bingApiKey'
    };
    
    const configKey = keyMap[provider.toLowerCase()];
    return configKey ? this.config[configKey] as string : undefined;
  }
  
  public static getInstance(overrides?: Partial<ConfigOptions>): Config {
    if (!Config.instance) {
      Config.instance = new Config(overrides);
    } else if (overrides) {
      Config.instance.update(overrides);
    }
    return Config.instance;
  }
  
  public validateRequired(): void {
    const errors: string[] = [];
    
    // Check for at least one LLM provider
    const llmProviders = [
      'openaiApiKey',
      'anthropicApiKey',
      'googleApiKey',
      'groqApiKey',
      'perplexityApiKey',
      'togetherApiKey',
      'cohereApiKey'
    ];
    
    const hasLLMProvider = llmProviders.some(key => this.config[key as keyof ConfigOptions]);
    if (!hasLLMProvider) {
      errors.push('At least one LLM provider API key is required');
    }
    
    // Check for at least one search provider
    const searchProviders = [
      'tavilyApiKey',
      'serperApiKey',
      'serpapiApiKey',
      'googleCx',
      'bingApiKey'
    ];
    
    const hasSearchProvider = searchProviders.some(key => this.config[key as keyof ConfigOptions]);
    if (!hasSearchProvider) {
      errors.push('At least one search provider API key is required');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }
}
