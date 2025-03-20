/**
 * Enhanced Ollama API Client
 * For connecting to a local Ollama server with improved error handling and connection testing
 */

// Cache the successful Ollama endpoint once found
let cachedOllamaEndpoint: string | null = null;
const POSSIBLE_HOSTS = [
  'http://localhost:11434',
  'http://host.docker.internal:11434', // For Docker environments
  'http://172.17.0.1:11434', // Common Docker host IP
  'http://127.0.0.1:11434', // Alternative localhost
];

export interface OllamaCompletionRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  format?: 'json' | Record<string, any>;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
}

export interface OllamaChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
  format?: 'json' | Record<string, any>;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
  };
}

export interface OllamaCompletionResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

/**
 * Discover the working Ollama endpoint by trying multiple possible URLs
 * This helps handle different environments like Docker, local dev, etc.
 */
export async function discoverOllamaEndpoint(forceRefresh = false): Promise<string | null> {
  // Return cached endpoint if available and not forcing refresh
  if (cachedOllamaEndpoint && !forceRefresh) {
    return cachedOllamaEndpoint;
  }
  
  // First try the environment variable if set
  const envEndpoint = process.env.OLLAMA_API_URL;
  if (envEndpoint) {
    try {
      const isAvailable = await testEndpoint(envEndpoint);
      if (isAvailable) {
        cachedOllamaEndpoint = envEndpoint;
        console.log(`Found Ollama at configured endpoint: ${envEndpoint}`);
        return envEndpoint;
      }
    } catch (error) {
      console.warn(`Could not connect to configured Ollama endpoint ${envEndpoint}:`, error);
    }
  }
  
  // Try each possible host until one works
  for (const host of POSSIBLE_HOSTS) {
    try {
      const isAvailable = await testEndpoint(host);
      if (isAvailable) {
        cachedOllamaEndpoint = host;
        console.log(`Found Ollama at: ${host}`);
        return host;
      }
    } catch (error) {
      console.warn(`Could not connect to Ollama at ${host}:`, error);
    }
  }
  
  console.error('Could not find Ollama running on any tested endpoint');
  return null;
}

/**
 * Test if Ollama is available at a specific endpoint
 */
async function testEndpoint(endpoint: string): Promise<boolean> {
  try {
    // Use AbortController to set a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1-second timeout
    
    const response = await fetch(`${endpoint}/api/version`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Check if Ollama is available and running
 */
export async function isOllamaAvailable(): Promise<boolean> {
  const endpoint = await discoverOllamaEndpoint();
  return endpoint !== null;
}

/**
 * Generate a completion response from Ollama with enhanced error handling
 */
export async function generateCompletion(request: OllamaCompletionRequest): Promise<string> {
  // Try to discover the Ollama endpoint
  const ollamaUrl = await discoverOllamaEndpoint();
  
  if (!ollamaUrl) {
    return "Terminal Error: Could not connect to Ollama server. Make sure Ollama is installed and running locally.\n\nFor installation instructions, visit: https://ollama.ai";
  }
  
  try {
    // Prepare the request payload
    const payload = {
      model: request.model,
      prompt: request.prompt,
      stream: request.stream === undefined ? false : request.stream,
      options: request.options || {},
    };
    
    // Add format if specified
    if (request.format) {
      Object.assign(payload, { format: request.format });
    }
    
    console.log('Sending to Ollama API:', JSON.stringify(payload));
    
    // Proceed with the actual request
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText || response.statusText}`);
    }
    
    if (request.stream) {
      // Handle streaming response
      return handleStreamingResponse(response);
    } else {
      // Handle regular response
      const data = await response.json() as OllamaCompletionResponse;
      return data.response;
    }
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    
    // Provide helpful fallback messages based on error type
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return "Terminal Error: Could not connect to Ollama server. Make sure Ollama is installed and running locally.\n\nFor installation instructions, visit: https://ollama.ai";
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      return "Terminal Error: Connection to Ollama timed out. The server might be too busy or not responding.";
    } else if (error instanceof Error) {
      return `Terminal Error: ${error.message}\n\nTry checking that Ollama is running with 'ollama serve' in a terminal window.`;
    }
    
    return "Terminal Error: Failed to generate completion from Ollama. See console for details.";
  }
}

/**
 * Process streaming response from Ollama
 */
async function handleStreamingResponse(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  let result = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Parse the chunks
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as OllamaCompletionResponse;
          result += data.response;
          
          if (data.done) {
            return result;
          }
        } catch (error) {
          console.error('Error parsing JSON in stream:', error, line);
          continue; // Skip this line if it's not valid JSON
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error processing streaming response:', error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Generate a chat completion response from Ollama
 */
export async function generateChatCompletion(request: OllamaChatRequest): Promise<string> {
  // Try to discover the Ollama endpoint
  const ollamaUrl = await discoverOllamaEndpoint();
  
  if (!ollamaUrl) {
    return "Terminal Error: Could not connect to Ollama server. Make sure Ollama is installed and running locally.\n\nFor installation instructions, visit: https://ollama.ai";
  }
  
  try {
    // Prepare the request payload
    const payload = {
      model: request.model,
      messages: request.messages,
      stream: request.stream === undefined ? false : request.stream,
      options: request.options || {},
    };
    
    // Add format if specified
    if (request.format) {
      Object.assign(payload, { format: request.format });
    }
    
    console.log('Sending to Ollama chat API:', JSON.stringify(payload));
    
    // Proceed with the actual request
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText || response.statusText}`);
    }
    
    if (request.stream) {
      // Handle streaming response
      return handleChatStreamingResponse(response);
    } else {
      // Handle regular response
      const data = await response.json() as OllamaChatResponse;
      return data.message.content;
    }
  } catch (error) {
    console.error('Error calling Ollama Chat API:', error);
    
    // Provide helpful fallback messages based on error type
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return "Terminal Error: Could not connect to Ollama server. Make sure Ollama is installed and running locally.\n\nFor installation instructions, visit: https://ollama.ai";
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      return "Terminal Error: Connection to Ollama timed out. The server might be too busy or not responding.";
    } else if (error instanceof Error) {
      return `Terminal Error: ${error.message}\n\nTry checking that Ollama is running with 'ollama serve' in a terminal window.`;
    }
    
    return "Terminal Error: Failed to generate chat completion from Ollama. See console for details.";
  }
}

/**
 * Process streaming chat response from Ollama
 */
async function handleChatStreamingResponse(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  let result = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Parse the chunks
      const chunk = new TextDecoder().decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as OllamaChatResponse;
          result += data.message.content;
          
          if (data.done) {
            return result;
          }
        } catch (error) {
          console.error('Error parsing JSON in chat stream:', error, line);
          continue; // Skip this line if it's not valid JSON
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error processing chat streaming response:', error);
    throw error;
  } finally {
    reader.releaseLock();
  }
} 