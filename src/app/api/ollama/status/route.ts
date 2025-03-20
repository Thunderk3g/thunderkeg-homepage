import { NextResponse } from 'next/server';
import { 
  discoverOllamaEndpoint, 
  getOllamaModels, 
  isOllamaAvailable, 
  isVercelDeployment,
  DEMO_MODELS
} from '@/lib/ollama/client';

export async function GET() {
  try {
    // Check if this is a Vercel deployment
    if (isVercelDeployment()) {
      // Return demo mode info for Vercel deployments
      return NextResponse.json({
        available: true, // We report as available even though it's demo mode
        isDemo: true,
        endpoint: null,
        models: DEMO_MODELS.map(model => model.name),
        timestamp: new Date().toISOString(),
      });
    }
    
    // For local development, try to discover the Ollama endpoint
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
      isDemo: false,
      endpoint: ollamaEndpoint,
      models: models,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in status route:', error);
    return NextResponse.json(
      {
        available: false,
        isDemo: false,
        models: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
} 