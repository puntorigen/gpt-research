/**
 * MCP Client Implementation
 * 
 * Manages connections to MCP servers with support for:
 * - HTTP connections (Vercel compatible)
 * - WebSocket connections (Vercel compatible)
 * - Stdio connections (not Vercel compatible, requires proxy)
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import WebSocket from 'ws';
import axios, { AxiosInstance } from 'axios';
import {
  MCPConfig,
  MCPConnection,
  MCPConnectionState,
  MCPMessage,
  MCPTool,
  MCPToolInvocation,
  MCPToolResult
} from './types';
import { ConsoleOutput } from '../utils/logger';

/**
 * HTTP connection handler for MCP
 */
class HTTPConnection implements MCPConnection {
  state: MCPConnectionState = MCPConnectionState.DISCONNECTED;
  server: string;
  type: 'http' = 'http';
  private client: AxiosInstance;

  constructor(server: string, url: string, token?: string) {
    this.server = server;
    this.client = axios.create({
      baseURL: url,
      timeout: 30000,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
  }

  async connect(): Promise<void> {
    try {
      this.state = MCPConnectionState.CONNECTING;
      // Test connection with a ping or health check
      await this.client.get('/health').catch(() => {
        // Some servers might not have health endpoint
      });
      this.state = MCPConnectionState.CONNECTED;
    } catch (error) {
      this.state = MCPConnectionState.ERROR;
      throw error;
    }
  }

  async send(message: MCPMessage): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to HTTP MCP server');
    }
    
    const response = await this.client.post('/invoke', message);
    return response.data;
  }

  async close(): Promise<void> {
    this.state = MCPConnectionState.DISCONNECTED;
  }

  isConnected(): boolean {
    return this.state === MCPConnectionState.CONNECTED;
  }
}

/**
 * WebSocket connection handler for MCP
 */
class WebSocketConnection implements MCPConnection {
  state: MCPConnectionState = MCPConnectionState.DISCONNECTED;
  server: string;
  type: 'websocket' = 'websocket';
  private ws?: WebSocket;
  private url: string;
  private token?: string;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private autoReconnect = true;

  constructor(
    server: string,
    url: string,
    token?: string,
    autoReconnect = true,
    maxReconnectAttempts = 5
  ) {
    this.server = server;
    this.url = url;
    this.token = token;
    this.autoReconnect = autoReconnect;
    this.maxReconnectAttempts = maxReconnectAttempts;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.state = MCPConnectionState.CONNECTING;
      
      const headers: any = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      this.ws = new WebSocket(this.url, { headers });

      this.ws.on('open', () => {
        this.state = MCPConnectionState.CONNECTED;
        this.reconnectAttempts = 0;
        ConsoleOutput.success(`Connected to WebSocket MCP server: ${this.server}`);
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          ConsoleOutput.error(`Failed to parse WebSocket message: ${error}`);
        }
      });

      this.ws.on('error', (error) => {
        this.state = MCPConnectionState.ERROR;
        ConsoleOutput.error(`WebSocket error for ${this.server}: ${error}`);
        reject(error);
      });

