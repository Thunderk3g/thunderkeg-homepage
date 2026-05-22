export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  agentRole?: "recruiter" | "collaborator";
}

export interface ChatChunk {
  delta: string;
  done?: boolean;
  error?: string;
}
