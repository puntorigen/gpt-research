/**
 * Streaming utilities for handling real-time data
 */

/**
 * Parse Server-Sent Events stream
 */
export function parseSSEStream(data: string): string[] {
  const lines = data.split('\n');
  const messages: string[] = [];
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const content = line.slice(6);
      if (content && content !== '[DONE]') {
        messages.push(content);
      }
    }
  }
  
  return messages;
}

/**
 * Stream processor for handling chunked data
 */
export class StreamProcessor {
  private buffer: string = '';
  private decoder = new TextDecoder();
  
  /**
   * Process a chunk of data
   */
  processChunk(chunk: Uint8Array): string[] {
    const text = this.decoder.decode(chunk, { stream: true });
    this.buffer += text;
    
    const messages: string[] = [];
    const lines = this.buffer.split('\n');
    
    // Keep the last incomplete line in buffer
    this.buffer = lines[lines.length - 1];
    
    // Process complete lines
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line.startsWith('data: ')) {
        const content = line.slice(6);
        if (content && content !== '[DONE]') {
          messages.push(content);
        }
      }
    }
    
    return messages;
  }
  
  /**
   * Get any remaining buffered data
   */
  flush(): string[] {
    const messages: string[] = [];
    if (this.buffer.trim().startsWith('data: ')) {
      const content = this.buffer.trim().slice(6);
      if (content && content !== '[DONE]') {
        messages.push(content);
      }
    }
    this.buffer = '';
    return messages;
  }
  
  /**
   * Reset the processor
   */
  reset(): void {
    this.buffer = '';
  }
}

/**
 * Create a readable stream from async generator
 */
export function createReadableStream<T>(
  generator: AsyncGenerator<T>
): ReadableStream<T> {
  return new ReadableStream<T>({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(chunk);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

/**
 * Convert async iterator to array
 */
export async function iteratorToArray<T>(
  iterator: AsyncIterator<T>
): Promise<T[]> {
  const result: T[] = [];
  let next = await iterator.next();
  
  while (!next.done) {
    result.push(next.value);
    next = await iterator.next();
  }
  
  return result;
}

/**
 * Merge multiple async iterators
 */
export async function* mergeAsyncIterators<T>(
  ...iterators: AsyncIterator<T>[]
): AsyncGenerator<T> {
  const promises = iterators.map((it, index) => 
    it.next().then(result => ({ index, result }))
  );
  
  const pending = new Set(iterators.map((_, index) => index));
  
  while (pending.size > 0) {
    const { index, result } = await Promise.race(
      Array.from(pending).map(i => promises[i])
    );
    
    if (result.done) {
      pending.delete(index);
    } else {
      yield result.value;
      promises[index] = iterators[index]
        .next()
        .then(result => ({ index, result }));
    }
  }
}

/**
 * Transform stream with backpressure support
 */
export class TransformStream<T, R> {
  // private queue: R[] = []; // Reserved for future use
  // private processing = false; // Reserved for future use
  private transformer: (value: T) => Promise<R> | R;
  
  constructor(transformer: (value: T) => Promise<R> | R) {
    this.transformer = transformer;
  }
  
  async *transform(source: AsyncIterable<T>): AsyncGenerator<R> {
    for await (const value of source) {
      const result = await this.transformer(value);
      yield result;
    }
  }
}

/**
 * Batch stream items
 */
export async function* batchStream<T>(
  source: AsyncIterable<T>,
  batchSize: number
): AsyncGenerator<T[]> {
  let batch: T[] = [];
  
  for await (const item of source) {
    batch.push(item);
    
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    yield batch;
  }
}

/**
 * Rate limit stream
 */
export async function* rateLimitStream<T>(
  source: AsyncIterable<T>,
  itemsPerSecond: number
): AsyncGenerator<T> {
  const delay = 1000 / itemsPerSecond;
  let lastEmit = 0;
  
  for await (const item of source) {
    const now = Date.now();
    const timeSinceLastEmit = now - lastEmit;
    
    if (timeSinceLastEmit < delay) {
      await new Promise(resolve => 
        setTimeout(resolve, delay - timeSinceLastEmit)
      );
    }
    
    lastEmit = Date.now();
    yield item;
  }
}

/**
 * Filter stream
 */
export async function* filterStream<T>(
  source: AsyncIterable<T>,
  predicate: (value: T) => boolean | Promise<boolean>
): AsyncGenerator<T> {
  for await (const item of source) {
    if (await predicate(item)) {
      yield item;
    }
  }
}

/**
 * Map stream
 */
export async function* mapStream<T, R>(
  source: AsyncIterable<T>,
  mapper: (value: T) => R | Promise<R>
): AsyncGenerator<R> {
  for await (const item of source) {
    yield await mapper(item);
  }
}

/**
 * Reduce stream
 */
export async function reduceStream<T, R>(
  source: AsyncIterable<T>,
  reducer: (acc: R, value: T) => R | Promise<R>,
  initialValue: R
): Promise<R> {
  let accumulator = initialValue;
  
  for await (const item of source) {
    accumulator = await reducer(accumulator, item);
  }
  
  return accumulator;
}

/**
 * Timeout for async iterators
 */
export async function* timeoutStream<T>(
  source: AsyncIterable<T>,
  timeout: number
): AsyncGenerator<T> {
  for await (const item of source) {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Stream timeout')), timeout)
    );
    
    yield await Promise.race([
      Promise.resolve(item),
      timeoutPromise
    ]);
  }
}

/**
 * Buffer stream items
 */
export class StreamBuffer<T> {
  private buffer: T[] = [];
  private maxSize: number;
  
  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }
  
  push(item: T): void {
    this.buffer.push(item);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }
  
  getAll(): T[] {
    return [...this.buffer];
  }
  
  getLast(n: number): T[] {
    return this.buffer.slice(-n);
  }
  
  clear(): void {
    this.buffer = [];
  }
  
  get size(): number {
    return this.buffer.length;
  }
}

/**
 * Progress tracking for long-running operations
 */
export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  eta?: number;
}

export class ProgressTracker {
  private current: number = 0;
  private total: number;
  private startTime: number;
  private lastUpdate: number = 0;
  private onProgress?: (progress: ProgressInfo) => void;
  
  constructor(total: number, onProgress?: (progress: ProgressInfo) => void) {
    this.total = total;
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
    this.onProgress = onProgress;
  }
  
  update(current: number, message?: string): void {
    this.current = current;
    const now = Date.now();
    
    const progress: ProgressInfo = {
      current: this.current,
      total: this.total,
      percentage: (this.current / this.total) * 100,
      message
    };
    
    // Calculate ETA
    if (this.current > 0) {
      const elapsed = now - this.startTime;
      const rate = this.current / elapsed;
      const remaining = this.total - this.current;
      progress.eta = remaining / rate;
    }
    
    this.lastUpdate = now;
    
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }
  
  updateProgress(percentage: number, message?: string): void {
    const current = Math.round((percentage / 100) * this.total);
    this.update(current, message);
  }
  
  increment(message?: string): void {
    this.update(this.current + 1, message);
  }
  
  reset(): void {
    this.current = 0;
    this.startTime = Date.now();
    this.lastUpdate = this.startTime;
  }
  
  getProgress(): ProgressInfo {
    return {
      current: this.current,
      total: this.total,
      percentage: (this.current / this.total) * 100
    };
  }
  
  getLastUpdate(): number {
    return this.lastUpdate;
  }
}