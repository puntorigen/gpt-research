/**
 * MCP Streamer
 * 
 * Handles streaming of MCP research updates for real-time feedback.
 * Optimized for Vercel with Server-Sent Events (SSE) support.
 */

import { EventEmitter } from 'events';
import { MCPResearchContext } from './types';

export interface StreamEvent {
  type: 'start' | 'discovery' | 'selection' | 'execution' | 'tool_result' | 
        'synthesis' | 'complete' | 'error' | 'progress' | 'log';
  timestamp: string;
  data: any;
}

export interface StreamOptions {
  format?: 'json' | 'sse' | 'ndjson';
  includeTimestamps?: boolean;
  includeProgress?: boolean;
  bufferSize?: number;
}

export class MCPStreamer extends EventEmitter {
  private buffer: StreamEvent[] = [];
  private bufferSize: number = 100;
  private format: 'json' | 'sse' | 'ndjson' = 'sse';
  private includeTimestamps: boolean = true;
  private includeProgress: boolean = true;
  private totalSteps: number = 0;
  private completedSteps: number = 0;

  constructor(options: StreamOptions = {}) {
    super();
    this.format = options.format || 'sse';
    this.includeTimestamps = options.includeTimestamps !== false;
    this.includeProgress = options.includeProgress !== false;
    this.bufferSize = options.bufferSize || 100;
  }

  /**
   * Add an event to the stream
   */
  addEvent(type: StreamEvent['type'], data: any): void {
    const event: StreamEvent = {
      type,
      timestamp: this.includeTimestamps ? new Date().toISOString() : '',
      data
    };
    
    // Add to buffer
    this.buffer.push(event);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
    
    // Update progress tracking
    if (type === 'start') {
      this.totalSteps = data.totalSteps || 5;
      this.completedSteps = 0;
    } else if (type === 'complete' || type === 'error') {
      this.completedSteps = this.totalSteps;
    } else if (['discovery', 'selection', 'execution', 'synthesis'].includes(type)) {
      if (data.status === 'completed') {
        this.completedSteps++;
      }
    }
    
    // Include progress if enabled
    if (this.includeProgress) {
      event.data.progress = {
        current: this.completedSteps,
        total: this.totalSteps,
        percentage: this.totalSteps > 0 ? Math.round((this.completedSteps / this.totalSteps) * 100) : 0
      };
    }
    
    // Emit the formatted event
    this.emit('stream', this.formatEvent(event));
  }

  /**
   * Format event based on output format
   */
  private formatEvent(event: StreamEvent): string {
    switch (this.format) {
      case 'sse':
        return this.formatSSE(event);
      case 'ndjson':
        return this.formatNDJSON(event);
      case 'json':
      default:
        return JSON.stringify(event);
    }
  }

  /**
   * Format as Server-Sent Event
   */
  private formatSSE(event: StreamEvent): string {
    const lines: string[] = [];
    
    // Add event type
    lines.push(`event: ${event.type}`);
    
    // Add ID (timestamp can serve as ID)
    if (event.timestamp) {
      lines.push(`id: ${Date.now()}`);
    }
    
    // Add data
    const dataStr = JSON.stringify(event.data);
    lines.push(`data: ${dataStr}`);
    
    // Add retry hint for reconnection
    if (event.type === 'error') {
      lines.push('retry: 3000');
    }
    
    // SSE requires double newline at the end
    return lines.join('\n') + '\n\n';
  }

  /**
   * Format as newline-delimited JSON
   */
  private formatNDJSON(event: StreamEvent): string {
    return JSON.stringify(event) + '\n';
  }

  /**
   * Create a readable stream for Node.js
   */
  createNodeStream(): NodeJS.ReadableStream {
    const { Readable } = require('stream');
    
    const stream = new Readable({
      read() {}
    });
    
    this.on('stream', (data: string) => {
      stream.push(data);
    });
    
    // End stream on completion
    this.once('complete', () => {
      stream.push(null);
    });
    
    return stream;
  }

  /**
   * Create a Web Streams API readable stream (for Vercel Edge)
   */
  createWebStream(): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let cancelled = false;
    
    return new ReadableStream({
      start: (controller) => {
        // Send initial connection event
        const connectEvent = this.formatEvent({
          type: 'start',
          timestamp: new Date().toISOString(),
          data: { message: 'Stream connected' }
        });
        controller.enqueue(encoder.encode(connectEvent));
        
        // Listen for stream events
        const handleStream = (data: string) => {
          if (!cancelled) {
            controller.enqueue(encoder.encode(data));
          }
        };
        
        this.on('stream', handleStream);
        
        // Clean up on completion
        this.once('complete', () => {
          controller.close();
          this.removeListener('stream', handleStream);
        });
        
        // Handle errors
        this.once('error', (error) => {
          controller.error(error);
          this.removeListener('stream', handleStream);
        });
      },
      
      cancel: () => {
        cancelled = true;
        this.removeAllListeners();
      }
    });
  }

  /**
   * Generate streaming response for Vercel API
   */
  createVercelResponse(): Response {
    const stream = this.createWebStream();
    
    return new Response(stream, {
      headers: {
        'Content-Type': this.format === 'sse' ? 'text/event-stream' : 'application/x-ndjson',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  /**
   * Log a message to the stream
   */
  log(level: 'info' | 'warning' | 'error' | 'success', message: string): void {
    this.addEvent('log', { level, message });
  }

  /**
   * Stream MCP research context updates
   */
  streamResearchContext(context: Partial<MCPResearchContext>): void {
    if (context.query) {
      this.addEvent('start', {
        query: context.query,
        totalSteps: 5,
        message: `Starting research: "${context.query}"`
      });
    }
    
    if (context.tools) {
      this.addEvent('selection', {
        status: 'completed',
        tools: context.tools.map(t => t.name),
        count: context.tools.length
      });
    }
    
    if (context.results) {
      const successful = context.results.filter(r => r.success);
      const failed = context.results.filter(r => !r.success);
      
      this.addEvent('execution', {
        status: 'completed',
        total: context.results.length,
        successful: successful.length,
        failed: failed.length
      });
      
      // Stream individual results
      for (const result of context.results) {
        this.addEvent('tool_result', {
          tool: result.tool,
          server: result.server,
          success: result.success,
          executionTime: result.executionTime,
          error: result.error
        });
      }
    }
    
    if (context.synthesis) {
      this.addEvent('synthesis', {
        status: 'completed',
        length: context.synthesis.length,
        preview: context.synthesis.substring(0, 200)
      });
    }
  }

  /**
   * Get buffered events
   */
  getBuffer(): StreamEvent[] {
    return [...this.buffer];
  }

  /**
   * Clear the buffer
   */
  clearBuffer(): void {
    this.buffer = [];
    this.completedSteps = 0;
    this.totalSteps = 0;
  }

  /**
   * Configure streamer options
   */
  configure(options: StreamOptions): void {
    if (options.format) this.format = options.format;
    if (options.includeTimestamps !== undefined) this.includeTimestamps = options.includeTimestamps;
    if (options.includeProgress !== undefined) this.includeProgress = options.includeProgress;
    if (options.bufferSize) this.bufferSize = options.bufferSize;
  }
}
