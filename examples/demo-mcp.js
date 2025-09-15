/**
 * MCP (Model Context Protocol) Demo
 * 
 * This example demonstrates how to use MCP integration with GPT Research.
 * MCP allows connecting to external tools and services through a standardized protocol.
 */

const { 
  MCPClient,
  MCPToolSelector,
  MCPResearch,
  MCPStreamer,
  GPTResearch,
  ConsoleOutput,
  OpenAIProvider
} = require('../dist');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env' });

async function runMCPDemo() {
  console.log('\n🔌 MCP (Model Context Protocol) DEMO\n');
  console.log('=' .repeat(60));
  
  // Check for API key
  if (!process.env.OPENAI_API_KEY) {
    ConsoleOutput.error('❌ OPENAI_API_KEY not found in .env');
    ConsoleOutput.info('\n📝 To get an OpenAI API key:');
    ConsoleOutput.info('   1. Visit: https://platform.openai.com/api-keys');
    ConsoleOutput.info('   2. Create a new API key');
    ConsoleOutput.info('   3. Add to .env: OPENAI_API_KEY=sk-...');
    return;
  }
  
  console.log('\n📋 DEMO OVERVIEW:');
  console.log('  This demo shows MCP integration capabilities:');
  console.log('  • HTTP-based MCP servers (Vercel compatible)');
  console.log('  • WebSocket MCP connections (Vercel compatible)');
  console.log('  • Tool discovery and selection');
  console.log('  • Research execution with MCP tools');
  console.log('  • Streaming updates with SSE');
  console.log('\n' + '=' .repeat(60));
  
  try {
    // Example 1: Initialize MCP Client with mock configuration
    console.log('\n1️⃣  INITIALIZING MCP CLIENT\n');
    
    // Note: These are example configurations. In production, you would use real MCP servers.
    const mcpConfigs = [
      {
        name: 'example-http-mcp',
        connectionType: 'http',
        connectionUrl: 'https://mcp.example.com',
        connectionToken: 'example-token',
        toolName: 'search'
      },
      // WebSocket example (commented out as it requires a real server)
      // {
      //   name: 'example-ws-mcp',
      //   connectionType: 'websocket',
      //   connectionUrl: 'wss://mcp.example.com/ws',
      //   connectionToken: 'example-token',
      //   autoReconnect: true,
      //   maxReconnectAttempts: 3
      // }
    ];
    
    const mcpClient = new MCPClient(mcpConfigs);
    ConsoleOutput.success('✅ MCP Client initialized');
    ConsoleOutput.info(`   Configured ${mcpConfigs.length} MCP server(s)`);
    
    // Note: Actual connection would require real MCP servers
    // await mcpClient.connect();
    
    // Example 2: Tool Selection
    console.log('\n2️⃣  MCP TOOL SELECTION\n');
    
    const llmProvider = new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo'
    });
    
    const toolSelector = new MCPToolSelector(llmProvider);
    ConsoleOutput.success('✅ Tool Selector initialized');
    
    // Mock tools for demonstration
    const mockTools = [
      {
        name: 'web_search',
        description: 'Search the web for information',
        server: 'example-http-mcp',
        category: 'search'
      },
      {
        name: 'code_analysis',
        description: 'Analyze code repositories',
        server: 'example-http-mcp',
        category: 'analysis'
      },
      {
        name: 'document_reader',
        description: 'Read and extract information from documents',
        server: 'example-http-mcp',
        category: 'utility'
      }
    ];
    
    console.log('\n📚 Available MCP Tools:');
    mockTools.forEach(tool => {
      console.log(`  • ${tool.name} (${tool.category}): ${tool.description}`);
    });
    
    const query = "What are the latest trends in AI development?";
    console.log(`\n🔍 Research Query: "${query}"`);
    
    const selectedTools = await toolSelector.selectTools(query, mockTools, {
      maxTools: 2,
      strategy: 'pattern' // Using pattern matching since we have mock tools
    });
    
    console.log('\n✨ Selected Tools:');
    selectedTools.forEach(tool => {
      console.log(`  • ${tool.name} - ${tool.description}`);
    });
    
    // Example 3: MCP Research
    console.log('\n3️⃣  MCP RESEARCH EXECUTION\n');
    
    const mcpResearch = new MCPResearch(mcpClient, toolSelector, llmProvider);
    ConsoleOutput.success('✅ MCP Research initialized');
    
    // Validate configuration
    const validation = await mcpResearch.validateConfiguration();
    console.log('\n📋 Configuration Validation:');
    console.log(`  • Valid: ${validation.valid ? '✅' : '❌'}`);
    if (validation.issues.length > 0) {
      console.log('  • Issues:');
      validation.issues.forEach(issue => console.log(`    - ${issue}`));
    }
    if (validation.recommendations.length > 0) {
      console.log('  • Recommendations:');
      validation.recommendations.forEach(rec => console.log(`    - ${rec}`));
    }
    
    // Example 4: Streaming
    console.log('\n4️⃣  MCP STREAMING\n');
    
    const streamer = new MCPStreamer({
      format: 'sse',
      includeTimestamps: true,
      includeProgress: true
    });
    ConsoleOutput.success('✅ MCP Streamer initialized');
    
    // Simulate streaming events
    console.log('\n📡 Simulating Stream Events:');
    
    streamer.on('stream', (data) => {
      // In production, this would be sent to the client
      // console.log('Stream:', data);
    });
    
    // Simulate research progress
    streamer.addEvent('start', { 
      query, 
      totalSteps: 4,
      message: 'Starting MCP research' 
    });
    console.log('  ✓ Research started');
    
    streamer.addEvent('discovery', { 
      status: 'completed',
      toolsFound: mockTools.length 
    });
    console.log('  ✓ Tool discovery completed');
    
    streamer.addEvent('selection', { 
      status: 'completed',
      selectedTools: selectedTools.map(t => t.name) 
    });
    console.log('  ✓ Tool selection completed');
    
    streamer.addEvent('execution', { 
      status: 'completed',
      results: 2 
    });
    console.log('  ✓ Tool execution completed');
    
    streamer.addEvent('complete', { 
      message: 'Research completed successfully',
      duration: 5000 
    });
    console.log('  ✓ Research completed');
    
    // Example 5: Vercel Deployment Info
    console.log('\n5️⃣  VERCEL DEPLOYMENT\n');
    
    console.log('📦 Vercel Compatibility:');
    console.log('  ✅ HTTP MCP servers - Fully supported');
    console.log('  ✅ WebSocket clients - Fully supported');
    console.log('  ❌ Stdio servers - Requires proxy server');
    
    console.log('\n🚀 Deployment Steps:');
    console.log('  1. Configure MCP servers in environment variables');
    console.log('  2. Use HTTP/WebSocket MCP servers');
    console.log('  3. Deploy with: vercel deploy');
    console.log('  4. Access via API routes or Edge Functions');
    
    console.log('\n📝 Environment Variables for Vercel:');
    console.log('  MCP_HTTP_URL=https://your-mcp-server.com');
    console.log('  MCP_HTTP_TOKEN=your-token');
    console.log('  MCP_WS_URL=wss://your-mcp-websocket.com');
    console.log('  MCP_WS_TOKEN=your-token');
    
    // Example 6: Integration with GPT Research
    console.log('\n6️⃣  GPT RESEARCH WITH MCP\n');
    
    console.log('📄 Example Configuration:');
    const exampleConfig = {
      query: "Research topic",
      mcpConfigs: [
        {
          name: 'tavily-mcp',
          connectionType: 'http',
          connectionUrl: 'https://mcp.tavily.com',
          connectionToken: process.env.TAVILY_MCP_TOKEN
        }
      ],
      useMCP: true,
      mcpStrategy: 'hybrid'
    };
    
    console.log('\n```javascript');
    console.log('const researcher = new GPTResearch({');
    console.log('  query: "' + exampleConfig.query + '",');
    console.log('  mcpConfigs: [');
    console.log('    {');
    console.log('      name: "tavily-mcp",');
    console.log('      connectionType: "http",');
    console.log('      connectionUrl: "https://mcp.tavily.com",');
    console.log('      connectionToken: process.env.TAVILY_MCP_TOKEN');
    console.log('    }');
    console.log('  ],');
    console.log('  useMCP: true,');
    console.log('  mcpStrategy: "hybrid"');
    console.log('});');
    console.log('');
    console.log('const result = await researcher.conductResearch();');
    console.log('```');
    
    console.log('\n✅ MCP Demo completed successfully!');
    console.log('\n💡 Next Steps:');
    console.log('  1. Set up real MCP servers');
    console.log('  2. Configure authentication tokens');
    console.log('  3. Deploy to Vercel');
    console.log('  4. Monitor with streaming updates');
    
  } catch (error) {
    ConsoleOutput.error(`\n❌ Demo error: ${error.message}`);
    console.error(error);
  }
}

// Run the demo
runMCPDemo().catch(console.error);
