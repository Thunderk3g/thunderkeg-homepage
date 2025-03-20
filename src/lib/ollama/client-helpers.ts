/**
 * Client-side helpers for Ollama integration
 */

import { isOllamaAvailable, generateChatCompletion, getOllamaModels as fetchOllamaModels } from '@/lib/ollama/client';
import type { ChatMessage, ResumeData } from '@/lib/ollama/types';

// Re-export the types
export type { ResumeData, ChatMessage } from '@/lib/ollama/types';

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
    // First check if Ollama is available
    const ollamaAvailable = await checkOllamaAvailability();
    if (!ollamaAvailable) {
      throw new Error("Could not connect to Ollama server");
    }
    
    // Convert ChatMessage format to OllamaChatMessage format
    const formattedMessages = messages.map(msg => ({
      role: msg.role, 
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
    
    // Call the Ollama API directly
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
    
    return `Sorry, I couldn't connect to the Ollama server. Please make sure:
    
1. Ollama is installed on your system (https://ollama.com)
2. The Ollama service is running (run 'ollama serve' in a terminal)
3. Your browser isn't blocking connections to the Ollama API

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