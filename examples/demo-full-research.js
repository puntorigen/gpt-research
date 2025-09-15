/**
 * Full Research Demo with Tavily Web Search
 * This demonstrates complete research with real web search capabilities
 */

const { 
  GPTResearch,
  Config,
  Memory,
  ResearchConductor,
  ReportGenerator,
  ContextManager,
  BrowserManager,
  SourceCurator,
  RetrieverFactory,
  TavilyRetriever,
  LLMProviderFactory,
  OpenAIProvider,
  ReportType,
  Tone,
  ConsoleOutput
} = require('./dist');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Register providers
LLMProviderFactory.register('openai', OpenAIProvider);
RetrieverFactory.register('tavily', TavilyRetriever);

async function runFullResearch() {
  console.log('\n🌐 GPT RESEARCHER - FULL WEB RESEARCH DEMO\n');
  console.log('=' .repeat(60));
  
  // Check for API keys
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env');
    return;
  }
  if (!process.env.TAVILY_API_KEY) {
    console.error('❌ TAVILY_API_KEY not found in .env');
    return;
  }
  
  console.log('✅ OpenAI API key loaded');
  console.log('✅ Tavily API key loaded');
  console.log('\n📝 Research Query: "What are the latest developments in AI in 2024?"\n');
  
  try {
    // Initialize configuration
    const config = Config.getInstance({
      query: 'What are the latest developments in AI in 2024?',
      reportType: ReportType.DetailedReport,
      tone: Tone.Professional,
      llmProvider: 'openai',
      smartLLMModel: 'gpt-3.5-turbo',
      fastLLMModel: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1500,
      retrievers: ['tavily'],
      maxSearchResults: 5,
      apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        tavily: process.env.TAVILY_API_KEY
      }
    });
    
    const memory = new Memory();
    
    // Initialize LLM provider
    const llmProvider = LLMProviderFactory.create('openai', {
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Initialize skills
    const researchConductor = new ResearchConductor(config, memory);
    const contextManager = new ContextManager(config, memory);
    const browserManager = new BrowserManager(config, memory);
    const sourceCurator = new SourceCurator(config, memory);
    const reportGenerator = new ReportGenerator(config, memory);
    
    console.log('🔄 Starting comprehensive research process...\n');
    const startTime = Date.now();
    
    // Step 1: Plan the research
    console.log('📋 Step 1: Planning research outline...');
    const researchPlan = await researchConductor.planResearch(
      'What are the latest developments in AI in 2024?',
      llmProvider
    );
    console.log(`   ✅ Generated ${researchPlan.questions.length} research questions`);
    console.log(`   📝 Questions:`, researchPlan.questions.slice(0, 3).map(q => `\n      - ${q}`).join(''));
    
    // Step 2: Search the web
    console.log('\n🔎 Step 2: Searching the web with Tavily...');
    const searchResults = await researchConductor.conductSearch(
      researchPlan.questions,
      llmProvider
    );
    console.log(`   ✅ Found ${searchResults.totalResults} search results`);
    console.log(`   🌐 Unique URLs: ${searchResults.uniqueUrls}`);
    
    // Step 3: Build context
    console.log('\n📚 Step 3: Building research context...');
    const context = await contextManager.buildContext(
      searchResults.results,
      llmProvider
    );
    console.log(`   ✅ Built ${context.items.length} context items`);
    console.log(`   📊 Total tokens: ${context.totalTokens}`);
    
    // Step 4: Validate sources
    console.log('\n✔️  Step 4: Validating sources...');
    const validatedSources = await sourceCurator.validateSources(
      searchResults.results,
      llmProvider
    );
    console.log(`   ✅ Trusted sources: ${validatedSources.trusted.length}`);
    console.log(`   ⚠️  Blocked sources: ${validatedSources.blocked.length}`);
    
    // Step 5: Generate report
    console.log('\n✍️  Step 5: Generating comprehensive report...');
    const researchContext = {
      query: config.get('query'),
      reportType: config.get('reportType'),
      findings: context.items.map(item => item.content),
      sources: validatedSources.trusted.map(s => ({
        url: s.url,
        title: s.title,
        relevance: s.relevance
      })),
      subtopics: researchPlan.subtopics || []
    };
    
    const report = await reportGenerator.generateReport(researchContext, llmProvider);
    
    const duration = Date.now() - startTime;
    
    // Display results
    console.log('\n' + '=' .repeat(60));
    console.log('\n📄 RESEARCH REPORT:\n');
    console.log(report.substring(0, 2000)); // Show first 2000 chars
    if (report.length > 2000) {
      console.log('\n... [Report truncated for display, full length: ' + report.length + ' characters]');
    }
    
    // Show sources
    console.log('\n' + '=' .repeat(60));
    console.log('\n📚 SOURCES USED:\n');
    validatedSources.trusted.slice(0, 5).forEach((source, i) => {
      console.log(`  ${i + 1}. ${source.title}`);
      console.log(`     URL: ${source.url}`);
      console.log(`     Relevance: ${(source.relevance * 100).toFixed(0)}%`);
    });
    
    // Calculate costs
    const estimatedTokens = (researchPlan.questions.length * 100) + // Planning
                           (searchResults.totalResults * 50) + // Search processing
                           context.totalTokens + // Context
                           (report.length / 4); // Report generation
    const estimatedCost = (estimatedTokens / 1000) * 0.002; // GPT-3.5-turbo pricing
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n📊 RESEARCH STATISTICS:\n');
    console.log(`  • Research Questions: ${researchPlan.questions.length}`);
    console.log(`  • Search Results: ${searchResults.totalResults}`);
    console.log(`  • Unique URLs: ${searchResults.uniqueUrls}`);
    console.log(`  • Context Items: ${context.items.length}`);
    console.log(`  • Trusted Sources: ${validatedSources.trusted.length}`);
    console.log(`  • Report Length: ${report.length} characters`);
    console.log(`  • Total Duration: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`  • Estimated Tokens: ~${Math.round(estimatedTokens)}`);
    console.log(`  • Estimated Cost: ~$${estimatedCost.toFixed(4)}`);
    
    // Memory stats
    const memoryStats = memory.getStats();
    console.log('\n💾 Memory Statistics:');
    console.log(`  • Search Queries: ${memoryStats.searchQueries}`);
    console.log(`  • Search Results: ${memoryStats.searchResults}`);
    console.log(`  • Context Items: ${memoryStats.contextItems}`);
    console.log(`  • Subtopics: ${memoryStats.subtopics}`);
    
    console.log('\n✨ Full web research completed successfully!');
    console.log('\n🎯 This demonstrates:');
    console.log('  ✓ Real-time web search with Tavily');
    console.log('  ✓ Multi-step research workflow');
    console.log('  ✓ Source validation and curation');
    console.log('  ✓ Context building and summarization');
    console.log('  ✓ Professional report generation');
    
  } catch (error) {
    console.error('\n❌ Error during research:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\n⚠️  Authentication error - please check your API keys');
    } else if (error.message.includes('429')) {
      console.log('\n⚠️  Rate limit exceeded - please wait and try again');
    } else {
      console.log('\n💡 Debug info:', error.stack);
    }
  }
}

// Alternative: Use the high-level GPTResearch API
async function runSimpleResearch() {
  console.log('\n🚀 SIMPLE API DEMO - Using GPTResearch Class\n');
  console.log('=' .repeat(60));
  
  try {
    const researcher = new GPTResearch({
      query: 'What are the benefits of TypeScript over JavaScript?',
      reportType: ReportType.QuickSummary,
      tone: Tone.Casual,
      llmProvider: 'openai',
      smartLLMModel: 'gpt-3.5-turbo',
      retrievers: ['tavily'],
      maxSearchResults: 3,
      apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        tavily: process.env.TAVILY_API_KEY
      }
    });
    
    console.log('🔄 Conducting research with web search...\n');
    const result = await researcher.conductResearch();
    
    console.log('📄 Report:\n');
    console.log(result.report);
    
    console.log('\n📊 Summary:');
    console.log(`  • Sources found: ${result.sources.length}`);
    console.log(`  • Total cost: $${result.costs.total.toFixed(4)}`);
    console.log(`  • Duration: ${(result.metadata.duration / 1000).toFixed(2)} seconds`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🎉 GPT Research with Tavily Web Search');
  console.log('=' .repeat(60));
  
  const choice = process.argv[2] || 'full';
  
  if (choice === 'simple') {
    await runSimpleResearch();
  } else {
    await runFullResearch();
  }
  
  console.log('\n✅ Demo completed successfully!');
  console.log('\n📚 Try different modes:');
  console.log('  node demo-full-research.js       # Full detailed demo (default)');
  console.log('  node demo-full-research.js simple # Simple API demo');
}

main().catch(error => {
  console.error('\n❌ Demo failed:', error);
  process.exit(1);
});
