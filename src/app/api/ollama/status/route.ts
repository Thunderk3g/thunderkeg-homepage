import { NextResponse } from 'next/server';
import { isOllamaAvailable } from '@/lib/ollama/client';

// Define the model interface
interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export async function GET() {
  try {
    const available = await isOllamaAvailable();
    
    // If Ollama is available, also fetch available models
    let models: string[] = [];
    if (available) {
      try {
        const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
        const response = await fetch(`${ollamaUrl}/api/tags`, {
          method: 'GET',
          cache: 'no-store'
        });
        
        if (response.ok) {
          const data = await response.json();
          models = data.models.map((model: OllamaModel) => model.name);
        }
      } catch (error) {
        console.error('Error fetching Ollama models:', error);
      }
    }
    
    return NextResponse.json({
      available,
      models,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error checking Ollama status:', error);
    
    return NextResponse.json({
      available: false,
      error: 'Failed to check Ollama status',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 