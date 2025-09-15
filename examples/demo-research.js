/**
 * Demo: Real research with GPT Research Node.js
 * This will perform actual research using your OpenAI API key
 */

const { 
  GPTResearch, 
  ReportType, 
  Tone,
  ConsoleOutput 
} = require('./dist');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function runResearchDemo() {
  console.log('\n🔬 GPT RESEARCHER DEMO - REAL RESEARCH\n');
  console.log('=' .repeat(50));
  
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env');
    return;
  }
  
  console.log('✅ OpenAI API key loaded');
  console.log('\n📝 Research Query: "What are the key features of TypeScript?"\n');
  
  try {
    // Initialize researcher with a simple query
    const researcher = new GPTResearch({
      query: 'What are the key features of TypeScript?',
      reportType: ReportType.QuickSummary,
      tone: Tone.Professional,
      llmProvider: 'openai',
      smartLLMModel: 'gpt-3.5-turbo',  // Using 3.5 to minimize costs
      fastLLMModel: 'gpt-3.5-turbo',
      maxTokens: 500,  // Limit tokens for demo
      temperature: 0.7,
      apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        tavily: process.env.TAVILY_API_KEY  // Optional, will work without it
      }
    });
    
    // Listen to research events
    console.log('🔄 Starting research process...\n');
    
    researcher.on('planning_start', () => 
      console.log('  📋 Planning research outline...'));
    
    researcher.on('planning_complete', (data) => 
      console.log(`  ✅ Generated ${data.questions?.length || 0} research questions`));
    
    researcher.on('search_start', () => 
      console.log('  🔎 Searching for information...'));
    
    researcher.on('search_complete', (data) => 
      console.log(`  ✅ Found ${data.totalResults || 0} search results`));
    
    researcher.on('report_generation_start', () => 
      console.log('  ✍️  Generating report...'));
    
    researcher.on('report_generation_complete', () => 
      console.log('  ✅ Report generated!\n'));
    
    // Note: Without search API keys (Tavily/Serper/Google), the research will:
    // 1. Generate research questions using OpenAI
    // 2. Skip the search phase (no results)
    // 3. Generate a report based on LLM knowledge
    
    console.log('⚠️  Note: For full web search capabilities, add TAVILY_API_KEY or other search providers\n');
    console.log('🚀 Conducting research (this may take a few seconds)...\n');
    
    // Conduct the research
    const result = await researcher.conductResearch();
    
    // Display results
    console.log('=' .repeat(50));
    console.log('\n📄 RESEARCH REPORT:\n');
    console.log(result.report);
    
    console.log('\n' + '=' .repeat(50));
    console.log('\n📊 RESEARCH STATISTICS:\n');
    console.log(`  • Report Type: ${result.metadata?.reportType || 'quick_summary'}`);
    console.log(`  • Sources Found: ${result.sources.length}`);
    console.log(`  • Duration: ${result.metadata?.duration ? (result.metadata.duration / 1000).toFixed(2) : 0} seconds`);
    console.log(`  • Total Cost: $${result.costs.total.toFixed(4)}`);
    console.log(`  • Timestamp: ${result.metadata?.timestamp || new Date().toISOString()}`);
    
    if (result.sources.length === 0) {
      console.log('\n💡 Tip: Add search API keys for web-based research:');
      console.log('  • TAVILY_API_KEY - Best for AI research (https://tavily.com)');
      console.log('  • SERPER_API_KEY - Google search API (https://serper.dev)');
      console.log('  • GOOGLE_API_KEY - Google Custom Search (https://developers.google.com/custom-search)');
    }
    
    console.log('\n✨ Research completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error during research:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('  1. Verify your OPENAI_API_KEY is valid');
    console.log('  2. Check you have API credits/quota available');
    console.log('  3. Ensure you have internet connectivity');
  }
}

// Run the demo
console.log('🚀 Starting GPT Research Demo...');
runResearchDemo()
  .then(() => {
    console.log('\n✅ Demo completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('  1. Try different queries by modifying the code');
    console.log('  2. Add search API keys for web research');
    console.log('  3. Experiment with different report types and tones');
    console.log('  4. Deploy to Vercel for production use');
  })
  .catch(error => {
    console.error('\n❌ Demo failed:', error);
  });
