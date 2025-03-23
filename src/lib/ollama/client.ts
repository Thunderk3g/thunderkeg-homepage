/**
 * Ollama API client
 */

// Use absolute path to ensure TypeScript finds the module
import { OllamaGenerateParams, OllamaChatParams, OllamaChatMessage } from '@/lib/ollama/types';

// Add OllamaBridge type declaration
declare global {
  interface Window {
    OllamaBridge?: {
      isAvailable: boolean;
    };
  }
}

// Store the successful Ollama endpoint
let cachedOllamaEndpoint: string | null = null;

// Add extension detection
let isExtensionAvailable: boolean | null = null;

// Add preference for using extension (defaults to true)
let preferExtension: boolean = true;

// Possible Ollama hosts to try when discovering endpoint
const POSSIBLE_HOSTS = [
  'http://localhost:11434',
  'http://host.docker.internal:11434',
  'http://172.17.0.1:11434',
  'http://127.0.0.1:11434',
];

/**
 * Configure whether to prefer using the extension even when direct connection is possible
 */
export function setPreferExtension(prefer: boolean): void {
  preferExtension = prefer;
  // Clear the cached endpoint to force rediscovery
  cachedOllamaEndpoint = null;
}

/**
 * Get current extension preference setting
 */
export function getPreferExtension(): boolean {
  return preferExtension;
}

/**
 * Check if Ollama Bridge extension is available
 * This uses a retry mechanism to handle cases where the extension
 * might load after our code checks for it
 */
export async function checkExtensionAvailability(): Promise<boolean> {
  // If we've already checked, return the cached result
  if (isExtensionAvailable !== null) {
    return isExtensionAvailable;
  }
  
  // If OllamaBridge already exists, return immediately
  if (typeof window !== 'undefined' && window.OllamaBridge && window.OllamaBridge.isAvailable) {
    console.log('🔌 Ollama Bridge extension detected!');
    isExtensionAvailable = true;
    return true;
  }
  
  // Otherwise, try a few times with a delay
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    // Wait 500ms before trying again
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (typeof window !== 'undefined' && window.OllamaBridge && window.OllamaBridge.isAvailable) {
      console.log(`🔌 Ollama Bridge extension detected after ${retryCount + 1} retries!`);
      isExtensionAvailable = true;
      return true;
    }
    
    retryCount++;
  }
  
  console.log(`Ollama Bridge extension not detected after ${maxRetries} attempts`);
  isExtensionAvailable = false;
  return false;
}

/**
 * Discover Ollama API endpoint by trying different possible URLs
 */
export async function discoverOllamaEndpoint(): Promise<string | null> {
  // Check if we already have a cached endpoint
  if (cachedOllamaEndpoint) {
    return cachedOllamaEndpoint;
  }

  // First check if the extension is available
  const extensionAvailable = await checkExtensionAvailability();
  
  // If extension is available and we prefer using it, use it immediately
  if (extensionAvailable && preferExtension) {
    console.log('Using Ollama Bridge extension for API communication');
    cachedOllamaEndpoint = 'http://localhost:11434';
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

  // If we couldn't connect directly but have the extension, use it as fallback
  if (extensionAvailable) {
    console.log('Using Ollama Bridge extension as fallback');
    cachedOllamaEndpoint = 'http://localhost:11434';
    return cachedOllamaEndpoint;
  }

  return null;
}

/**
 * Check if Ollama is available
 */
export async function isOllamaAvailable(): Promise<boolean> {
  const endpoint = await discoverOllamaEndpoint();
  return endpoint !== null;
}

/**
 * Get available Ollama models
 */
export async function getOllamaModels(): Promise<string[]> {
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
 * Check if we're using the Ollama Bridge extension
 */
export async function isUsingExtension(): Promise<boolean> {
  await discoverOllamaEndpoint(); // This will set the extension availability
  return isExtensionAvailable === true;
}

/**
 * Generate a completion with Ollama
 */
export async function generateCompletion(params: OllamaGenerateParams): Promise<string> {
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

/**
 * Debug function to check Ollama status from browser console
 * Call this with debugOllamaStatus() in the console to see current status
 */
export async function debugOllamaStatus(): Promise<void> {
  if (typeof window === 'undefined') {
    console.log('Cannot run debug in server context');
    return;
  }
  
  console.group('🔍 Ollama Bridge Debug Info');
  
  // Extension status
  const extensionAvailable = await checkExtensionAvailability();
  console.log(`Extension detected: ${extensionAvailable ? '✅ Yes' : '❌ No'}`);
  console.log(`Extension preference: ${getPreferExtension() ? '✅ Preferred' : '❌ Not preferred'}`);
  
  // Connection status
  const endpoint = await discoverOllamaEndpoint();
  console.log(`Active endpoint: ${endpoint || 'None'}`);
  console.log(`Connection status: ${endpoint ? '✅ Connected' : '❌ Disconnected'}`);
  
  // Try a basic API call
  if (endpoint) {
    try {
      const response = await fetch(`${endpoint}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API test successful', data);
      } else {
        console.log(`❌ API test failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ API test error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  console.groupEnd();
}

// Add debug function to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).debugOllamaStatus = debugOllamaStatus;
} 