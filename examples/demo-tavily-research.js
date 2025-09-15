/**
 * Tavily Web Research Demo
 * Demonstrates real-time web research with Tavily API
 */

const { GPTResearch, ReportType, Tone, ConsoleOutput } = require('./dist');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function runTavilyResearch() {
  console.log('\n🌐 GPT RESEARCHER WITH TAVILY - REAL WEB SEARCH DEMO\n');
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
  
  // Research queries to demonstrate
  const queries = [
    {
      query: 'What are the latest AI breakthroughs in 2024?',
      reportType: ReportType.QuickSummary,
      tone: Tone.Professional
    },
    {
      query: 'How is AI being used in healthcare today?',
      reportType: ReportType.DetailedReport,
      tone: Tone.Academic
    }
  ];
  
  for (const [index, researchQuery] of queries.entries()) {
    console.log('\n' + '=' .repeat(60));
    console.log(`\n📚 Research ${index + 1}: ${researchQuery.query}\n`);
    console.log(`   Report Type: ${researchQuery.reportType}`);
    console.log(`   Tone: ${researchQuery.tone}`);
    console.log('\n🔄 Starting research...\n');
    
    try {
      const researcher = new GPTResearch({
        query: researchQuery.query,
        reportType: researchQuery.reportType,
        tone: researchQuery.tone,
        llmProvider: 'openai',
        smartLLMModel: 'gpt-3.5-turbo',
        fastLLMModel: 'gpt-3.5-turbo',
        retrievers: ['tavily'],
        maxSearchResults: 5,
        maxTokens: 1000,
        temperature: 0.7,
        apiKeys: {
          openai: process.env.OPENAI_API_KEY,
          tavily: process.env.TAVILY_API_KEY
        }
      });
      
      // Track research progress
      let searchComplete = false;
      let scrapingComplete = false;
      
      researcher.on('planning_start', () => 
        console.log('  📋 Planning research questions...'));
      
      researcher.on('planning_complete', (data) => 
        console.log(`  ✅ Generated ${data.questions?.length || 0} research questions`));
      
      researcher.on('search_start', () => 
        console.log('  🔎 Searching the web with Tavily...'));
      
      researcher.on('search_complete', (data) => {
        searchComplete = true;
        console.log(`  ✅ Found ${data.totalResults || 0} results from ${data.uniqueUrls || 0} unique sources`);
      });
      
      researcher.on('scraping_start', () => 
        console.log('  🌐 Scraping web pages for content...'));
      
      researcher.on('scraping_complete', (data) => {
        scrapingComplete = true;
        console.log(`  ✅ Scraped ${data.totalPages || 0} pages`);
      });
      
      researcher.on('context_building_start', () => 
        console.log('  📚 Building research context...'));
      
      researcher.on('context_building_complete', (data) => 
        console.log(`  ✅ Built context from ${data.sources || 0} sources`));
      
      researcher.on('report_generation_start', () => 
        console.log('  ✍️  Generating report...'));
      
      researcher.on('report_generation_complete', () => 
        console.log('  ✅ Report generated!\n'));
      
      // Conduct the research
      const startTime = Date.now();
      const result = await researcher.conductResearch();
      const duration = Date.now() - startTime;
      
      // Display the report (truncated for readability)
      console.log('📄 REPORT:\n');
      const reportPreview = result.report.substring(0, 800);
      console.log(reportPreview);
      if (result.report.length > 800) {
        console.log('\n[... Report truncated, full length: ' + result.report.length + ' characters ...]');
      }
      
      // Show sources
      if (result.sources && result.sources.length > 0) {
        console.log('\n📚 TOP SOURCES:');
        result.sources.slice(0, 3).forEach((source, i) => {
          console.log(`  ${i + 1}. ${source.title || 'Untitled'}`);
          console.log(`     ${source.url}`);
        });
        if (result.sources.length > 3) {
          console.log(`  ... and ${result.sources.length - 3} more sources`);
        }
      }
      
      // Research statistics
      console.log('\n📊 STATISTICS:');
      console.log(`  • Duration: ${(duration / 1000).toFixed(2)} seconds`);
      console.log(`  • Total Cost: $${result.costs.total.toFixed(4)}`);
      console.log(`  • Sources Found: ${result.sources.length}`);
      console.log(`  • Report Type: ${researchQuery.reportType}`);
      console.log(`  • Model Used: gpt-3.5-turbo`);
      
      // Show what happened
      console.log('\n✨ What just happened:');
      if (searchComplete) {
        console.log('  ✓ Tavily searched the web for real-time information');
      }
      if (scrapingComplete) {
        console.log('  ✓ Web pages were scraped for detailed content');
      }
      console.log('  ✓ OpenAI analyzed and synthesized the information');
      console.log('  ✓ Generated a comprehensive, cited report');
      
    } catch (error) {
      console.error('\n❌ Research failed:', error.message);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n🎯 DEMO COMPLETE!\n');
  console.log('This demo showcased:');
  console.log('  • Real-time web search with Tavily API');
  console.log('  • Multiple report types (Quick Summary & Detailed Report)');
  console.log('  • Different tones (Professional & Academic)');
  console.log('  • Source validation and citation');
  console.log('  • Cost tracking and performance metrics');
  
  console.log('\n💡 Next Steps:');
  console.log('  1. Try different research queries');
  console.log('  2. Experiment with report types and tones');
  console.log('  3. Add more search providers (Serper, Google, etc.)');
  console.log('  4. Deploy to Vercel for production use');
}

// Run the demo
runTavilyResearch()
  .then(() => {
    console.log('\n✅ All research completed successfully!');
  })
  .catch(error => {
    console.error('\n❌ Demo failed:', error);
    process.exit(1);
  });
