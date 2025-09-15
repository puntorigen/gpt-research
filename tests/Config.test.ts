import { describe, it, expect, beforeEach } from 'vitest';
import { Config } from '../src/core/Config';
import { ReportType, Tone } from '../src/types';

describe('Config', () => {
  beforeEach(() => {
    // Clear any existing instance
    (Config as any).instance = undefined;
  });

  it('should create a config instance with default values', () => {
    const config = new Config();
    
    expect(config.get('reportType')).toBe(ReportType.ResearchReport);
    expect(config.get('tone')).toBe(Tone.Objective);
    expect(config.get('maxSearchResults')).toBe(10);
    expect(config.get('maxSubtopics')).toBe(5);
    expect(config.get('temperature')).toBe(0.4);
    expect(config.get('maxTokens')).toBe(4000);
  });

  it('should apply overrides to config', () => {
    const config = new Config({
      query: 'test query',
      maxSearchResults: 20,
      temperature: 0.8,
    });
    
    expect(config.get('query')).toBe('test query');
    expect(config.get('maxSearchResults')).toBe(20);
    expect(config.get('temperature')).toBe(0.8);
  });

  it('should update config values', () => {
    const config = new Config();
    
    config.set('query', 'updated query');
    config.set('maxTokens', 8000);
    
    expect(config.get('query')).toBe('updated query');
    expect(config.get('maxTokens')).toBe(8000);
  });

  it('should get all config values', () => {
    const config = new Config({ query: 'test' });
    const allConfig = config.getAll();
    
    expect(allConfig).toHaveProperty('query', 'test');
    expect(allConfig).toHaveProperty('reportType');
    expect(allConfig).toHaveProperty('maxSearchResults');
  });

  it('should implement singleton pattern', () => {
    const config1 = Config.getInstance();
    const config2 = Config.getInstance();
    
    expect(config1).toBe(config2);
  });

  it('should update singleton instance with overrides', () => {
    const config1 = Config.getInstance({ query: 'first' });
    const config2 = Config.getInstance({ query: 'second' });
    
    expect(config1).toBe(config2);
    expect(config1.get('query')).toBe('second');
  });

  it('should get API keys for providers', () => {
    const config = new Config({
      openaiApiKey: 'test-openai-key',
      tavilyApiKey: 'test-tavily-key',
    });
    
    expect(config.getApiKey('openai')).toBe('test-openai-key');
    expect(config.getApiKey('tavily')).toBe('test-tavily-key');
    expect(config.getApiKey('unknown')).toBeUndefined();
  });

  it('should validate required configuration', () => {
    const config = new Config();
    
    // Should throw error when no API keys are set
    expect(() => config.validateRequired()).toThrow();
    
    // Should not throw when at least one LLM and search provider is set
    config.set('openaiApiKey', 'test-key');
    config.set('tavilyApiKey', 'test-key');
    
    expect(() => config.validateRequired()).not.toThrow();
  });
});