      this.ws.on('close', () => {
        this.state = MCPConnectionState.DISCONNECTED;
        ConsoleOutput.warning(`WebSocket connection closed for ${this.server}`);
        
        if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        }
      });
    });
  }

  private async reconnect(): Promise<void> {
    this.reconnectAttempts++;
    this.state = MCPConnectionState.RECONNECTING;
    ConsoleOutput.info(`Reconnecting to ${this.server} (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        ConsoleOutput.error(`Reconnection failed: ${error}`);
      }
    }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000));
  }

  private handleMessage(message: MCPMessage): void {
    if (message.id && this.messageHandlers.has(message.id)) {
      const handler = this.messageHandlers.get(message.id)!;
      handler(message);
      this.messageHandlers.delete(message.id);
    }
  }

  async send(message: MCPMessage): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to WebSocket MCP server');
    }

    return new Promise((resolve, reject) => {
      const messageId = message.id || Math.random().toString(36).substring(7);
      message.id = messageId;

      this.messageHandlers.set(messageId, (response) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });

      this.ws?.send(JSON.stringify(message));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.messageHandlers.has(messageId)) {
          this.messageHandlers.delete(messageId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async close(): Promise<void> {
    this.autoReconnect = false;
    this.ws?.close();
    this.state = MCPConnectionState.DISCONNECTED;
  }

  isConnected(): boolean {
    return this.state === MCPConnectionState.CONNECTED && this.ws?.readyState === WebSocket.OPEN;
  }
}

/**
 * Stdio connection handler for MCP (not Vercel compatible)
 */
class StdioConnection implements MCPConnection {
  state: MCPConnectionState = MCPConnectionState.DISCONNECTED;
  server: string;
  type: 'stdio' = 'stdio';
  private process?: ChildProcess;
  private command: string;
  private args: string[];
  private env?: Record<string, string>;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private buffer = '';

  constructor(
    server: string,
    command: string,
    args: string[] = [],
    env?: Record<string, string>
  ) {
    this.server = server;
    this.command = command;
    this.args = args;
    this.env = env;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.state = MCPConnectionState.CONNECTING;
      
      try {
        this.process = spawn(this.command, this.args, {
          env: { ...process.env, ...this.env },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout?.on('data', (data) => {
          this.buffer += data.toString();
          this.processBuffer();
        });

        this.process.stderr?.on('data', (data) => {
          ConsoleOutput.error(`Stdio error from ${this.server}: ${data.toString()}`);
        });

        this.process.on('exit', (code) => {
          this.state = MCPConnectionState.DISCONNECTED;
          ConsoleOutput.warning(`MCP server ${this.server} exited with code ${code}`);
        });

        // Give the process time to start
        setTimeout(() => {
          this.state = MCPConnectionState.CONNECTED;
          ConsoleOutput.success(`Connected to stdio MCP server: ${this.server}`);
          resolve();
        }, 1000);
        
      } catch (error) {
        this.state = MCPConnectionState.ERROR;
        reject(error);
      }
    });
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          // Not JSON, might be plain text output
        }
      }
    }
  }

  private handleMessage(message: MCPMessage): void {
    if (message.id && this.messageHandlers.has(message.id)) {
      const handler = this.messageHandlers.get(message.id)!;
      handler(message);
      this.messageHandlers.delete(message.id);
    }
  }

  async send(message: MCPMessage): Promise<any> {
    if (!this.isConnected()) {
      throw new Error('Not connected to stdio MCP server');
    }

    return new Promise((resolve, reject) => {
      const messageId = message.id || Math.random().toString(36).substring(7);
      message.id = messageId;

      this.messageHandlers.set(messageId, (response) => {
        if (response.error) {
          reject(new Error(response.error.message));
        } else {
          resolve(response.result);
        }
      });

      this.process?.stdin?.write(JSON.stringify(message) + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.messageHandlers.has(messageId)) {
          this.messageHandlers.delete(messageId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  async close(): Promise<void> {
    this.process?.kill();
    this.state = MCPConnectionState.DISCONNECTED;
  }

  isConnected(): boolean {
    return this.state === MCPConnectionState.CONNECTED && this.process?.killed === false;
  }
}

/**
 * Main MCP Client class
 */
export class MCPClient extends EventEmitter {
  private configs: MCPConfig[];
  private connections: Map<string, MCPConnection> = new Map();
  private tools: Map<string, MCPTool[]> = new Map();
  private isVercelEnvironment: boolean;

  constructor(configs: MCPConfig[]) {
    super();
    this.configs = configs;
    this.isVercelEnvironment = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;
    
    if (this.isVercelEnvironment) {
      ConsoleOutput.info('Running in Vercel environment - stdio MCP servers will not work directly');
    }
  }

  /**
   * Connect to all configured MCP servers
   */
  async connect(): Promise<void> {
    ConsoleOutput.info(`Connecting to ${this.configs.length} MCP server(s)...`);
    
    const connectionPromises = this.configs.map(config => this.connectServer(config));
    const results = await Promise.allSettled(connectionPromises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    ConsoleOutput.info(`Connected to ${successful}/${this.configs.length} MCP servers`);
    if (failed > 0) {
      ConsoleOutput.warning(`Failed to connect to ${failed} server(s)`);
    }
  }

  /**
   * Connect to a single MCP server
   */
  private async connectServer(config: MCPConfig): Promise<void> {
    const connectionType = this.detectConnectionType(config);
    
    // Check Vercel compatibility
    if (this.isVercelEnvironment && connectionType === 'stdio') {
      ConsoleOutput.error(`Cannot use stdio MCP server '${config.name}' in Vercel environment. Use HTTP/WebSocket or a proxy server.`);
      throw new Error('Stdio MCP servers not supported in Vercel');
    }
    
    let connection: MCPConnection;
    
    switch (connectionType) {
      case 'http':
        connection = new HTTPConnection(config.name, config.connectionUrl!, config.connectionToken);
        break;
        
      case 'websocket':
        connection = new WebSocketConnection(
          config.name,
          config.connectionUrl!,
          config.connectionToken,
          config.autoReconnect,
          config.maxReconnectAttempts
        );
        break;
        
      case 'stdio':
        if (!config.command) {
          throw new Error(`Command required for stdio connection: ${config.name}`);
        }
        connection = new StdioConnection(
          config.name,
          config.command,
          config.args,
          config.env
        );
        break;
        
      default:
        throw new Error(`Unsupported connection type: ${connectionType}`);
    }
    
    await (connection as any).connect();
    this.connections.set(config.name, connection);
    
    // Get available tools from the server
    await this.discoverTools(config.name, connection);
    
    this.emit('connected', { server: config.name, type: connectionType });
  }

  /**
   * Detect connection type from configuration
   */
  private detectConnectionType(config: MCPConfig): string {
    if (config.connectionType) return config.connectionType;
    if (config.connectionUrl?.startsWith('ws://') || config.connectionUrl?.startsWith('wss://')) {
      return 'websocket';
    }
    if (config.connectionUrl?.startsWith('http://') || config.connectionUrl?.startsWith('https://')) {
      return 'http';
    }
    return 'stdio';
  }

  /**
   * Discover available tools from an MCP server
   */
  private async discoverTools(server: string, connection: MCPConnection): Promise<void> {
    try {
      const message: MCPMessage = {
        type: 'request',
        method: 'tools/list',
        params: {}
      };
      
      const response = await connection.send(message);
      const tools: MCPTool[] = (response as any).tools || [];
      
      // Add server reference to each tool
      tools.forEach(tool => {
        tool.server = server;
      });
      
      this.tools.set(server, tools);
      ConsoleOutput.info(`Discovered ${tools.length} tool(s) from ${server}`);
      
    } catch (error) {
      ConsoleOutput.warning(`Failed to discover tools from ${server}: ${error}`);
      this.tools.set(server, []);
    }
  }

  /**
   * Get all available tools from connected servers
   */
  async getAvailableTools(): Promise<MCPTool[]> {
    const allTools: MCPTool[] = [];
    
    for (const [_server, tools] of this.tools) {
      allTools.push(...tools);
    }
    
    return allTools;
  }

  /**
   * Invoke a tool on an MCP server
   */
  async invokeTool(tool: MCPTool, parameters: Record<string, any>): Promise<MCPToolResult> {
    const connection = this.connections.get(tool.server);
    
    if (!connection || !connection.isConnected()) {
      return {
        tool: tool.name,
        server: tool.server,
        success: false,
        error: `Server ${tool.server} is not connected`
      };
    }
    
    const startTime = Date.now();
    
    try {
      const message: MCPMessage = {
        type: 'request',
        method: 'tools/invoke',
        params: {
          name: tool.name,
          arguments: parameters
        }
      };
      
      const result = await connection.send(message);
      
      return {
        tool: tool.name,
        server: tool.server,
        success: true,
        data: result,
        executionTime: Date.now() - startTime
      };
      
    } catch (error: any) {
      ConsoleOutput.error(`Tool invocation failed for ${tool.name}: ${error.message}`);
      
      return {
        tool: tool.name,
        server: tool.server,
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Invoke multiple tools in parallel
   */
  async invokeTools(invocations: MCPToolInvocation[]): Promise<MCPToolResult[]> {
    const promises = invocations.map(async (invocation) => {
      // Find the tool
      const tools = this.tools.get(invocation.server) || [];
      const tool = tools.find(t => t.name === invocation.tool);
      
      if (!tool) {
        return {
          tool: invocation.tool,
          server: invocation.server,
          success: false,
          error: `Tool ${invocation.tool} not found on server ${invocation.server}`,
          requestId: invocation.requestId
        };
      }
      
      const result = await this.invokeTool(tool, invocation.parameters);
      return { ...result, requestId: invocation.requestId };
    });
    
    return Promise.all(promises);
  }

  /**
   * Disconnect from all MCP servers
   */
  async disconnect(): Promise<void> {
    ConsoleOutput.info('Disconnecting from all MCP servers...');
    
    const disconnectPromises = Array.from(this.connections.entries()).map(async ([server, connection]) => {
      try {
        await connection.close();
        this.emit('disconnected', { server });
      } catch (error) {
        ConsoleOutput.error(`Failed to disconnect from ${server}: ${error}`);
      }
    });
    
    await Promise.all(disconnectPromises);
    this.connections.clear();
    this.tools.clear();
    
    ConsoleOutput.success('Disconnected from all MCP servers');
  }

  /**
   * Check if a specific server is connected
   */
  isServerConnected(server: string): boolean {
    const connection = this.connections.get(server);
    return connection?.isConnected() || false;
  }

  /**
   * Get connection status for all servers
   */
  getConnectionStatus(): Record<string, MCPConnectionState> {
    const status: Record<string, MCPConnectionState> = {};
    
    for (const [server, connection] of this.connections) {
      status[server] = connection.state;
    }
    
    return status;
  }

  /**
   * Reconnect to a specific server
   */
  async reconnectServer(serverName: string): Promise<void> {
    const config = this.configs.find(c => c.name === serverName);
    
    if (!config) {
      throw new Error(`Server configuration not found: ${serverName}`);
    }
    
    // Disconnect existing connection
    const existingConnection = this.connections.get(serverName);
    if (existingConnection) {
      await existingConnection.close();
      this.connections.delete(serverName);
    }
    
    // Reconnect
    await this.connectServer(config);
  }
}
