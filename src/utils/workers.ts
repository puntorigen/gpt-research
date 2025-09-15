/**
 * Worker pool and batch processing utilities
 */

/**
 * Simple promise-based concurrency limiter (replacement for p-limit)
 */
class ConcurrencyLimiter {
  private running = 0;
  private queue: Array<() => void> = [];
  
  constructor(private concurrency: number) {}
  
  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.concurrency) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    
    this.running++;
    
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

/**
 * Worker pool for managing concurrent operations
 */
export class WorkerPool {
  private limiter: ConcurrencyLimiter;
  private activeJobs: Set<Promise<any>> = new Set();
  private completed: number = 0;
  private failed: number = 0;
  
  constructor(concurrency: number = 5) {
    this.limiter = new ConcurrencyLimiter(concurrency);
  }
  
  /**
   * Execute a function with concurrency control
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.limiter.run(async () => {
      const job = fn();
      this.activeJobs.add(job);
      
      try {
        const result = await job;
        this.completed++;
        return result;
      } catch (error) {
        this.failed++;
        throw error;
      } finally {
        this.activeJobs.delete(job);
      }
    });
  }
  
  /**
   * Execute multiple functions with concurrency control
   */
  async executeAll<T>(
    functions: Array<() => Promise<T>>
  ): Promise<T[]> {
    return Promise.all(
      functions.map(fn => this.execute(fn))
    );
  }
  
  /**
   * Execute functions and return results as they complete
   */
  async *executeStream<T>(
    functions: Array<() => Promise<T>>
  ): AsyncGenerator<{ index: number; result: T } | { index: number; error: any }> {
    const promises = functions.map((fn, index) =>
      this.execute(fn)
        .then(result => ({ index, result }))
        .catch(error => ({ index, error }))
    );
    
    for (const promise of promises) {
      const result = await promise;
      if ('error' in result) {
        yield { index: result.index, error: result.error };
      } else {
        yield { index: result.index, result: result.result };
      }
    }
  }
  
  /**
   * Wait for all active jobs to complete
   */
  async waitForAll(): Promise<void> {
    await Promise.all(Array.from(this.activeJobs));
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return {
      active: this.activeJobs.size,
      completed: this.completed,
      failed: this.failed,
      total: this.completed + this.failed + this.activeJobs.size
    };
  }
  
  /**
   * Reset statistics
   */
  reset(): void {
    this.completed = 0;
    this.failed = 0;
  }
}

/**
 * Batch processor for handling items in batches
 */
export class BatchProcessor<T, R> {
  private limiter: ConcurrencyLimiter;
  
  constructor(private concurrency: number = 3) {
    this.limiter = new ConcurrencyLimiter(concurrency);
  }
  
  /**
   * Process items in batches
   */
  async processBatch(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize?: number
  ): Promise<R[]> {
    const actualBatchSize = batchSize || this.concurrency;
    const results: R[] = [];
    
    // Process in batches
    for (let i = 0; i < items.length; i += actualBatchSize) {
      const batch = items.slice(i, i + actualBatchSize);
      const batchResults = await Promise.all(
        batch.map(item => this.limiter.run(() => processor(item)))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
  
  /**
   * Process items and yield results as they complete
   */
  async *processStream<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): AsyncGenerator<{ item: T; result: R } | { item: T; error: any }> {
    const promises = items.map((item, index) =>
      this.limiter.run(() => processor(item))
        .then(result => ({ index, item, result }))
        .catch(error => ({ index, item, error }))
    );
    
    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const value = result.value as any;
        if (value.error) {
          yield { item: value.item, error: value.error };
        } else {
          yield { item: value.item, result: value.result };
        }
      }
    }
  }
  
  /**
   * Get worker pool statistics
   */
  getStats() {
    return {
      concurrency: this.concurrency
    };
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
    onRetry?: (error: any, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    retries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    onRetry
  } = options;
  
  let lastError: any;
  let delay = initialDelay;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === retries) {
        throw error;
      }
      
      if (onRetry) {
        onRetry(error, attempt + 1);
      }
      
      await sleep(delay);
      delay = Math.min(delay * factor, maxDelay);
    }
  }
  
  throw lastError;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Throttle function calls
 */
export class Throttle {
  private lastCall: number = 0;
  
  constructor(private minInterval: number) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    
    if (timeSinceLastCall < this.minInterval) {
      await sleep(this.minInterval - timeSinceLastCall);
    }
    
    this.lastCall = Date.now();
    return fn();
  }
}

/**
 * Rate limiter with token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number = Date.now();
  
  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per second
    private refillInterval: number = 1000 // ms
  ) {
    this.tokens = maxTokens;
  }
  
  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = (timePassed / 1000) * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  
  async acquire(tokens: number = 1): Promise<void> {
    while (true) {
      this.refill();
      
      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return;
      }
      
      // Wait for refill
      const tokensNeeded = tokens - this.tokens;
      const waitTime = (tokensNeeded / this.refillRate) * 1000;
      await sleep(Math.min(waitTime, this.refillInterval));
    }
  }
  
  tryAcquire(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }
  
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Simple queue for managing async operations
 */
export class AsyncQueue<T> {
  private queue: T[] = [];
  private processing = false;
  private processor?: (item: T) => Promise<void>;
  
  constructor(processor?: (item: T) => Promise<void>) {
    this.processor = processor;
  }
  
  enqueue(item: T): void {
    this.queue.push(item);
    this.process();
  }
  
  async process(): Promise<void> {
    if (this.processing || !this.processor) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        await this.processor(item);
      } catch (error) {
        // Log error but continue processing
        console.error('Queue processing error:', error);
      }
    }
    
    this.processing = false;
  }
  
  size(): number {
    return this.queue.length;
  }
  
  clear(): void {
    this.queue = [];
  }
}

/**
 * Parallel map with concurrency control
 */
export async function parallelMap<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const pool = new WorkerPool(concurrency);
  const functions = items.map((item, index) => () => mapper(item, index));
  return pool.executeAll(functions);
}

/**
 * Execute functions in series
 */
export async function series<T>(
  functions: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];
  
  for (const fn of functions) {
    results.push(await fn());
  }
  
  return results;
}

/**
 * Execute functions in parallel with a limit
 */
export async function parallel<T>(
  functions: Array<() => Promise<T>>,
  limit: number = 5
): Promise<T[]> {
  const pool = new WorkerPool(limit);
  return pool.executeAll(functions);
}