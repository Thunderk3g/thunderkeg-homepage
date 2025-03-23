/**
 * Ollama API client
 */

// Use absolute path to ensure TypeScript finds the module
import { OllamaGenerateParams, OllamaChatParams, OllamaChatMessage } from '@/lib/ollama/types';

// Add type declarations
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

// Safe access to browser extension APIs (avoid direct chrome reference)
const getExtensionVersion = (): string => {
  try {
    // @ts-ignore - Ignore chrome reference for runtime
    return typeof window !== 'undefined' && window.chrome?.runtime?.getManifest?.()?.version || '1.0.0';
  } catch (e) {
    return '1.0.0';
  }
};

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
 * Helper function to get the correct API path based on whether extension is being used
 */
export function getApiPath(path: string): string {
  // If using the extension, use the full localhost URL instead of relative paths
  if (typeof window !== 'undefined' && window.OllamaBridge && window.OllamaBridge.isAvailable) {
    // The extension expects absolute URLs to the Ollama server
    return `http://localhost:11434${path}`;
  }
  
  // If we have a cached endpoint, use it with the path
  if (cachedOllamaEndpoint) {
    return `${cachedOllamaEndpoint}${path}`;
  }
  
  // Default to localhost if we don't know yet
  return `http://localhost:11434${path}`;
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
    // Use the getApiPath helper for consistent URL handling
    const apiUrl = getApiPath('/api/tags');
    console.log(`Fetching models from: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
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
    // Use the getApiPath helper for consistent URL handling
    const apiUrl = getApiPath('/api/generate');
    
    // Validate required parameters
    if (!params.model || typeof params.model !== 'string') {
      throw new Error('Invalid model parameter: model must be a string');
    }
    
    if (!params.prompt || typeof params.prompt !== 'string') {
      throw new Error('Invalid prompt parameter: prompt must be a string');
    }
    
    // Format the request exactly as Ollama API expects
    const requestBody = {
      model: params.model,
      prompt: params.prompt,
      options: params.options || {},
      format: params.format,
      stream: true // Ollama generate uses streaming by default
    };
    
    console.log(`Making generate request to: ${apiUrl}`, requestBody);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
  // First check if extension is available
  const isExtensionAvailable = typeof window !== 'undefined' && 
                               window.OllamaBridge && 
                               window.OllamaBridge.isAvailable;
  
  try {
    // Make sure model is always included in the request
    if (!params.model || typeof params.model !== 'string') {
      throw new Error('Invalid model parameter: model must be a string');
    }
    
    if (!params.messages || !Array.isArray(params.messages) || params.messages.length === 0) {
      throw new Error('Invalid messages parameter: messages must be a non-empty array');
    }
    
    if (isExtensionAvailable) {
      // Use the extension for all API calls when available
      console.log(`Using Ollama Bridge extension with model: ${params.model}`);
      
      try {
        // Try the /api/chat endpoint first (newer Ollama versions)
        // Use getApiPath to get the correct URL for the Ollama server
        const apiUrl = getApiPath('/api/chat');
        console.log(`Making chat request via extension to: ${apiUrl}`, params);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...params,
            stream: false
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          return data.message?.content || '';
        } else if (response.status === 404) {
          // Fall back to /api/generate for older Ollama versions
          console.log('Chat endpoint not available, falling back to generate endpoint');
          
          // Convert messages to a prompt for the generate API
          let prompt = '';
          if (params.messages && params.messages.length > 0) {
            for (const msg of params.messages) {
              if (msg.role === 'system') {
                prompt += `System: ${msg.content}\n\n`;
              } else if (msg.role === 'user') {
                prompt += `User: ${msg.content}\n\n`;
              } else if (msg.role === 'assistant') {
                prompt += `Assistant: ${msg.content}\n\n`;
              }
            }
            
            // Add final prompt if the last message is from user
            if (params.messages[params.messages.length-1].role === 'user') {
              prompt += 'Assistant: ';
            }
          }
          
          // Call the generate API using getApiPath
          const generateUrl = getApiPath('/api/generate');
          console.log(`Falling back to generate API via extension: ${generateUrl}`);
          
          const generateResponse = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: params.model,
              prompt: prompt,
              options: params.options || { temperature: 0.7 },
              stream: false
            }),
          });
          
          if (!generateResponse.ok) {
            const errorText = await generateResponse.text();
            throw new Error(`Ollama API error: ${errorText || generateResponse.statusText}`);
          }
          
          const generateData = await generateResponse.json();
          return generateData.response || '';
        } else {
          const errorText = await response.text();
          throw new Error(`Ollama API error: ${errorText || response.statusText}`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('403')) {
          throw new Error(`CORS Error: Try restarting Ollama with CORS enabled: "OLLAMA_ORIGINS=* ollama serve"`);
        }
        throw error;
      }
    } else {
      // No extension - use direct connection to Ollama
      const endpoint = await discoverOllamaEndpoint();
      if (!endpoint) {
        return "Couldn't connect to Ollama. Please make sure it's running locally.";
      }
      
      try {
        // Try the /api/chat endpoint first (newer Ollama versions)
        const apiUrl = getApiPath('/api/chat');
        console.log(`Making chat request to: ${apiUrl}`, params);
        
        const chatResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: params.model,
            messages: params.messages,
            options: params.options || {},
            stream: false
          }),
        });
        
        if (chatResponse.ok) {
          const data = await chatResponse.json();
          return data.message?.content || '';
        } else if (chatResponse.status === 404) {
          // Fall back to /api/generate for older Ollama versions
          console.log('Chat endpoint not available, falling back to generate endpoint');
          
          // Convert messages to a prompt for the generate API
          let prompt = '';
          if (params.messages && params.messages.length > 0) {
            for (const msg of params.messages) {
              if (msg.role === 'system') {
                prompt += `System: ${msg.content}\n\n`;
              } else if (msg.role === 'user') {
                prompt += `User: ${msg.content}\n\n`;
              } else if (msg.role === 'assistant') {
                prompt += `Assistant: ${msg.content}\n\n`;
              }
            }
            
            // Add final prompt if the last message is from user
            if (params.messages[params.messages.length-1].role === 'user') {
              prompt += 'Assistant: ';
            }
          }
          
          // Call the generate API with getApiPath
          const generateUrl = getApiPath('/api/generate');
          console.log(`Falling back to generate API: ${generateUrl}`, { model: params.model, prompt });
          
          const generateResponse = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: params.model,
              prompt: prompt,
              options: params.options || { temperature: 0.7 },
              stream: false
            }),
          });
          
          if (!generateResponse.ok) {
            const errorText = await generateResponse.text();
            throw new Error(`Ollama API error: ${errorText || generateResponse.statusText}`);
          }
          
          const generateData = await generateResponse.json();
          return generateData.response || '';
        } else {
          const errorText = await chatResponse.text();
          throw new Error(`Ollama API error: ${errorText || chatResponse.statusText}`);
        }
      } catch (error) {
        console.error('Error connecting to Ollama:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error generating chat completion:', error);
    
    // Check if we're on HTTPS and might need the extension
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const extensionAvailable = typeof window !== 'undefined' && window.OllamaBridge && window.OllamaBridge.isAvailable;
    
    let errorMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    // Add helpful extension-related message for HTTPS sites
    if (isHttps && !extensionAvailable) {
      errorMessage += `\n\nSince this site is using HTTPS, you may need to install the Ollama Bridge extension to connect to your local Ollama instance.`;
    }
    
    // Add CORS error help
    if (error instanceof Error && error.message.includes('403')) {
      errorMessage += `\n\nYou may need to restart Ollama with CORS enabled: "OLLAMA_ORIGINS=* ollama serve"`;
    }
    
    return errorMessage;
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
  
  // Window object inspection
  console.log(`OllamaBridge object exists on window: ${typeof window.OllamaBridge !== 'undefined' ? '✅ Yes' : '❌ No'}`);
  if (window.OllamaBridge) {
    console.log('OllamaBridge properties:', Object.keys(window.OllamaBridge));
    console.log('OllamaBridge.isAvailable:', window.OllamaBridge.isAvailable);
  }
  
  // Extension status
  const extensionAvailable = await checkExtensionAvailability();
  console.log(`Extension detected: ${extensionAvailable ? '✅ Yes' : '❌ No'}`);
  console.log(`Extension preference: ${getPreferExtension() ? '✅ Preferred' : '❌ Not preferred'}`);
  
  // Connection status
  const endpoint = await discoverOllamaEndpoint();
  console.log(`Active endpoint: ${endpoint || 'None'}`);
  console.log(`Connection status: ${endpoint ? '✅ Connected' : '❌ Disconnected'}`);
  
  // Path detection test
  const chatApiPath = getApiPath('/api/chat');
  const tagsApiPath = getApiPath('/api/tags');
  console.log(`Chat API path: ${chatApiPath}`);
  console.log(`Tags API path: ${tagsApiPath}`);
  
  // Try a basic API call
  console.log('Attempting API test call...');
  try {
    // Use getApiPath to get the correct URL
    const apiUrl = getApiPath('/api/tags');
    console.log(`Making test request to: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API test successful', data);
    } else {
      const errorText = await response.text();
      console.log(`❌ API test failed: ${response.status} ${response.statusText}`);
      console.log(`Error details: ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ API test error: ${error instanceof Error ? error.message : String(error)}`);
    console.log('Full error:', error);
  }
  
  console.log('Testing chat completion API...');
  try {
    const result = await generateChatCompletion({
      model: 'llama3',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello!' }
      ]
    });
    console.log('✅ Chat completion test successful:', result.slice(0, 50) + '...');
  } catch (error) {
    console.log(`❌ Chat completion test error: ${error instanceof Error ? error.message : String(error)}`);
    console.log('Full error:', error);
  }
  
  console.groupEnd();
}

// Add debug function to window for easy console access
if (typeof window !== 'undefined') {
  (window as any).debugOllamaStatus = debugOllamaStatus;
} 