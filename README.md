# GPT Research

[![npm version](https://badge.fury.io/js/gpt-research.svg)](https://badge.fury.io/js/gpt-research)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/gpt-research.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

🔍 **GPT Research** is an autonomous AI research agent that conducts comprehensive research on any topic, searches the web for real-time information, and generates detailed reports with proper citations.

Built with TypeScript and optimized for both local development and serverless deployment (Vercel, AWS Lambda, etc.).

## ✨ Features

- 🔍 **Multi-source Research**: Integrates multiple search providers:
  - **Tavily** - AI-optimized search engine
  - **Serper** - Google Search API (2,500 free searches/month)
  - **Google Custom Search** - Direct Google integration
  - **DuckDuckGo** - Privacy-focused search
- 🌐 **Smart Web Scraping**: Cheerio and Puppeteer for content extraction
- 🤖 **Multiple LLM Support**: OpenAI, Anthropic, Google AI, Groq, and more
- 🔌 **MCP Integration**: Model Context Protocol for external tool connections
- 📊 **Various Report Types**: Research, Detailed, Summary, Resource, Outline
- 🔄 **Streaming Support**: Real-time updates via Server-Sent Events
- ⚡ **Vercel Optimized**: Built for serverless deployment
- 💾 **Memory Management**: Tracks research context and history
- 💰 **Cost Tracking**: Monitor LLM usage and costs

## 🚀 Quick Start

### Installation

```bash
npm install gpt-research
# or
yarn add gpt-research
# or
pnpm add gpt-research
```

### Configuration

Create a `.env` file in the root directory:

```env
# Required
OPENAI_API_KEY=your-openai-api-key

# Optional Search Providers (at least one recommended)
TAVILY_API_KEY=your-tavily-api-key        # https://tavily.com (best for AI research)
SERPER_API_KEY=your-serper-api-key        # https://serper.dev (Google search, 2,500 free/month)
GOOGLE_API_KEY=your-google-api-key        # Google Custom Search
GOOGLE_CX=your-google-custom-search-engine-id

# Optional LLM Providers
ANTHROPIC_API_KEY=your-anthropic-api-key
GOOGLE_AI_API_KEY=your-google-ai-api-key
GROQ_API_KEY=your-groq-api-key
```

### Basic Usage

```javascript
const { GPTResearch } = require('gpt-research');
// or for TypeScript/ES modules:
// import { GPTResearch } from 'gpt-research';

async function main() {
  const researcher = new GPTResearch({
    query: 'What are the latest developments in quantum computing?',
    reportType: 'research_report',
    llmProvider: 'openai',
    apiKeys: {
      openai: process.env.OPENAI_API_KEY,
      tavily: process.env.TAVILY_API_KEY
    }
  });

  // Conduct research
  const result = await researcher.conductResearch();
  
  console.log(result.report);
  console.log(`Sources used: ${result.sources.length}`);
  console.log(`Cost: $${result.costs.total.toFixed(4)}`);
}

main().catch(console.error);
```

### Streaming Research

```javascript
const researcher = new GPTResearch(config);

// Stream research updates in real-time
for await (const update of researcher.streamResearch()) {
  switch (update.type) {
    case 'progress':
      console.log(`[${update.progress}%] ${update.message}`);
      break;
    case 'data':
      if (update.data?.reportChunk) {
        process.stdout.write(update.data.reportChunk);
      }
      break;
    case 'complete':
      console.log('\nResearch complete!');
      break;
  }
}
```

## 🔧 Configuration Options

```typescript
interface ResearchConfig {
  // Required
  query: string;                    // Research query
  
  // Report Configuration
  reportType?: ReportType;          // Type of report to generate
  reportFormat?: ReportFormat;      // Output format (markdown, pdf, docx)
  tone?: Tone;                      // Writing tone
  
  // LLM Configuration
  llmProvider?: string;             // LLM provider (openai, anthropic, etc.)
  smartLLMModel?: string;           // Model for complex tasks
  fastLLMModel?: string;            // Model for simple tasks
  temperature?: number;             // Generation temperature
  maxTokens?: number;               // Max tokens per generation
  
  // Search Configuration
  defaultRetriever?: string;        // Default search provider
  maxSearchResults?: number;        // Max results per search
  
  // Scraping Configuration
  defaultScraper?: string;          // Default scraper (cheerio, puppeteer)
  scrapingConcurrency?: number;     // Concurrent scraping operations
  
  // API Keys
  apiKeys?: {
    openai?: string;
    tavily?: string;
    serper?: string;
    google?: string;
    anthropic?: string;
    groq?: string;
  };
}
```

## 📋 Report Types

- **ResearchReport**: Comprehensive research with citations
- **DetailedReport**: In-depth analysis with extensive coverage
- **QuickSummary**: Concise overview of key points
- **ResourceReport**: Curated list of resources and references
- **OutlineReport**: Structured outline for further research

## 🔍 Search Providers

### Available Providers

| Provider | Best For | Free Tier | API Key Required |
|----------|----------|-----------|------------------|
| **Tavily** | AI-optimized research | 1,000/month | Yes - [Get Key](https://tavily.com) |
| **Serper** | Google search results | 2,500/month | Yes - [Get Key](https://serper.dev) |
| **Google** | Custom search | 100/day | Yes - [Setup](https://developers.google.com/custom-search) |
| **DuckDuckGo** | Privacy-focused | Unlimited | No |

### Choosing the Right Provider

- **Tavily**: Best for AI research, academic papers, technical topics
- **Serper**: Best for current events, general web search, Google quality
- **Google Custom Search**: Best for specific domains, controlled results
- **DuckDuckGo**: Best for privacy-sensitive research, no API needed

### Using Multiple Providers

```javascript
// Configure multiple providers for redundancy
const researcher = new GPTResearch({
  query: 'Your research topic',
  retrievers: ['tavily', 'serper'], // Falls back if one fails
  apiKeys: {
    tavily: process.env.TAVILY_API_KEY,
    serper: process.env.SERPER_API_KEY
  }
});
```

## 🔌 MCP (Model Context Protocol) Support

GPT Research now supports MCP for connecting to external tools and services!

### What is MCP?

MCP (Model Context Protocol) is a standardized protocol for connecting AI systems to external tools and data sources. It enables seamless integration with various services through a unified interface.

### MCP Features

- **Stdio MCP Servers** - Local process spawning for NPX/binary tools (Node.js/Docker/VPS)
- **HTTP MCP Servers** - RESTful API connections (works everywhere including Vercel)
- **WebSocket MCP** - Real-time bidirectional communication (works everywhere)
- **Tool Discovery** - Automatic discovery of available tools from all server types
- **Smart Selection** - AI-powered tool selection based on research query
- **Streaming Updates** - Real-time progress tracking via SSE
- **Mixed Mode** - Combine stdio, HTTP, and WebSocket in the same application

### MCP Usage Examples

#### HTTP/WebSocket MCP (Works everywhere including Vercel)
```javascript
const researcher = new GPTResearch({
  query: "Latest AI developments",
  mcpConfigs: [
    {
      name: "research-tools",
      connectionType: "http",
      connectionUrl: "https://mcp.example.com",
      connectionToken: process.env.MCP_TOKEN
    }
  ],
  useMCP: true
});
```

#### Stdio MCP (Local tools - Node.js environments)
```javascript
const researcher = new GPTResearch({
  query: "Analyze this codebase",
  mcpConfigs: [
    {
      name: "filesystem",
      connectionType: "stdio",
      command: "npx",
      args: ["@modelcontextprotocol/filesystem-server"],
      env: { READ_ONLY: "false" }
    },
    {
      name: "git",
      connectionType: "stdio",
      command: "git-mcp",
      args: ["--repo", "."]
    }
  ]
});
```

#### Mixed Mode (Combine all connection types)
```javascript
const researcher = new GPTResearch({
  query: "Research topic",
  mcpConfigs: [
    // Local tools via stdio
    { name: "local-fs", connectionType: "stdio", command: "npx", args: ["fs-mcp"] },
    // Remote API via HTTP
    { name: "api", connectionType: "http", connectionUrl: "https://api.example.com/mcp" },
    // Real-time via WebSocket
    { name: "stream", connectionType: "websocket", connectionUrl: "wss://realtime.example.com" }
  ]
});
```

### MCP Deployment Compatibility

| MCP Type | Local/Node.js | Vercel | Docker | VPS/Cloud |
|----------|---------------|--------|---------|-----------|
| **HTTP Servers** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **WebSocket** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Stdio** | ✅ Full | ❌ Not Supported | ✅ Full | ✅ Full |

#### Stdio MCP Notes:
- **Works perfectly** in Node.js, Docker, VPS, and self-hosted environments
- **Not supported** on Vercel, AWS Lambda, or other serverless platforms
- For serverless deployments, use HTTP/WebSocket MCP or deploy a proxy server

### Popular Stdio MCP Servers

These MCP servers can be run locally via stdio:

```bash
# File System Access
npx @modelcontextprotocol/filesystem-server

# Git Repository Tools  
npx @modelcontextprotocol/git-server

# Database Query Execution
npm install -g mcp-database
mcp-database

# Custom Python MCP Server
python -m mcp.server

# Shell Command Execution
cargo install mcp-shell
mcp-shell
```

### Learn More

- See [`examples/demo-mcp.js`](examples/demo-mcp.js) for HTTP/WebSocket demo
- See [`examples/demo-mcp-stdio.js`](examples/demo-mcp-stdio.js) for stdio demo
- Read [`MCP.md`](MCP.md) for implementation details
- Check [MCP Specification](https://github.com/anthropics/mcp) for protocol docs

## 🌐 Vercel Deployment

### API Routes

Create API routes in your Next.js/Vercel project:

```javascript
// api/research/route.js
import { GPTResearch } from 'gpt-research';

export async function POST(request) {
  const { query, reportType } = await request.json();
  
  const researcher = new GPTResearch({
    query,
    reportType,
    apiKeys: {
      openai: process.env.OPENAI_API_KEY,
      tavily: process.env.TAVILY_API_KEY
    }
  });
  
  const result = await researcher.conductResearch();
  
  return Response.json(result);
}
```

### Streaming API

```javascript
// api/research/stream/route.js
export async function POST(request) {
  const { query } = await request.json();
  
  const stream = new ReadableStream({
    async start(controller) {
      const researcher = new GPTResearch({ query });
      
      for await (const update of researcher.streamResearch()) {
        controller.enqueue(
          `data: ${JSON.stringify(update)}\n\n`
        );
      }
      
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

### Environment Variables

Add to your Vercel project settings:

```
OPENAI_API_KEY=your-key
TAVILY_API_KEY=your-key
SERPER_API_KEY=your-key
```

## 🧪 Examples

```bash
# Basic example
npm run example

# OpenAI-only example (no web search)
npm run example:simple

# Full research with Tavily web search
npm run example:tavily

# Research using Serper (Google Search API)
npm run example:serper
```

Check the `examples/` directory for more detailed usage examples.

## 📚 Documentation

### Quick Links
- [API Reference](#api-reference)
- [Configuration Options](#configuration)
- [Report Types](#report-types)
- [Search Providers](#search-providers)
- [Deployment Guide](#deployment)
- [Examples](https://github.com/puntorigen/gpt-research/tree/main/examples)

## 🎯 Use Cases

- **Market Research**: Analyze competitors, trends, and market opportunities
- **Academic Research**: Gather and synthesize information for papers and studies
- **Content Creation**: Research topics thoroughly for articles and blog posts
- **Technical Documentation**: Research technical topics and generate comprehensive guides
- **Due Diligence**: Conduct thorough research on companies, people, or topics
- **News Aggregation**: Gather and summarize news from multiple sources
└── example.ts             # Usage examples
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT License - see LICENSE file for details.

## 📊 Performance Considerations

- **Token Limits**: Automatically manages context within token limits
- **Concurrent Operations**: Configurable concurrency for searches and scraping
- **Cost Optimization**: Uses appropriate models for different tasks
- **Caching**: Caches scraped content to avoid redundant operations
- **Memory Management**: Efficient in-memory storage with export/import capabilities

## 🔐 Security

- **API Key Management**: Never commit API keys to version control
- **Input Validation**: All URLs and inputs are validated
- **Rate Limiting**: Built-in rate limiting for API calls
- **Error Handling**: Comprehensive error handling and recovery

## 🎯 Roadmap

- [ ] Add more LLM providers (Cohere, Together AI)
- [ ] Implement vector store for semantic search
- [ ] Add PDF and DOCX report export
- [ ] Create browser extension
- [ ] Add multi-language support
- [ ] Implement research templates
- [ ] Add collaborative research features

## 💡 Tips

1. **Use Tavily for best results** - It's specifically designed for AI research
2. **Configure multiple search providers** - Automatic fallback ensures reliability
3. **Adjust concurrency based on your limits** - Prevent rate limiting
4. **Use streaming for long research** - Better user experience
5. **Monitor costs** - Track LLM usage to manage expenses

## 🆘 Troubleshooting

### Common Issues

**Build Errors**: Make sure you have Node.js 18+ and run `npm install`

**API Key Errors**: Verify your API keys are correct in `.env`

**Rate Limiting**: Reduce `scrapingConcurrency` and `maxSearchResults`

**Memory Issues**: For large research, increase Node.js memory:
```bash
node --max-old-space-size=4096 your-script.js
```

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/puntorigen/gpt-research/issues)

## ⭐ Show Your Support

If you find GPT Research helpful, please consider:
- Giving us a star on [GitHub](https://github.com/puntorigen/gpt-research)
- Sharing with your network
- Contributing to the project

---

<p align="center">
  <b>Built with ❤️ by Pablo Schaffner</b><br>
  <i>Autonomous research for everyone</i>
</p>