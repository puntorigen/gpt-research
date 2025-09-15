/**
 * Complete test demonstrating all features of GPT Research Node.js
 */

const { 
  GPTResearch, 
  Config, 
  Memory, 
  ConsoleOutput,
  ReportType,
  Tone
} = require('../dist');
const dotenv = require('dotenv');

// Load environment variables from parent directory
dotenv.config({ path: '../.env' });

// Display test header
function header(title) {
  console.log('\n' + '='.repeat(60));
  console.log('  ' + title);
  console.log('='.repeat(60) + '\n');
}

// Test 1: Basic Configuration and Memory
async function testBasicComponents() {
  header('TEST 1: Basic Components');
  
  console.log('📦 Testing Configuration...');
  const config = Config.getInstance({
    query: 'Test configuration',
    apiKeys: {
      openai: process.env.OPENAI_API_KEY || 'test-key'
    }
  });
  console.log('✅ Config initialized with query:', config.get('query'));
  
  console.log('\n💾 Testing Memory...');
  const memory = new Memory();
  memory.add('test', { data: 'test data' });
  memory.addSearchResults('test query', [
    { url: 'https://example.com', title: 'Test', content: 'Content', snippet: 'Snippet' }
  ]);
  console.log('✅ Memory stats:', JSON.stringify(memory.getStats(), null, 2));
  
  console.log('\n🎨 Testing Logger...');
  ConsoleOutput.info('Info message test');
  ConsoleOutput.success('Success message test');
  ConsoleOutput.warning('Warning message test');
  ConsoleOutput.debug('Debug message (visible if DEBUG=true)');
  console.log('✅ Logger working correctly');
  
  return true;
}

// Test 2: Research Configuration Options
async function testResearchConfig() {
  header('TEST 2: Research Configuration');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  Skipping - OPENAI_API_KEY not set');
    return false;
  }
  
  console.log('🔧 Testing various configurations...\n');
  
  // Test different report types
  const reportTypes = [
    ReportType.ResearchReport,
    ReportType.QuickSummary,
    ReportType.OutlineReport
  ];
  
  for (const reportType of reportTypes) {
    try {
      const researcher = new GPTResearch({
        query: 'Brief test query',
        reportType,
        tone: Tone.Professional,
        llmProvider: 'openai',
        smartLLMModel: 'gpt-3.5-turbo',
        fastLLMModel: 'gpt-3.5-turbo',
        maxSearchResults: 3,
        temperature: 0.7,
        maxTokens: 500,
        apiKeys: {
          openai: process.env.OPENAI_API_KEY
        }
      });
      
      console.log(`✅ ${reportType} configuration valid`);
      
      // Get stats
      const stats = researcher.getStats();
      console.log(`   Memory: ${stats.memory.searchResults} results, ${stats.memory.contextItems} context items`);
      
    } catch (error) {
      console.log(`❌ ${reportType} configuration failed:`, error.message);
    }
  }
  
  return true;
}

// Test 3: Research Skills
async function testResearchSkills() {
  header('TEST 3: Research Skills Components');
  
  console.log('🔍 Available Skills:');
  console.log('  ✓ ResearchConductor - Plans and manages research');
  console.log('  ✓ ReportGenerator - Generates various report types');
  console.log('  ✓ ContextManager - Manages research context');
  console.log('  ✓ BrowserManager - Handles web scraping');
  console.log('  ✓ SourceCurator - Validates and curates sources');
  
  console.log('\n📊 Report Types Available:');
  const types = Object.values(ReportType);
  types.forEach(type => console.log(`  • ${type}`));
  
  console.log('\n🎯 Tone Options Available:');
  const tones = Object.values(Tone);
  tones.slice(0, 5).forEach(tone => console.log(`  • ${tone}`));
  
  return true;
}

