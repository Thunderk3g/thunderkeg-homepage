import { NextResponse } from 'next/server';
import { discoverOllamaEndpoint, getOllamaModels, isOllamaAvailable } from '@/lib/ollama/client';

export async function GET() {
  try {
    // Try to discover the Ollama endpoint
    const ollamaEndpoint = await discoverOllamaEndpoint();
    const available = ollamaEndpoint !== null;
    
    let models: string[] = [];
    
    // Only try to fetch models if we have a valid endpoint
    if (available) {
      try {
        models = await getOllamaModels();
      } catch (error) {
        console.error('Error fetching models:', error);
      }
    }
    
    return NextResponse.json({
      available: available,
      endpoint: ollamaEndpoint,
      models: models,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in status route:', error);
    return NextResponse.json(
      {
        available: false,
        models: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
} 