/**
 * Client-side helpers for Ollama integration
 */

// Define Resume interface
export interface ResumeData {
  basics?: {
    name?: string;
    label?: string;
    image?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: {
      address?: string;
      postalCode?: string;
      city?: string;
      countryCode?: string;
      region?: string;
    };
    profiles?: Array<{
      network?: string;
      username?: string;
      url?: string;
    }>;
  };
  work?: Array<{
    company?: string;
    position?: string;
    website?: string;
    startDate?: string;
    endDate?: string;
    summary?: string;
    highlights?: string[];
  }>;
  education?: Array<{
    institution?: string;
    area?: string;
    studyType?: string;
    startDate?: string;
    endDate?: string;
    gpa?: string;
    courses?: string[];
  }>;
  skills?: Array<{
    name?: string;
    level?: string;
    keywords?: string[];
  }>;
  projects?: Array<{
    name?: string;
    description?: string;
    highlights?: string[];
    keywords?: string[];
    startDate?: string;
    endDate?: string;
    url?: string;
    roles?: string[];
    entity?: string;
    type?: string;
  }>;
  [key: string]: unknown;
}

// Define message interface
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

// Define model details interface
export interface ModelDetails {
  name: string;
  description?: string;
  parameters?: number;
  quantization?: string;
  size?: string;
  [key: string]: unknown;
}

// Default model list to use when Ollama is not available
export const DEFAULT_MODELS = ['llama3', 'mistral', 'gemma'];

// Cache for resume data
let cachedResumeData: ResumeData | null = null;
let resumeLastFetched: number = 0;
const RESUME_CACHE_TTL = 1000 * 60 * 10; // 10 minutes cache TTL

/**
 * Fetch resume data with caching
 */
export async function getResumeData(): Promise<ResumeData | null> {
  // Return cached data if it's fresh
  const now = Date.now();
  if (cachedResumeData && now - resumeLastFetched < RESUME_CACHE_TTL) {
    return cachedResumeData;
  }
  
  try {
    const response = await fetch('/api/resume');
    if (response.ok) {
      const data = await response.json();
      cachedResumeData = data;
      resumeLastFetched = now;
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error fetching resume data:', error);
    return null;
  }
}

/**
 * Check if we're running in a production/deployed environment
 */
export function isDeployedEnvironment(): boolean {
  // Check for Vercel-specific environment variables
  if (typeof window !== 'undefined') {
    // Client-side detection
    return window.location.hostname !== 'localhost' && 
           !window.location.hostname.includes('127.0.0.1');
  }
  
  // We'll assume not deployed if we can't determine
  return false;
}

/**
 * Check if Ollama is available and return status
 * Uses multiple connection strategies for robustness
 */
export async function checkOllamaAvailability(): Promise<boolean> {
  try {
    const response = await fetch('/api/ollama/status');
    if (response.ok) {
      const data = await response.json();
      return data.available;
    }
    return false;
  } catch (error) {
    console.error('Error checking Ollama availability:', error);
    return false;
  }
}

/**
 * Get available Ollama models
 * Uses multiple connection strategies for robustness
 */
export async function getOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch('/api/ollama/status');
    if (response.ok) {
      const data = await response.json();
      if (data.available && Array.isArray(data.models) && data.models.length > 0) {
        return data.models;
      }
      // Return default models if no models are available from Ollama
      return DEFAULT_MODELS;
    }
    return DEFAULT_MODELS;
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return DEFAULT_MODELS;
  }
}

/**
 * Get Ollama model details from the model name
 */
export async function getOllamaModelDetails(modelName: string): Promise<ModelDetails | null> {
  try {
    const response = await fetch(`/api/ollama/model?name=${encodeURIComponent(modelName)}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error(`Error fetching details for model ${modelName}:`, error);
    return null;
  }
}

/**
 * Send a chat message to Ollama via our API
 */
export async function sendChatMessage(messages: ChatMessage[], model: string, agentType: string): Promise<string> {
  // Fetch resume data if needed
  const resumeData = await getResumeData();
  
  try {
    // First check if Ollama is available
    const ollamaAvailable = await checkOllamaAvailability();
    if (!ollamaAvailable) {
      throw new Error("Could not connect to Ollama server");
    }
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model,
        agentType,
        resumeData, // Include resume data in request
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.content || '';
  } catch (error) {
    console.error('Error sending chat message:', error);
    
    return `Sorry, I couldn't connect to the Ollama server. Please make sure:
    
1. Ollama is installed on your system (https://ollama.com)
2. The Ollama service is running (run 'ollama serve' in a terminal)
3. Your browser isn't blocking connections to the Ollama API

Error details: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Stream a chat message from Ollama via our API
 */
export async function streamChatMessage(
  messages: ChatMessage[], 
  model: string, 
  agentType: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  // Fetch resume data if needed
  const resumeData = await getResumeData();
  
  try {
    // First check if Ollama is available
    const ollamaAvailable = await checkOllamaAvailability();
    if (!ollamaAvailable) {
      const errorMessage = `Sorry, I couldn't connect to the Ollama server. Please make sure:
      
1. Ollama is installed on your system (https://ollama.com)
2. The Ollama service is running (run 'ollama serve' in a terminal)
3. Your browser isn't blocking connections to the Ollama API`;
      
      // Simulate streaming for better UX
      const words = errorMessage.split(' ');
      for (let i = 0; i < words.length; i++) {
        const word = words[i] + ' ';
        onChunk(word);
        await new Promise(resolve => setTimeout(resolve, 30)); // Slight delay between words
      }
      return;
    }
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        model,
        agentType,
        resumeData, // Include resume data in request
        stream: true,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available from response');
    }
    
    const decoder = new TextDecoder();
    let done = false;
    
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      
      if (value) {
        const chunk = decoder.decode(value, { stream: !done });
        onChunk(chunk);
      }
    }
  } catch (error) {
    console.error('Error streaming chat message:', error);
    onChunk(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 