// Export all retrievers
export { BaseRetriever, RetrieverConfig, RetrieverFactory } from './BaseRetriever';
export { TavilyRetriever } from './TavilyRetriever';
export { SerperRetriever } from './SerperRetriever';
export { GoogleRetriever } from './GoogleRetriever';

// Register retrievers with factory
import { RetrieverFactory } from './BaseRetriever';
import { TavilyRetriever } from './TavilyRetriever';
import { SerperRetriever } from './SerperRetriever';
import { GoogleRetriever } from './GoogleRetriever';

// Register all retrievers
RetrieverFactory.register('tavily', TavilyRetriever);
RetrieverFactory.register('serper', SerperRetriever);
RetrieverFactory.register('google', GoogleRetriever);

// Helper function to create a retriever
export function createRetriever(
  name: string,
  apiKey?: string,
  config?: any
): any {
  return RetrieverFactory.create(name, {
    apiKey,
    ...config
  });
}
