export type AgentId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface AgentProfile {
  age: number;
  jobTitle: string;
  tenure: string;
  characterType: string;
  catchphrase: string;
  backstory: string;
  hobbies: string[];
  likes: string[];
}

export interface Agent {
  id: AgentId;
  name: string;
  role: string;
  description: string;
  personality: string;
  color: string;
  bgColor: string;
  borderColor: string;
  emoji: string;
  greeting: string;
  profile: AgentProfile;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string; // 添付画像（base64 data URL）
  timestamp: number;
}

export interface AgentSession {
  agentId: AgentId;
  messages: Message[];
  completed: boolean;
  summary?: string;
  codexReview?: string; // Codex + Ollamaによる自動コードレビュー結果
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  currentAgent: AgentId;
  sessions: AgentSession[];
}
