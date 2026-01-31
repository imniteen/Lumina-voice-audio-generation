
export enum VoiceName {
  KORE = 'Kore',
  PUCK = 'Puck',
  CHARON = 'Charon',
  FENRIR = 'Fenrir',
  ZEPHYR = 'Zephyr'
}

export type Accent = 'Neutral' | 'British' | 'Australian' | 'Indian' | 'Southern US' | 'Scottish';

export interface VoiceOption {
  id: VoiceName;
  name: string;
  description: string;
}

export interface AudioState {
  isGenerating: boolean;
  isPlaying: boolean;
  error: string | null;
}
