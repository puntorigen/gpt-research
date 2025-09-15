/**
 * Demo: Report generation using only OpenAI (no search providers needed)
 * This demonstrates the report generation capabilities
 */

const { 
  GPTResearch,
  ReportGenerator,
  Config,
  Memory,
  ReportType,
  Tone,
  ConsoleOutput,
  LLMProviderFactory,
  OpenAIProvider
} = require('./dist');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Register OpenAI provider
LLMProviderFactory.register('openai', OpenAIProvider);

async function runOpenAIDemo() {
  console.log('\n🤖 GPT RESEARCH - OpenAI Report Generation Demo\n');
  console.log('=' .repeat(50));
  
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env');
    return;
  }
  
  console.log('✅ OpenAI API key loaded');
  console.log('\n📝 Topic: "What are the key features of TypeScript?"\n');
  
  try {
    // Initialize components
    const config = Config.getInstance({
      query: 'What are the key features of TypeScript?',
      reportType: ReportType.QuickSummary,
      tone: Tone.Professional,
      llmProvider: 'openai',
      smartLLMModel: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 800,
      apiKeys: {
        openai: process.env.OPENAI_API_KEY
      }
    });
    
    const memory = new Memory();
    const reportGenerator = new ReportGenerator(config, memory);
    
    // Initialize LLM provider
    const llmProvider = LLMProviderFactory.create('openai', {
      apiKey: process.env.OPENAI_API_KEY
    });
    
    console.log('🔄 Generating report using OpenAI GPT-3.5-turbo...\n');
    
    // Create a simple research context (without web search)
    const researchContext = {
      query: 'What are the key features of TypeScript?',
      reportType: ReportType.QuickSummary,
      findings: [
        'TypeScript is a statically typed superset of JavaScript developed by Microsoft',
        'Key features include: static typing, interfaces, classes, generics, enums, and decorators',
        'TypeScript compiles to plain JavaScript and can run anywhere JavaScript runs',
        'It provides better IDE support with IntelliSense and code refactoring',
        'TypeScript helps catch errors at compile-time rather than runtime'
      ],
      sources: [],
      subtopics: [
        'Static Type System',
        'Object-Oriented Programming Features',
        'Tooling and IDE Support',
        'Compatibility with JavaScript'
      ]
    };
    
    // Generate the report
    const startTime = Date.now();
    const report = await reportGenerator.generateReport(researchContext, llmProvider);
    const duration = Date.now() - startTime;
    
    // Display the report
    console.log('=' .repeat(50));
    console.log('\n📄 GENERATED REPORT:\n');
    console.log(report);
    
    // Calculate approximate cost (GPT-3.5-turbo pricing)
    const estimatedTokens = report.length / 4; // Rough estimate
    const estimatedCost = (estimatedTokens / 1000) * 0.002; // GPT-3.5-turbo pricing
    
    console.log('\n' + '=' .repeat(50));
    console.log('\n📊 GENERATION STATISTICS:\n');
    console.log(`  • Report Type: ${ReportType.QuickSummary}`);
    console.log(`  • Tone: ${Tone.Professional}`);
    console.log(`  • Model: gpt-3.5-turbo`);
    console.log(`  • Report Length: ${report.length} characters`);
    console.log(`  • Generation Time: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`  • Estimated Cost: $${estimatedCost.toFixed(4)}`);
    
    console.log('\n✨ Report generated successfully using OpenAI!');
    
    // Show how to use full research with search providers
    console.log('\n💡 For full web-based research capabilities:');
    console.log('  1. Get a free Tavily API key: https://tavily.com');
    console.log('  2. Add to .env: TAVILY_API_KEY=your-key');
    console.log('  3. The system will then search the web for real-time information');
    
  } catch (error) {
    console.error('\n❌ Error during report generation:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\n⚠️  Authentication error - please check your OpenAI API key');
    } else if (error.message.includes('429')) {
      console.log('\n⚠️  Rate limit exceeded - please wait and try again');
    } else if (error.message.includes('insufficient_quota')) {
      console.log('\n⚠️  OpenAI quota exceeded - please check your account');
    }
  }
}

// Alternative: Direct OpenAI test
async function testOpenAIDirectly() {
  console.log('\n🧪 Testing OpenAI API directly...\n');
  
  try {
    const provider = new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say "Hello! OpenAI is working!" if you can read this.' }
    ];
    
    const response = await provider.createChatCompletion(messages, {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 50
    });
    
    console.log('✅ OpenAI Response:', response);
    console.log('\n🎉 OpenAI API is working perfectly!');
    
    return true;
  } catch (error) {
    console.error('❌ OpenAI API test failed:', error.message);
    return false;
  }
}

// Run the demos
async function main() {
  console.log('🚀 Starting GPT Research OpenAI Demo...\n');
  
  // First test OpenAI directly
  const apiWorking = await testOpenAIDirectly();
  
  if (apiWorking) {
    // Then run the report generation demo
    await runOpenAIDemo();
  } else {
    console.log('\n⚠️  Please check your OpenAI API key and try again');
  }
  
  console.log('\n✅ Demo completed!');
}

main().catch(error => {
  console.error('\n❌ Demo failed:', error);
});
