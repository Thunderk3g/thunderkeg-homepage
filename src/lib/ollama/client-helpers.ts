/**
 * Client-side helpers for Ollama integration
 */

import { 
  isOllamaAvailable, 
  generateChatCompletion, 
  getOllamaModels as fetchOllamaModels,
  isUsingExtension
} from '@/lib/ollama/client';
import type { ChatMessage, ResumeData } from '@/lib/ollama/types';

// Re-export the types and functions
export type { ResumeData, ChatMessage } from '@/lib/ollama/types';
export { isUsingExtension } from '@/lib/ollama/client';

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
let resumeDataCache: ResumeData | null = null;

/**
 * Get resume data from the API or cache
 */
export async function getResumeData(): Promise<ResumeData | null> {
  if (resumeDataCache) {
    return resumeDataCache;
  }

  try {
    const response = await fetch('/api/resume');
    if (!response.ok) {
      throw new Error(`Failed to fetch resume data: ${response.statusText}`);
    }

    const data = await response.json();
    resumeDataCache = data;
    return data;
  } catch (error) {
    console.error('Error fetching resume data:', error);
    return null;
  }
}

/**
 * Check if Ollama is available and return status
 * Uses the direct Ollama API connection
 */
export async function checkOllamaAvailability(): Promise<boolean> {
  return isOllamaAvailable();
}

/**
 * Get available Ollama models directly from the Ollama API
 */
export async function getOllamaModels(): Promise<string[]> {
  try {
    const models = await fetchOllamaModels();
    if (models.length > 0) {
      return models;
    }
    // Return default models if no models are available from Ollama
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
 * Send a chat message to Ollama directly via the client API
 */
export async function sendChatMessage(messages: ChatMessage[], model: string, agentType: string): Promise<string> {
  // Fetch resume data if needed
  const resumeData = await getResumeData();
  
  try {
    // Always include the model parameter
    if (!model) {
      throw new Error("Missing required 'model' parameter");
    }
    
    // Convert ChatMessage format to OllamaChatMessage format
    const formattedMessages = messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));
    
    // Add system message with context if we have resume data
    if (resumeData) {
      const systemPrompt = agentType === 'recruiter' 
        ? `You are a professional assistant helping with resume and career questions. Here's the resume data: ${JSON.stringify(resumeData)}`
        : `You are a personal assistant helping with projects and collaboration. Here's the resume data: ${JSON.stringify(resumeData)}`;
        
      formattedMessages.unshift({
        role: 'system',
        content: systemPrompt
      });
    }
    
    if (agentType === 'resume') {
      // For resume agent, use the resume endpoint
      try {
        const resumeResponse = await fetch('/api/resume', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            messages: formattedMessages
          })
        });
        
        if (!resumeResponse.ok) {
          const errorText = await resumeResponse.text();
          throw new Error(`Resume API error: ${errorText || resumeResponse.statusText}`);
        }
        
        const data = await resumeResponse.json();
        
        // Handle both chat and generate API response formats
        if (data.message?.content) {
          // Chat API format
          return data.message.content;
        } else if (data.response) {
          // Generate API format
          return data.response;
        } else {
          return data.toString();
        }
      } catch (error) {
        console.error('Error using resume endpoint:', error);
        throw error;
      }
    }
    
    // For other agent types, use the generateChatCompletion function
    const response = await generateChatCompletion({
      model,
      messages: formattedMessages,
      options: {
        temperature: 0.7
      }
    });
    
    return response;
  } catch (error) {
    console.error('Error sending chat message:', error);
    
    // Check if we're on HTTPS and might need the extension
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    let extensionMessage = '';
    let corsMessage = '';
    
    if (isHttps) {
      extensionMessage = `\n4. If you're accessing this site via HTTPS, make sure the Ollama Bridge extension is installed and enabled`;
    }
    
    if (error instanceof Error && error.message.includes('403')) {
      corsMessage = `\n5. You may need to restart Ollama with CORS enabled: "OLLAMA_ORIGINS=* ollama serve"`;
    }
    
    return `Sorry, I couldn't connect to the Ollama server. Please make sure:
    
1. Ollama is installed on your system (https://ollama.com)
2. The Ollama service is running (run 'ollama serve' in a terminal)
3. You have the required models installed (run 'ollama pull ${model}')${extensionMessage}${corsMessage}

Error details: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Stream a chat message from Ollama
 */
export async function streamChatMessage(
  messages: ChatMessage[], 
  model: string, 
  agentType: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  // Implementation will need to be updated to use direct Ollama API streaming
  // For now, using the non-streaming version with simulated streaming
  
  try {
    const response = await sendChatMessage(messages, model, agentType);
    
    // Simulate streaming for better UX
    const words = response.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + ' ';
      onChunk(word);
      await new Promise(resolve => setTimeout(resolve, 30)); // Slight delay between words
    }
  } catch (error) {
    console.error('Error streaming chat message:', error);
    onChunk(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 