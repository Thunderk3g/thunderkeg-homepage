// Define chat message types
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

// Define the agent types
export enum AgentType {
  ASSISTANT = 'assistant',
  LINUX = 'linux',
  DEVELOPER = 'developer',
  RESEARCHER = 'researcher',
}

// Define model interface
export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
} 