/**
 * Example usage of GPT Research Node.js implementation
 * This demonstrates both standard and streaming research
 */

import * as dotenv from 'dotenv';
import { 
  GPTResearch, 
  ResearchConfig, 
  ReportType, 
  Tone,
  ReportFormat,
  ReportSource
} from './src';

// Load environment variables
dotenv.config();

/**
 * Example 1: Basic Research
 */
async function basicResearch() {
  console.log('\n=== Basic Research Example ===\n');
  
  const config: ResearchConfig = {
    query: 'What are the latest advances in quantum computing in 2024?',
    reportType: ReportType.ResearchReport,
    reportFormat: ReportFormat.Markdown,
    reportSource: ReportSource.Web,
    tone: Tone.Objective,
    llmProvider: 'openai',
    smartLLMModel: 'gpt-4-turbo-preview',
    fastLLMModel: 'gpt-3.5-turbo',
    maxSearchResults: 10,
    temperature: 0.7,
    maxTokens: 3000,
    verbose: true,
    // API Keys (from environment variables)
    apiKeys: {
      openai: process.env.OPENAI_API_KEY!,
      tavily: process.env.TAVILY_API_KEY,
      serper: process.env.SERPER_API_KEY,
      google: process.env.GOOGLE_API_KEY
    }
  };
  
  try {
    const researcher = new GPTResearch(config);
    
    // Listen to events
    researcher.on('research_start', (data) => {
      console.log('📚 Research started:', data.query);
    });
    
    researcher.on('planning_complete', (data) => {
      console.log('📋 Research questions:', data.questions);
    });
    
    researcher.on('search_complete', (data) => {
      console.log('🔎 Search complete:', data.totalResults, 'results found');
    });
    
    researcher.on('curation_complete', (data) => {
      console.log('✅ Source validation:', data.curated, 'credible sources');
    });
    
    researcher.on('scraping_complete', (data) => {
      console.log('🌐 Scraping complete:', data.successful, 'pages scraped');
    });
    
    researcher.on('research_complete', (result) => {
      console.log('✨ Research complete!');
      console.log('📊 Total sources:', result.metadata?.totalSources);
      console.log('💰 Total cost: $', result.costs.total.toFixed(4));
      console.log('⏱️ Duration:', result.metadata?.duration, 'ms');
    });
    
    // Conduct research
    const result = await researcher.conductResearch();
    
    // Display report
    console.log('\n=== Generated Report ===\n');
    console.log(result.report);
    
    // Display statistics
    console.log('\n=== Research Statistics ===\n');
    console.log(researcher.getStats());
    
    // Export research data
    const exportData = researcher.exportResearch();
    console.log('\n📦 Research data exported (', exportData.length, 'bytes)');
    
  } catch (error) {
    console.error('❌ Research failed:', error);
  }
}

/**
 * Example 2: Streaming Research
 */
async function streamingResearch() {
  console.log('\n=== Streaming Research Example ===\n');
  
  const config: ResearchConfig = {
    query: 'How does climate change affect global food security?',
    reportType: ReportType.DetailedReport,
    reportFormat: ReportFormat.Markdown,
    reportSource: ReportSource.Web,
    tone: Tone.Academic,
    llmProvider: 'openai',
    smartLLMModel: 'gpt-4-turbo-preview',
    fastLLMModel: 'gpt-3.5-turbo',
    maxSearchResults: 15,
    temperature: 0.6,
    maxTokens: 4000,
    verbose: false,
    apiKeys: {
      openai: process.env.OPENAI_API_KEY!,
      tavily: process.env.TAVILY_API_KEY
    }
  };
  
  try {
    const researcher = new GPTResearch(config);
    
    console.log('🔄 Starting streaming research...\n');
    
    let fullReport = '';
    
    // Stream research updates
    for await (const update of researcher.streamResearch()) {
      switch (update.type) {
        case 'progress':
          console.log(`[${update.progress}%] ${update.message}`);
          break;
          
        case 'data':
          if (update.data?.subtopics) {
            console.log('📝 Subtopics:', update.data.subtopics);
          }
          if (update.data?.sources) {
            console.log('📚 Sources found:', update.data.sources);
          }
          if (update.data?.reportChunk) {
            process.stdout.write('.');
            fullReport += update.data.reportChunk;
          }
          break;
          
        case 'complete':
          console.log('\n\n✅ Research streaming complete!');
          if (update.data?.report) {
            fullReport = update.data.report;
          }
          break;
          
        case 'error':
          console.error('❌ Error:', update.message);
          break;
      }
    }
    
    // Display final report
    console.log('\n=== Final Report ===\n');
    console.log(fullReport);
    
  } catch (error) {
    console.error('❌ Streaming research failed:', error);
  }
}

/**
 * Example 3: Quick Summary Research
 */
