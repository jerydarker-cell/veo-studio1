
export enum AppTab {
  VIDEO = 'video',
  IMAGE = 'image',
  VOICE = 'voice',
  CHAT = 'chat',
  ANALYZE = 'analyze'
}

export interface Message {
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  thinking?: string;
  groundingUrls?: Array<{title: string, uri: string}>;
}

export type PreviewStage = 'instant' | 'draft' | 'final';

export interface VideoProConfig {
  motionBucket: number;
  temporalConsistency: 'standard' | 'high' | 'max';
  lockObject: 'none' | 'face' | 'wrist' | 'body';
  transition: 'none' | 'match-cut' | 'zoom-in' | 'glitch' | 'orbit';
  frameRate: 30 | 60;
  referenceStrength: number;
  objectTracking: boolean;
  upscaling: boolean;
  aiLabel: boolean;
  hardAdherence: boolean;
}

export interface VideoGenerationState {
  isGenerating: boolean;
  stage: 'idle' | 'initial' | 'extending_1' | 'extending_2' | 'extending_3' | 'finalizing';
  activePreviewStage: PreviewStage;
  status: string;
  progress: number;
  resultUrl?: string;
  audioUrl?: string;
  issues: string[];
}
