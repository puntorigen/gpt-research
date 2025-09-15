/**
 * MCP (Model Context Protocol) TypeScript Type Definitions
 * 
 * These types define the structure for MCP integration in GPT Research.
 * Designed to be Vercel-compatible with focus on HTTP/WebSocket connections.
 */

/**
 * MCP server configuration
 */
export interface MCPConfig {
  /** Unique name for the MCP server */
  name: string;
  
  /** Connection type - Vercel supports http and websocket */
  connectionType?: 'stdio' | 'websocket' | 'http';
  
  /** URL for WebSocket or HTTP connections */
  connectionUrl?: string;
  
  /** Authentication token for the connection */
  connectionToken?: string;
  
  /** Command to spawn (stdio only - not Vercel compatible) */
  command?: string;
  
  /** Arguments for the command (stdio only) */
  args?: string[];
  
  /** Environment variables (stdio only) */
  env?: Record<string, string>;
  
  /** Specific tool name to use from this server */
  toolName?: string;
  
  /** Timeout for connections (ms) */
  timeout?: number;
  
  /** Enable auto-reconnect for WebSocket */
  autoReconnect?: boolean;
  
  /** Max reconnection attempts */
  maxReconnectAttempts?: number;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  /** Tool name */
  name: string;
  
  /** Tool description */
  description: string;
  
  /** Server that provides this tool */
  server: string;
  
  /** Parameters schema */
  parameters?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  
  /** Tool category */
  category?: 'search' | 'analysis' | 'generation' | 'utility' | 'custom';
}

/**
 * MCP Tool invocation request
 */
export interface MCPToolInvocation {
  /** Tool to invoke */
  tool: string;
  
  /** Server that provides the tool */
  server: string;
  
  /** Parameters for the tool */
  parameters: Record<string, any>;
  
  /** Request ID for tracking */
  requestId?: string;
  
  /** Timeout for this invocation */
  timeout?: number;
}

/**
 * MCP Tool result
 */
export interface MCPToolResult {
  /** Tool that was invoked */
  tool: string;
  
  /** Server that provided the result */
  server: string;
  
  /** Success status */
  success: boolean;
  
  /** Result data */
  data?: any;
  
  /** Error message if failed */
  error?: string;
  
  /** Execution time in ms */
  executionTime?: number;
  
  /** Request ID for tracking */
  requestId?: string;
}

/**
 * MCP message format for communication
 */
export interface MCPMessage {
  /** Message type */
  type: 'request' | 'response' | 'error' | 'notification';
  
  /** Message ID */
  id?: string;
  
  /** Method to call */
  method?: string;
  
  /** Parameters */
  params?: any;
  
  /** Result data */
  result?: any;
  
  /** Error information */
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

/**
 * MCP connection state
 */
export enum MCPConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * MCP connection interface
 */
export interface MCPConnection {
  /** Connection state */
  state: MCPConnectionState;
  
  /** Server name */
  server: string;
  
  /** Connection type */
  type: 'stdio' | 'websocket' | 'http';
  
  /** Send a message */
  send(message: MCPMessage): Promise<void>;
  
  /** Close the connection */
  close(): Promise<void>;
  
  /** Check if connected */
  isConnected(): boolean;
}

/**
 * MCP client events
 */
export interface MCPClientEvents {
  /** Emitted when connected to a server */
  connected: { server: string; type: string };
  
  /** Emitted when disconnected from a server */
  disconnected: { server: string; reason?: string };
  
  /** Emitted when a tool response is received */
  'tool-response': { server: string; data: any };
  
  /** Emitted when an error occurs */
  error: { server: string; error: Error | string };
  
  /** Emitted when reconnecting */
  reconnecting: { server: string; attempt: number };
  
  /** Emitted when a server exits (stdio only) */
  'server-exit': { server: string; code: number | null };
}

/**
 * MCP proxy configuration (for stdio servers on Vercel)
 */
export interface MCPProxyConfig {
  /** Proxy server URL */
  url: string;
  
  /** API key for proxy authentication */
  apiKey: string;
  
  /** Proxy mode */
  mode?: 'passthrough' | 'cache' | 'aggregate';
  
  /** Cache TTL in seconds */
  cacheTTL?: number;
}

/**
 * MCP research context
 */
export interface MCPResearchContext {
  /** Research query */
  query: string;
  
  /** Selected tools */
  tools: MCPTool[];
  
  /** Tool results */
  results: MCPToolResult[];
  
  /** Synthesis of results */
  synthesis?: string;
  
  /** Metadata */
  metadata?: {
    startTime: Date;
    endTime?: Date;
    totalTools: number;
    successfulTools: number;
    failedTools: number;
  };
}

/**
 * Vercel-specific MCP configuration
 */
export interface VercelMCPConfig {
  /** Enable MCP features */
  enabled: boolean;
  
  /** MCP mode for Vercel */
  mode: 'http-only' | 'websocket' | 'proxy' | 'hybrid';
  
  /** HTTP MCP servers */
  httpServers?: MCPConfig[];
  
  /** WebSocket MCP servers */
  wsServers?: MCPConfig[];
  
  /** Proxy configuration for stdio servers */
  proxy?: MCPProxyConfig;
  
  /** Use Vercel KV for caching */
  useKVCache?: boolean;
  
  /** KV cache namespace */
  kvNamespace?: string;
  
  /** Enable streaming responses */
  streaming?: boolean;
}
