import { GPTResearch } from '../../../src';
import type { ResearchConfig } from '../../../src/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    
    // Create a TransformStream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial connection message
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
          );
          
          // Stream research updates
          for await (const update of researcher.streamResearch()) {
            const data = `data: ${JSON.stringify(update)}\n\n`;
            controller.enqueue(encoder.encode(data));
            
            // If complete, close the stream
            if (update.type === 'complete') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              break;
            }
          }
        } catch (error: any) {
          // Send error message
          const errorData = JSON.stringify({
            type: 'error',
            message: error.message || 'An error occurred'
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        } finally {
          controller.close();
        }
      }
    });
    
    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable Nginx buffering
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
    
  } catch (error: any) {
    console.error('Stream error:', error);
    
    return Response.json(
      { 
        success: false,
        error: error.message || 'Failed to start research stream' 
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
