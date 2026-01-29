/**
 * Test endpoint for DeepSeek API connectivity
 * Uses streaming to demonstrate real-time monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { streamDeepSeekChat } from '@/lib/deepseek';

/**
 * POST endpoint to test DeepSeek API connection with streaming
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json().catch(() => ({}));
    const { prompt = 'Hello! This is a connectivity test.' } = body;

    console.log('[Test API] Starting stream test with prompt:', prompt);

    // Use streaming to demonstrate real-time monitoring
    let fullResponse = '';
    for await (const chunk of streamDeepSeekChat(
      prompt,
      'You are a helpful assistant. Respond briefly.'
    )) {
      fullResponse += chunk;
    }

    const duration = Date.now() - startTime;

    console.log('[Test API] Stream test completed:', {
      duration,
      responseLength: fullResponse.length,
    });

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      duration,
      response: {
        length: fullResponse.length,
        preview: fullResponse.substring(0, 100) + (fullResponse.length > 100 ? '...' : ''),
      },
      message: 'Successfully connected to DeepSeek API (streaming)',
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('[Test API] Stream test failed:', error);

    return NextResponse.json(
      {
        success: false,
        timestamp: Date.now(),
        duration,
        error: error instanceof Error ? error.message : String(error),
        message: 'Failed to connect to DeepSeek API',
      },
      { status: 500 }
    );
  }
}
