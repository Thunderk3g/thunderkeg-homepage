/**
 * Ollama API client
 */

// Use absolute path to ensure TypeScript finds the module
import { OllamaGenerateParams, OllamaChatParams, OllamaChatMessage } from '@/lib/ollama/types';

// Store the successful Ollama endpoint
let cachedOllamaEndpoint: string | null = null;

// Flag to determine if we're running in demo mode (Vercel deployment)
let isDemoMode = false;

// Possible Ollama hosts to try when discovering endpoint
const POSSIBLE_HOSTS = [
  'http://localhost:11434',
  'http://host.docker.internal:11434',
  'http://172.17.0.1:11434',
  'http://127.0.0.1:11434',
];

// Mock models for demo mode (Vercel deployment)
const DEMO_MODELS = [
  {
    name: 'llama3',
    model: 'llama3',
    modified_at: new Date().toISOString(),
    size: 4661230977,
    details: {
      format: 'gguf',
      family: 'llama',
      parameter_size: '8B',
      quantization_level: 'Q4_0'
    }
  },
  {
    name: 'mistral',
    model: 'mistral',
    modified_at: new Date().toISOString(),
    size: 4108668321,
    details: {
      format: 'gguf',
      family: 'mistral',
      parameter_size: '7B',
      quantization_level: 'Q4_0'
    }
  },
  {
    name: 'gemma',
    model: 'gemma',
    modified_at: new Date().toISOString(),
    size: 3986512123,
    details: {
      format: 'gguf',
      family: 'gemma',
      parameter_size: '7B',
      quantization_level: 'Q4_0'
    }
  }
];

/**
 * Check if the application is running on Vercel
 */
export function isVercelDeployment(): boolean {
  return process.env.VERCEL === '1' || 
         Boolean(process.env.VERCEL_URL) || 
         Boolean(process.env.NEXT_PUBLIC_VERCEL_URL);
}

/**
 * Discover Ollama API endpoint by trying different possible URLs
 */
export async function discoverOllamaEndpoint(): Promise<string | null> {
  // Check if we're in Vercel deployment - if so, return null as Ollama isn't available
  if (isVercelDeployment()) {
    isDemoMode = true;
    console.log('Running in Vercel deployment - Ollama will not be available');
    return null;
  }

  // Check if we already have a cached endpoint
  if (cachedOllamaEndpoint) {
    return cachedOllamaEndpoint;
  }

  // Check for environment variable first
  const envEndpoint = process.env.OLLAMA_API_URL;
  if (envEndpoint) {
    try {
      const response = await fetch(`${envEndpoint}/api/tags`);
      if (response.ok) {
        cachedOllamaEndpoint = envEndpoint;
        return envEndpoint;
      }
    } catch (e) {
      console.warn(`Failed to connect to Ollama at ${envEndpoint}`);
    }
  }

  // Try each possible host
  for (const host of POSSIBLE_HOSTS) {
    try {
      // Use the /api/tags endpoint to check availability (per Ollama docs)
      const response = await fetch(`${host}/api/tags`);
      if (response.ok) {
        cachedOllamaEndpoint = host;
        return host;
      }
    } catch (e) {
      // Connection failed, try next host
      console.warn(`Failed to connect to Ollama at ${host}`);
    }
  }

  return null;
}

/**
 * Check if Ollama is available
 */
export async function isOllamaAvailable(): Promise<boolean> {
  // If we're in demo mode (Vercel), return true to allow the app to function
  if (isDemoMode) {
    return true;
  }
  
  const endpoint = await discoverOllamaEndpoint();
  return endpoint !== null;
}

/**
 * Get available Ollama models
 */
export async function getOllamaModels(): Promise<string[]> {
  // If we're in demo mode (Vercel), return demo models
  if (isDemoMode) {
    return DEMO_MODELS.map(model => model.name);
  }
  
  const endpoint = await discoverOllamaEndpoint();
  if (!endpoint) {
    return [];
  }

  try {
    // Use the /api/tags endpoint per Ollama docs
    const response = await fetch(`${endpoint}/api/tags`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    return data.models?.map((model: any) => model.name) || [];
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return [];
  }
}

/**
 * Generate a completion with Ollama
 */
export async function generateCompletion(params: OllamaGenerateParams): Promise<string> {
  // If we're in demo mode, return a mock response
  if (isDemoMode) {
    return `This is a demo response from the ${params.model} model. In this deployment, Ollama is not available as it runs locally. To use real AI models, please run this application locally with Ollama installed.`;
  }
  
  const endpoint = await discoverOllamaEndpoint();
  if (!endpoint) {
    return "Couldn't connect to Ollama. Please make sure it's running locally.";
  }

  try {
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${errorText || response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get reader from response');
    }

    let fullResponse = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          fullResponse += data.response || '';
        } catch (error) {
          console.error('Error parsing JSON in generate response:', error);
          continue;
        }
      }
    }
    
    return fullResponse;
  } catch (error) {
    console.error('Error generating completion:', error);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Generate a chat completion with Ollama
 */
export async function generateChatCompletion(params: OllamaChatParams): Promise<string> {
  // If we're in demo mode, return a mock response
  if (isDemoMode) {
    return `This is a demo response from the ${params.model} model. In this deployment, Ollama is not available as it runs locally. To use real AI models, please run this application locally with Ollama installed.`;
  }
  
  const endpoint = await discoverOllamaEndpoint();
  if (!endpoint) {
    return "Couldn't connect to Ollama. Please make sure it's running locally.";
  }

  try {
    const response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        stream: false, // We'll handle the full response directly
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  } catch (error) {
    console.error('Error generating chat completion:', error);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Exports
export type { OllamaChatMessage };
export { DEMO_MODELS }; 