import { GPTResearch } from '../../src';
import type { ResearchConfig } from '../../src/types';

export const runtime = 'nodejs'; // Use Node.js runtime for full functionality
export const maxDuration = 60; // Maximum execution time in seconds

export async function POST(request: Request) {
  try {
    const body = await request.json() as ResearchConfig;
    
    // Validate required fields
    if (!body.query) {
      return Response.json(
        { error: 'Research query is required' },
        { status: 400 }
      );
    }
    
    // Create researcher instance
    const researcher = new GPTResearch(body);
    
    // Conduct research
    const result = await researcher.conductResearch();
    
    // Return results
    return Response.json({
      success: true,
      data: result
    });
    
  } catch (error: any) {
    console.error('Research error:', error);
    
    return Response.json(
      { 
        success: false,
        error: error.message || 'An error occurred during research' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    message: 'GPT Research API',
    version: '0.1.0',
    endpoints: {
      research: {
        method: 'POST',
        path: '/api/research',
        description: 'Conduct research on a given topic'
      },
      stream: {
        method: 'POST',
        path: '/api/research/stream',
        description: 'Stream research updates in real-time'
      }
    }
  });
}
