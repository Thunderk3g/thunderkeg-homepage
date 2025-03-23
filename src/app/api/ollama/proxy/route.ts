import { NextRequest, NextResponse } from 'next/server';

// Get the actual Ollama server endpoint from environment variables or use default
const OLLAMA_SERVER = process.env.OLLAMA_API_URL || 'http://localhost:11434';

/**
 * API Proxy for Ollama requests
 * This allows the frontend to make requests to Ollama without mixed content issues
 * as all requests go through our HTTPS-secured Next.js API
 */
export async function POST(request: NextRequest) {
  try {
    // Get the path from the URL (after /api/ollama/proxy/)
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/ollama/proxy', '');
    
    // Get the request body
    const body = await request.json();
    
    // Forward the request to Ollama
    const response = await fetch(`${OLLAMA_SERVER}${path || '/api/generate'}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    // If the response is not OK, return an error
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Ollama API error: ${error}` },
        { status: response.status }
      );
    }
    
    // Return the response from Ollama
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in Ollama proxy:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Handle GET requests to the proxy
 */
export async function GET(request: NextRequest) {
  try {
    // Get the path from the URL (after /api/ollama/proxy/)
    const url = new URL(request.url);
    const path = url.pathname.replace('/api/ollama/proxy', '');
    const searchParams = url.searchParams.toString();
    const queryString = searchParams ? `?${searchParams}` : '';
    
    // Forward the request to Ollama
    const response = await fetch(`${OLLAMA_SERVER}${path || '/api/tags'}${queryString}`);
    
    // If the response is not OK, return an error
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Ollama API error: ${error}` },
        { status: response.status }
      );
    }
    
    // Return the response from Ollama
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in Ollama proxy:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 