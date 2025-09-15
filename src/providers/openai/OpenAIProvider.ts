import OpenAI from 'openai';
import { ChatMessage, ChatOptions, EmbeddingOptions } from '../../types';
import { LLMProvider, LLMProviderConfig } from '../LLMProvider';

export class OpenAIProvider extends LLMProvider {
  private client: OpenAI;
  
  constructor(config: LLMProviderConfig) {
    super(config);
    
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3
    });
  }
  
  protected initializeModelCosts(): void {
    // Costs in $ per 1000 tokens (as of 2024)
    this.modelCosts.set('gpt-4-turbo', { input: 0.01, output: 0.03 });
    this.modelCosts.set('gpt-4-turbo-preview', { input: 0.01, output: 0.03 });
    this.modelCosts.set('gpt-4', { input: 0.03, output: 0.06 });
    this.modelCosts.set('gpt-4-32k', { input: 0.06, output: 0.12 });
    this.modelCosts.set('gpt-3.5-turbo', { input: 0.0005, output: 0.0015 });
    this.modelCosts.set('gpt-3.5-turbo-16k', { input: 0.003, output: 0.004 });
    this.modelCosts.set('o1-preview', { input: 0.015, output: 0.06 });
    this.modelCosts.set('o1-mini', { input: 0.003, output: 0.012 });
    this.modelCosts.set('text-embedding-3-small', { input: 0.00002, output: 0 });
    this.modelCosts.set('text-embedding-3-large', { input: 0.00013, output: 0 });
    this.modelCosts.set('text-embedding-ada-002', { input: 0.0001, output: 0 });
  }
  
  async createChatCompletion(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<string> {
    try {
      const model = options?.model || 'gpt-3.5-turbo';
      
      // Handle reasoning models differently (o1 series)
      const isReasoningModel = model.startsWith('o1');
      
      const completionOptions: any = {
        model,
        messages: messages as any[],
        stream: false
      };
      
      // Reasoning models don't support temperature, max_tokens in the same way
      if (!isReasoningModel) {
        completionOptions.temperature = options?.temperature ?? 0.7;
        completionOptions.max_tokens = options?.maxTokens;
        completionOptions.top_p = options?.topP;
        completionOptions.frequency_penalty = options?.frequencyPenalty;
        completionOptions.presence_penalty = options?.presencePenalty;
        completionOptions.stop = options?.stop;
      } else if (options?.reasoningEffort) {
        // For o1 models, you might use different parameters
        // Note: This is hypothetical as o1 API details may vary
        (completionOptions as any).reasoning_effort = options.reasoningEffort;
      }
      
      const response = await this.retry(() => 
        this.client.chat.completions.create(completionOptions)
      );
      
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }
      
      // Emit token usage for cost tracking
      if (response.usage) {
        this.emit('usage', {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
          model
        });
      }
      
      return content;
    } catch (error) {
      return this.handleError(error);
    }
  }
  
  async *createChatCompletionStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string> {
    try {
      const model = options?.model || 'gpt-3.5-turbo';
      const isReasoningModel = model.startsWith('o1');
      
      // Reasoning models might not support streaming
      if (isReasoningModel) {
        const result = await this.createChatCompletion(messages, options);
        yield result;
        return;
      }
      
      const stream = await this.client.chat.completions.create({
        model,
        messages: messages as any[],
        stream: true,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
        stop: options?.stop
      });
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async createEmbedding(
    text: string | string[],
    options?: EmbeddingOptions
  ): Promise<number[] | number[][]> {
    try {
      const model = options?.model || 'text-embedding-3-small';
      const input = Array.isArray(text) ? text : [text];
      
      const embeddingOptions: any = {
        model,
        input
      };
      
      // Add dimensions if specified and model supports it
      if (options?.dimensions && model.includes('text-embedding-3')) {
        embeddingOptions.dimensions = options.dimensions;
      }
      
      const response = await this.retry(() =>
        this.client.embeddings.create(embeddingOptions)
      );
      
      const embeddings = response.data.map(item => item.embedding);
      
      // Emit usage for cost tracking
      if (response.usage) {
        this.emit('usage', {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: 0,
          totalTokens: response.usage.total_tokens,
          model
        });
      }
      
      return Array.isArray(text) ? embeddings : embeddings[0];
    } catch (error) {
      return this.handleError(error);
    }
  }
  
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      const models = response.data
        .filter(model => model.id.includes('gpt') || model.id.includes('embedding') || model.id.includes('o1'))
        .map(model => model.id)
        .sort();
      
      return models;
    } catch (error) {
      return this.handleError(error);
    }
  }
  
  // OpenAI-specific methods
  async createImage(
    prompt: string,
    options?: {
      model?: string;
      n?: number;
      size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
      quality?: 'standard' | 'hd';
      style?: 'vivid' | 'natural';
    }
  ): Promise<string[]> {
    try {
      const response = await this.client.images.generate({
        model: options?.model || 'dall-e-3',
        prompt,
        n: options?.n || 1,
        size: options?.size || '1024x1024',
        quality: options?.quality || 'standard',
        style: options?.style || 'vivid'
      });
      
      return response.data?.map(image => image.url || '') || [];
    } catch (error) {
      return this.handleError(error);
    }
  }
  
  async transcribeAudio(
    audioFile: Buffer | File,
    options?: {
      model?: string;
      language?: string;
      prompt?: string;
      temperature?: number;
    }
  ): Promise<string> {
    try {
      const response = await this.client.audio.transcriptions.create({
        file: audioFile as any,
        model: options?.model || 'whisper-1',
        language: options?.language,
        prompt: options?.prompt,
        temperature: options?.temperature
      });
      
      return response.text;
    } catch (error) {
      return this.handleError(error);
    }
  }
  
  async moderateContent(input: string | string[]): Promise<any> {
    try {
      const response = await this.client.moderations.create({
        input
      });
      
      return response.results;
    } catch (error) {
      return this.handleError(error);
    }
  }
}
