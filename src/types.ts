export type AgentType = 'general' | 'symptom' | 'medication' | 'lifestyle' | 'remedy';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Date | string;
  role: 'user' | 'pro' | 'admin';
  isPro?: boolean;
  subscription?: {
    id: string;
    status: 'active' | 'canceled' | 'past_due';
    currentPeriodEnd: Date | string;
  };
  onboardingCompleted?: boolean;
  /** Present when returned from API — how the account was created */
  authProvider?: 'password' | 'google';
  healthMetrics?: {
    height: number; // in cm
    weight: number; // in kg
    age: number;
    gender: 'male' | 'female' | 'other';
    bmi: number;
    bmiCategory: string;
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date | string;
  agentType: AgentType;
  options?: { label: string; value: AgentType }[];
  fileUrl?: string;
  fileType?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface ApiErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
  }
}