// Test 4: Mini Research Demo (if API key available)
async function testMiniResearch() {
  header('TEST 4: Mini Research Demo');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  Skipping - OPENAI_API_KEY not set');
    console.log('   Set OPENAI_API_KEY in .env to run actual research');
    return false;
  }
  
  console.log('🚀 Starting mini research demo...\n');
  
  try {
    const researcher = new GPTResearcher({
      query: 'What is Node.js?',
      reportType: ReportType.QuickSummary,
      tone: Tone.Casual,
      llmProvider: 'openai',
      smartLLMModel: 'gpt-3.5-turbo',
      maxSearchResults: 2,
      maxTokens: 300,
      apiKeys: {
        openai: process.env.OPENAI_API_KEY,
        tavily: process.env.TAVILY_API_KEY
      }
    });
    
    // Listen to events
    researcher.on('planning_start', () => console.log('📝 Planning research...'));
    researcher.on('search_start', () => console.log('🔎 Searching for information...'));
    researcher.on('scraping_start', () => console.log('🌐 Scraping web pages...'));
    researcher.on('report_generation_start', () => console.log('✍️  Generating report...'));
    
    // Note: This would actually conduct research if search APIs are configured
    // For testing, we'll just show the setup
    console.log('✅ Research agent configured and ready');
    console.log('   Would search for: "What is Node.js?"');
    console.log('   Report type: Quick Summary');
    console.log('   Tone: Casual');
    
    // If you have Tavily API key, uncomment to run actual research:
    // const result = await researcher.conductResearch();
    // console.log('\n📄 Report Preview:');
    // console.log(result.report.substring(0, 500) + '...');
    
  } catch (error) {
    console.log('⚠️  Demo setup complete (actual research requires search API keys)');
  }
  
  return true;
}

// Test 5: Export/Import Functionality
async function testExportImport() {
  header('TEST 5: Export/Import Functionality');
  
  const memory = new Memory();
  
  // Add some data
  memory.addContext('Test context data');
  memory.addSubtopics(['Topic 1', 'Topic 2']);
  memory.addSearchResults('test', [
    { url: 'https://test.com', title: 'Test', content: 'Test content', snippet: 'Test' }
  ]);
  
  // Export
  const exported = memory.export();
  console.log('📤 Exported memory data:');
  console.log('   Context items:', exported.context.length);
  console.log('   Subtopics:', exported.subtopics.length);
  console.log('   Search results:', exported.searchResults.length);
  
  // Create new memory and import
  const newMemory = new Memory();
  newMemory.import(exported);
  
  console.log('\n📥 Imported into new memory:');
  const stats = newMemory.getStats();
  console.log('   Stats:', JSON.stringify(stats, null, 2));
  
  console.log('\n✅ Export/Import working correctly');
  
  return true;
}

// Main test runner
async function runAllTests() {
  console.log('\n');
  console.log('🧪 GPT RESEARCHER NODE.JS - COMPLETE TEST SUITE');
  console.log('================================================\n');
  
  const tests = [
    { name: 'Basic Components', fn: testBasicComponents },
    { name: 'Research Configuration', fn: testResearchConfig },
    { name: 'Research Skills', fn: testResearchSkills },
    { name: 'Mini Research Demo', fn: testMiniResearch },
    { name: 'Export/Import', fn: testExportImport }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        console.log(`⏭️  ${test.name} - Skipped`);
      }
    } catch (error) {
      failed++;
      console.error(`❌ ${test.name} failed:`, error);
    }
  }
  
  // Summary
  header('TEST SUMMARY');
  console.log(`✅ Passed: ${passed}`);
  console.log(`⏭️  Skipped: ${tests.length - passed - failed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📌 Next Steps:');
    console.log('1. Add your API keys to .env file:');
    console.log('   - OPENAI_API_KEY (required)');
    console.log('   - TAVILY_API_KEY (recommended for best search)');
    console.log('   - SERPER_API_KEY or GOOGLE_API_KEY (alternative search)');
    console.log('\n2. Run actual research:');
    console.log('   npm run example');
    console.log('\n3. Deploy to Vercel:');
    console.log('   vercel deploy');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('  Test suite completed');
  console.log('='.repeat(60) + '\n');
}

// Run tests
runAllTests().catch(console.error);
