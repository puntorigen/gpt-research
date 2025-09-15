/**
 * MCP Module Exports
 * 
 * Central export point for all MCP-related components.
 */

// Core components
export { MCPClient } from './MCPClient';
export { MCPToolSelector } from './MCPToolSelector';
export { MCPResearch } from './MCPResearch';
export { MCPStreamer } from './MCPStreamer';

// Types
export {
  MCPConfig,
  MCPTool,
  MCPToolInvocation,
  MCPToolResult,
  MCPMessage,
  MCPConnectionState,
  MCPConnection,
  MCPClientEvents,
  MCPProxyConfig,
  MCPResearchContext,
  VercelMCPConfig
} from './types';

// Additional exports for convenience
export type {
  ToolSelectionOptions
} from './MCPToolSelector';

export type {
  MCPResearchOptions
} from './MCPResearch';

export type {
  StreamEvent,
  StreamOptions
} from './MCPStreamer';
