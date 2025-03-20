/**
 * Client-side helpers for Ollama integration
 */

// Define Resume interface
interface ResumeData {
  [key: string]: any;
}

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
 * Check if Ollama is available and return status
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
 */
export async function getOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch('/api/ollama/status');
    if (response.ok) {
      const data = await response.json();
      if (data.available && Array.isArray(data.models)) {
        return data.models;
      }
    }
    return [];
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return [];
  }
}

/**
 * Get Ollama model details from the model name
 */
export async function getOllamaModelDetails(modelName: string): Promise<any> {
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
export async function sendChatMessage(messages: any[], model: string, agentType: string): Promise<string> {
  // Fetch resume data if needed
  const resumeData = await getResumeData();
  
  try {
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
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Stream a chat message from Ollama via our API
 */
export async function streamChatMessage(
  messages: any[], 
  model: string, 
  agentType: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  // Fetch resume data if needed
  const resumeData = await getResumeData();
  
  try {
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