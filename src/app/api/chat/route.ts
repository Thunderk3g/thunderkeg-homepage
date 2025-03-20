import { NextRequest, NextResponse } from 'next/server';
import { generateChatCompletion, isOllamaAvailable, OllamaChatMessage, discoverOllamaEndpoint } from '@/lib/ollama/client';
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
        ...messages.map((msg: ChatCompletionRequestMessage) => ({
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
        ...messages.map((msg: ChatCompletionRequestMessage) => ({
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
              throw new Error(`Ollama API error (${response.status}): ${errorText || response.statusText}`);
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
 * Format resume data for context injection in prompts
 */
function formatResumeForContext(resumeData: ResumeData): string {
  if (!resumeData) return '';
  
  let formattedResume = '';
  
  // Personal information
  if (resumeData.personal_information) {
    formattedResume += 'Personal Information:\n';
    const personalInfo = resumeData.personal_information;
    for (const [key, value] of Object.entries(personalInfo)) {
      if (value) {
        formattedResume += `- ${key.replace(/_/g, ' ')}: ${value}\n`;
      }
    }
    formattedResume += '\n';
  }
  
  // Summary
  if (resumeData.summary) {
    formattedResume += `Summary:\n${resumeData.summary}\n\n`;
  }
  
  // Skills
  if (resumeData.skills && resumeData.skills.length > 0) {
    formattedResume += 'Skills:\n';
    resumeData.skills.forEach((skill: string) => {
      formattedResume += `- ${skill}\n`;
    });
    formattedResume += '\n';
  }
  
  // Work experience
  if (resumeData.work_experience && resumeData.work_experience.length > 0) {
    formattedResume += 'Work Experience:\n';
    resumeData.work_experience.forEach((job: any) => {
      formattedResume += `${job.job_title} at ${job.company} (${job.start_date} - ${job.end_date || 'Present'})\n`;
      if (job.location) {
        formattedResume += `Location: ${job.location}\n`;
      }
      if (job.responsibilities && job.responsibilities.length > 0) {
        formattedResume += 'Responsibilities:\n';
        job.responsibilities.forEach((resp: string) => {
          formattedResume += `- ${resp}\n`;
        });
      }
      formattedResume += '\n';
    });
  }
  
  // Education
  if (resumeData.education && resumeData.education.length > 0) {
    formattedResume += 'Education:\n';
    resumeData.education.forEach((edu: any) => {
      formattedResume += `${edu.degree} in ${edu.major} from ${edu.university} (${edu.start_date} - ${edu.end_date})\n`;
      if (edu.cgpa) {
        formattedResume += `CGPA: ${edu.cgpa}\n`;
      }
      formattedResume += '\n';
    });
  }
  
  // Projects
  if (resumeData.projects && resumeData.projects.length > 0) {
    formattedResume += 'Projects:\n';
    resumeData.projects.forEach((project: any) => {
      formattedResume += `- ${project.title}: ${project.description}\n`;
    });
    formattedResume += '\n';
  }
  
  return formattedResume;
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