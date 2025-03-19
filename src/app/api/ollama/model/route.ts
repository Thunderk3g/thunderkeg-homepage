import { NextRequest, NextResponse } from 'next/server';
import { isOllamaAvailable } from '@/lib/ollama/client';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const modelName = searchParams.get('name');
    
    if (!modelName) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
    }
    
    // Check if Ollama is available first
    const ollamaAvailable = await isOllamaAvailable();
    if (!ollamaAvailable) {
      return NextResponse.json({
        error: 'Ollama is not available',
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
    
    // Get model information from Ollama
    const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    const response = await fetch(`${ollamaUrl}/api/show`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: modelName }),
    });
    
    if (!response.ok) {
      return NextResponse.json({
        error: `Failed to get model information: ${response.statusText}`,
        status: response.status,
        timestamp: new Date().toISOString(),
      }, { status: response.status });
    }
    
    const modelData = await response.json();
    
    return NextResponse.json({
      model: modelName,
      details: modelData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error getting model information:', error);
    
    return NextResponse.json({
      error: 'Failed to get model information',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
} 