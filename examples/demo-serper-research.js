/**
 * Serper Web Research Demo
 * Demonstrates research using Serper API for Google search results
 */

const { 
  GPTResearch,
  ReportType,
  Tone,
  ConsoleOutput
} = require('../dist');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function runSerperResearch() {
  console.log('\n🔍 GPT RESEARCHER WITH SERPER - GOOGLE SEARCH DEMO\n');
  console.log('=' .repeat(60));
  
  // Check for API keys
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env');
    console.log('\n📝 To get an OpenAI API key:');
    console.log('   1. Visit: https://platform.openai.com/api-keys');
    console.log('   2. Create a new API key');
    console.log('   3. Add to .env: OPENAI_API_KEY=sk-...');
    return;
  }
  
  if (!process.env.SERPER_API_KEY) {
    console.error('❌ SERPER_API_KEY not found in .env');
    console.log('\n📝 To get a Serper API key:');
    console.log('   1. Visit: https://serper.dev');
    console.log('   2. Sign up for a free account (2,500 free searches/month)');
    console.log('   3. Get your API key from the dashboard');
    console.log('   4. Add to .env: SERPER_API_KEY=your-key-here');
    console.log('\n💡 Serper provides Google search results via API');
    console.log('   Perfect for research that needs Google\'s search quality!');
    return;
  }
  
  console.log('✅ OpenAI API key loaded');
  console.log('✅ Serper API key loaded');
  console.log('\n📊 Serper provides access to Google search results via API');
  console.log('   Free tier: 2,500 searches/month');
  
  // Example research queries
  const queries = [
    {
      query: 'What are the latest JavaScript framework trends in 2024?',
      reportType: ReportType.QuickSummary,
      tone: Tone.Professional,
      description: 'Technical research on JavaScript ecosystem'
    },
    {
      query: 'Best practices for API security in modern applications',
      reportType: ReportType.DetailedReport,
      tone: Tone.Technical,
      description: 'In-depth security analysis'
    }
  ];
  
  console.log('\n🎯 Demo will research:');
  queries.forEach((q, i) => {
    console.log(`   ${i + 1}. ${q.query}`);
  });
  
  for (const [index, researchQuery] of queries.entries()) {
    console.log('\n' + '=' .repeat(60));
    console.log(`\n📚 Research ${index + 1}: ${researchQuery.description}\n`);
    console.log(`   Query: "${researchQuery.query}"`);
    console.log(`   Report Type: ${researchQuery.reportType}`);
    console.log(`   Tone: ${researchQuery.tone}`);
    console.log('\n🔄 Starting research with Serper (Google Search)...\n');
    
    try {
      const researcher = new GPTResearch({
        query: researchQuery.query,
        reportType: researchQuery.reportType,
        tone: researchQuery.tone,
        llmProvider: 'openai',
        smartLLMModel: 'gpt-3.5-turbo',
        fastLLMModel: 'gpt-3.5-turbo',
        retrievers: ['serper'], // Using Serper for Google search
        maxSearchResults: 8,     // Get more results from Google
        maxTokens: 1200,
        temperature: 0.7,
        scraperTimeout: 10000,
        scrapingConcurrency: 3,
        apiKeys: {
          openai: process.env.OPENAI_API_KEY,
          serper: process.env.SERPER_API_KEY
        }
      });
      
      // Track research progress
      let searchStats = { results: 0, sources: 0 };
      let scrapingStats = { pages: 0 };
      
      researcher.on('planning_start', () => 
        console.log('  📋 Planning research strategy...'));
      
      researcher.on('planning_complete', (data) => 
        console.log(`  ✅ Generated ${data.questions?.length || 0} research questions`));
      
      researcher.on('search_start', () => 
        console.log('  🔎 Searching Google via Serper API...'));
      
      researcher.on('search_complete', (data) => {
        searchStats.results = data.totalResults || 0;
        searchStats.sources = data.uniqueUrls || 0;
        console.log(`  ✅ Found ${searchStats.results} Google results from ${searchStats.sources} unique sources`);
      });
      
      researcher.on('scraping_start', () => 
        console.log('  🌐 Extracting content from web pages...'));
      
      researcher.on('scraping_complete', (data) => {
        scrapingStats.pages = data.totalPages || 0;
        console.log(`  ✅ Successfully scraped ${scrapingStats.pages} pages`);
      });
      
      researcher.on('context_building_start', () => 
        console.log('  📚 Analyzing and building context...'));
      
      researcher.on('context_building_complete', (data) => 
        console.log(`  ✅ Built research context from ${data.sources || 0} sources`));
      
      researcher.on('report_generation_start', () => 
        console.log('  ✍️  Generating comprehensive report...'));
      
      researcher.on('report_generation_complete', () => 
        console.log('  ✅ Report generated successfully!\n'));
      
      // Conduct the research
      const startTime = Date.now();
      const result = await researcher.conductResearch();
      const duration = Date.now() - startTime;
      
      // Display the report (truncated for readability)
      console.log('📄 RESEARCH REPORT:\n');
      const reportPreview = result.report.substring(0, 1000);
      console.log(reportPreview);
      if (result.report.length > 1000) {
        console.log('\n[... Report truncated, full length: ' + result.report.length + ' characters ...]');
      }
      
      // Show top Google sources found via Serper
      if (result.sources && result.sources.length > 0) {
        console.log('\n🔍 TOP GOOGLE SOURCES (via Serper):');
        result.sources.slice(0, 5).forEach((source, i) => {
          console.log(`  ${i + 1}. ${source.title || 'Untitled'}`);
          console.log(`     ${source.url}`);
          if (source.snippet) {
            console.log(`     "${source.snippet.substring(0, 100)}..."`);
          }
        });
        if (result.sources.length > 5) {
          console.log(`  ... and ${result.sources.length - 5} more sources`);
        }
      }
      
      // Research statistics
      console.log('\n📊 RESEARCH STATISTICS:');
      console.log(`  • Search Provider: Serper (Google Search API)`);
      console.log(`  • Google Results Found: ${searchStats.results}`);
      console.log(`  • Unique Sources: ${searchStats.sources}`);
      console.log(`  • Pages Scraped: ${scrapingStats.pages}`);
      console.log(`  • Report Length: ${result.report.length} characters`);
      console.log(`  • Duration: ${(duration / 1000).toFixed(2)} seconds`);
      console.log(`  • Total Cost: $${result.costs.total.toFixed(4)}`);
      console.log(`  • Model: gpt-3.5-turbo`);
      
      // Breakdown of what happened
      console.log('\n✨ Research Process:');
      console.log('  1️⃣ Generated research questions using OpenAI');
      console.log('  2️⃣ Searched Google via Serper API');
      console.log('  3️⃣ Scraped and extracted content from top results');
      console.log('  4️⃣ Built comprehensive context from sources');
      console.log('  5️⃣ Generated final report with citations');
      
      // Wait a bit between researches to avoid rate limits
      if (index < queries.length - 1) {
        console.log('\n⏳ Waiting 3 seconds before next research...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
    } catch (error) {
      console.error('\n❌ Research failed:', error.message);
      
      if (error.message.includes('401')) {
        console.log('\n⚠️  Authentication error - please check your API keys');
      } else if (error.message.includes('429')) {
        console.log('\n⚠️  Rate limit exceeded - please wait and try again');
        console.log('   Serper free tier: 2,500 searches/month');
      } else if (error.message.includes('insufficient_quota')) {
        console.log('\n⚠️  OpenAI quota exceeded - please check your account');
      }
    }
  }
  
  // Summary and comparison
  console.log('\n' + '=' .repeat(60));
  console.log('\n🎯 SERPER SEARCH DEMO COMPLETE!\n');
  console.log('📊 Serper vs Other Search Providers:\n');
  console.log('  Serper Advantages:');
  console.log('  ✅ Direct access to Google search results');
  console.log('  ✅ High-quality, relevant results');
  console.log('  ✅ Includes rich snippets and metadata');
  console.log('  ✅ 2,500 free searches per month');
  console.log('  ✅ Simple API with good documentation');
  console.log('\n  When to use Serper:');
  console.log('  • Need Google\'s search quality');
  console.log('  • Want rich snippets and descriptions');
  console.log('  • Researching mainstream topics');
  console.log('  • Need reliable, consistent results');
  
  console.log('\n💡 Tips for using Serper:');
  console.log('  1. Use specific, well-formed queries');
  console.log('  2. Leverage Google\'s search operators');
  console.log('  3. Monitor your monthly usage (2,500 free searches)');
  console.log('  4. Consider paid plans for production use');
  
  console.log('\n📚 Learn more:');
  console.log('  • Serper API Docs: https://serper.dev/docs');
  console.log('  • Pricing: https://serper.dev/pricing');
  console.log('  • Dashboard: https://serper.dev/dashboard');
}

// Alternative: Quick example function
async function quickSerperExample() {
  console.log('\n🚀 QUICK SERPER EXAMPLE\n');
  console.log('=' .repeat(60));
  
  if (!process.env.SERPER_API_KEY || !process.env.OPENAI_API_KEY) {
    console.error('❌ Missing required API keys. Please set:');
    console.log('   OPENAI_API_KEY=your-openai-key');
    console.log('   SERPER_API_KEY=your-serper-key');
    return;
  }
  
  try {
    const researcher = new GPTResearcher({
      query: 'What is WebAssembly and how is it used?',
      reportType: ReportType.QuickSummary,
      tone: Tone.Professional,
      retrievers: ['serper'],
      maxSearchResults: 5,
      apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        serper: process.env.SERPER_API_KEY
      }
    });
    
    console.log('🔄 Researching "What is WebAssembly" using Serper...\n');
    const result = await researcher.conductResearch();
    
    console.log('📄 Report:\n');
    console.log(result.report.substring(0, 800) + '...\n');
    
    console.log('📊 Quick Stats:');
    console.log(`  • Sources: ${result.sources.length}`);
    console.log(`  • Cost: $${result.costs.total.toFixed(4)}`);
    console.log(`  • Search Provider: Serper (Google)`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🎉 GPT Research with Serper (Google Search API)');
  console.log('=' .repeat(60));
  
  const mode = process.argv[2] || 'full';
  
  if (mode === 'quick') {
    await quickSerperExample();
  } else {
    await runSerperResearch();
  }
  
  console.log('\n✅ Demo completed successfully!');
  console.log('\n📚 Usage:');
  console.log('  node demo-serper-research.js       # Full demo (default)');
  console.log('  node demo-serper-research.js quick # Quick example');
}

main().catch(error => {
  console.error('\n❌ Demo failed:', error);
  process.exit(1);
});