async function quickSummary() {
  console.log('\n=== Quick Summary Example ===\n');
  
  const config: ResearchConfig = {
    query: 'Latest developments in artificial general intelligence (AGI)',
    reportType: ReportType.QuickSummary,
    reportFormat: ReportFormat.Markdown,
    reportSource: ReportSource.Web,
    tone: Tone.Casual,
    llmProvider: 'openai',
    smartLLMModel: 'gpt-3.5-turbo',
    fastLLMModel: 'gpt-3.5-turbo',
    maxSearchResults: 5,
    temperature: 0.7,
    maxTokens: 1000,
    verbose: true,
    apiKeys: {
      openai: process.env.OPENAI_API_KEY!,
      tavily: process.env.TAVILY_API_KEY
    }
  };
  
  try {
    const researcher = new GPTResearch(config);
    
    // Quick research with minimal events
    const result = await researcher.conductResearch();
    
    console.log('\n=== Quick Summary ===\n');
    console.log(result.report);
    
    console.log('\n📊 Sources used:', result.sources.length);
    console.log('💰 Cost: $', result.costs.total.toFixed(4));
    
  } catch (error) {
    console.error('❌ Quick summary failed:', error);
  }
}

/**
 * Example 4: Custom Configuration
 */
async function customResearch() {
  console.log('\n=== Custom Research Example ===\n');
  
  const config: ResearchConfig = {
    query: 'Best practices for microservices architecture in 2024',
    reportType: ReportType.ResourceReport,
    reportFormat: ReportFormat.Markdown,
    reportSource: ReportSource.Web,
    tone: Tone.Professional,
    llmProvider: 'openai',
    smartLLMModel: 'gpt-4-turbo-preview',
    fastLLMModel: 'gpt-3.5-turbo',
    maxSearchResults: 20,
    temperature: 0.5,
    maxTokens: 5000,
    verbose: false,
    // Custom retriever preferences
    defaultRetriever: 'tavily',
    // Custom scraper preferences
    defaultScraper: 'cheerio',
    // Scraping concurrency
    scrapingConcurrency: 5,
    apiKeys: {
      openai: process.env.OPENAI_API_KEY!,
      tavily: process.env.TAVILY_API_KEY,
      serper: process.env.SERPER_API_KEY
    }
  };
  
  try {
    const researcher = new GPTResearch(config);
    
    // Custom event handling
    let searchCount = 0;
    let scrapeCount = 0;
    
    researcher.on('search_success', (data) => {
      searchCount++;
      console.log(`🔍 Search ${searchCount}: ${data.resultsCount} results from ${data.retriever}`);
    });
    
    researcher.on('url_scraped', (data) => {
      scrapeCount++;
      console.log(`📄 Scraped ${scrapeCount}: ${data.url.substring(0, 50)}...`);
    });
    
    const result = await researcher.conductResearch();
    
    console.log('\n=== Resource Report Generated ===\n');
    console.log(result.report.substring(0, 1000) + '...\n');
    
    // Get detailed statistics
    const stats = researcher.getStats();
    console.log('\n=== Detailed Statistics ===');
    console.log('Memory:', stats.memory);
    console.log('Research:', stats.research);
    console.log('Browser:', stats.browser);
    console.log('Sources:', stats.sources);
    console.log('Context:', stats.context);
    console.log('Costs:', stats.costs);
    
  } catch (error) {
    console.error('❌ Custom research failed:', error);
  }
}

/**
 * Main function to run examples
 */
async function main() {
  // Check for required environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is required in .env file');
    process.exit(1);
  }
  
  console.log('🚀 GPT Research Node.js Examples\n');
  console.log('Available API keys:');
  console.log('✓ OpenAI:', !!process.env.OPENAI_API_KEY);
  console.log('✓ Tavily:', !!process.env.TAVILY_API_KEY);
  console.log('✓ Serper:', !!process.env.SERPER_API_KEY);
  console.log('✓ Google:', !!process.env.GOOGLE_API_KEY);
  
  // Get command line argument for which example to run
  const example = process.argv[2] || 'basic';
  
  switch (example) {
    case 'basic':
      await basicResearch();
      break;
    case 'stream':
      await streamingResearch();
      break;
    case 'quick':
      await quickSummary();
      break;
    case 'custom':
      await customResearch();
      break;
    case 'all':
      await basicResearch();
      await streamingResearch();
      await quickSummary();
      await customResearch();
      break;
    default:
      console.log('Usage: npm run example [basic|stream|quick|custom|all]');
      console.log('  basic  - Basic research with events');
      console.log('  stream - Streaming research with real-time updates');
      console.log('  quick  - Quick summary research');
      console.log('  custom - Custom configuration research');
      console.log('  all    - Run all examples');
  }
}

// Run examples
main().catch(console.error);