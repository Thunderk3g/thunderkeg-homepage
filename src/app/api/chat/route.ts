import { NextRequest, NextResponse } from 'next/server';
import { generateChatCompletion, isOllamaAvailable, discoverOllamaEndpoint } from '@/lib/ollama/client';
import { OllamaChatMessage } from '@/lib/ollama/types';
import { AGENT_PROMPTS } from '@/lib/ollama/prompts';

// Define the type for chat messages
interface ChatCompletionRequestMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// Define the type for resume data
interface ResumeData {
  [key: string]: any;
}

/**
 * Format resume data for inclusion in the context
 */
function formatResumeForContext(resumeData: any): string {
  try {
    return JSON.stringify(resumeData, null, 2);
  } catch (error) {
    console.error('Error formatting resume data:', error);
    return JSON.stringify({ error: 'Failed to format resume data' });
  }
}

/**
 * Main chat API route handler
 */
export async function POST(req: NextRequest) {
  try {
    const { messages, model, systemMessage, agentType, resumeData, stream = false } = await req.json();

    // Check if Ollama is available first
    const ollamaIsAvailable = await isOllamaAvailable();
    if (!ollamaIsAvailable) {
      return NextResponse.json({
        content: `Sorry, I couldn't connect to Ollama. Please make sure Ollama is installed and running locally.

To get started:
1. Download Ollama from https://ollama.ai/
2. Install and run Ollama on your computer
3. Start Ollama with 'ollama serve' command
4. Pull a model with 'ollama pull llama3' or another model of your choice

You can still use basic terminal commands in this interface while Ollama is offline.`,
        role: 'assistant',
        fallback: true,
      });
    }

    // Format messages based on whether we're using agent system or direct chat
    let formattedMessages: OllamaChatMessage[] = [];
    
    if (agentType && ['recruiter', 'collaborator'].includes(agentType)) {
      // Create a system prompt that includes resume data if available
      let systemPrompt = AGENT_PROMPTS[agentType as 'recruiter' | 'collaborator'];
      
      // Add resume data to the system prompt if available
      if (resumeData) {
        systemPrompt += `\n\nImportant context - Resume data:\n${formatResumeForContext(resumeData)}`;
      }
      
      formattedMessages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        }))
      ];
    } else {
      // Direct chat approach
      if (systemMessage) {
        let enhancedSystemMessage = systemMessage;
        
        // Add resume data to the system message if available
        if (resumeData) {
          enhancedSystemMessage += `\n\nImportant context - Resume data:\n${formatResumeForContext(resumeData)}`;
        }
        
        formattedMessages.push({
          role: 'system',
          content: enhancedSystemMessage
        });
      }
      
      formattedMessages.push(
        ...messages.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        }))
      );
    }

    // Check if stream mode is requested
    if (stream) {
      // For streaming, we need to handle differently
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Use our robust Ollama endpoint discovery function
            const ollamaUrl = await discoverOllamaEndpoint();
            if (!ollamaUrl) {
              throw new Error("Could not connect to Ollama server. Please make sure it's running.");
            }
            
            const payload = {
              model: model || 'llama3:latest',
              messages: formattedMessages,
              stream: true,
              options: {
                temperature: 0.7,
              },
            };
            
            console.log(`Streaming with model: ${model || 'llama3:latest'}`);
            
            const response = await fetch(`${ollamaUrl}/api/chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Ollama API error: ${errorText || response.statusText}`);
            }
            
            const reader = response.body?.getReader();
            if (!reader) {
              throw new Error('Failed to get reader from response');
            }
            
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              // Parse the chunks
              const chunk = new TextDecoder().decode(value);
              const lines = chunk.split('\n').filter(line => line.trim() !== '');
              
              for (const line of lines) {
                try {
                  const data = JSON.parse(line);
                  if (data.message?.content) {
                    // Send just the new content
                    controller.enqueue(encoder.encode(data.message.content));
                  }
                } catch (error) {
                  console.error('Error parsing JSON in stream:', error, line);
                  // If parsing fails, still try to send the raw line as fallback
                  if (line.length > 0) {
                    controller.enqueue(encoder.encode(line));
                  }
                  continue;
                }
              }
            }
            
            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.enqueue(encoder.encode(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
            controller.close();
          }
        }
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    
    // Non-streaming mode
    // Generate response from Ollama
    const response = await generateChatCompletion({
      model: model || 'llama3:latest',
      messages: formattedMessages,
      format: 'json', // Request JSON format to help ensure proper formatting
      options: {
        temperature: 0.7,
      },
    });

    return NextResponse.json({
      content: response,
      role: 'assistant',
      fallback: false,
    });
  } catch (error) {
    console.error('Error in chat route:', error);
    
    // Provide a helpful error message in case of failure
    let errorMessage = 'Something went wrong while processing your request.';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json({
      content: `Terminal Error: ${errorMessage}\n\nThis could be due to Ollama not running or another issue with the connection.\n\nYou can still use basic terminal commands in this interface.`,
      role: 'assistant',
      fallback: true,
    });
  }
}

/**
 * Format messages for direct chat without agent system
 */
function formatDirectMessages(messages: ChatCompletionRequestMessage[], systemMessage?: string): string {
  let formattedMessages = '';

  // Add system message if provided
  if (systemMessage) {
    formattedMessages += `[SYSTEM] ${systemMessage}\n\n`;
  }

  // Format conversation history
  messages.forEach((message) => {
    if (message.role === 'user') {
      formattedMessages += `[USER] ${message.content}\n\n`;
    } else if (message.role === 'assistant') {
      formattedMessages += `[ASSISTANT] ${message.content}\n\n`;
    }
  });

  return formattedMessages;
}

/**
 * Format prompt for agent-based system
 */
function formatAgentPrompt(systemPrompt: string, messages: ChatCompletionRequestMessage[]): string {
  let formattedHistory = '';

  // Format conversation history
  messages.forEach((message) => {
    if (message.role === 'user') {
      formattedHistory += `User: ${message.content}\n`;
    } else if (message.role === 'assistant') {
      formattedHistory += `Assistant: ${message.content}\n`;
    }
  });

  // Format complete prompt with system instructions and history
  return `${systemPrompt}\n\n${formattedHistory}Assistant: `;
} 