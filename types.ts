
export enum VoiceName {
  KORE = 'Kore',
  PUCK = 'Puck',
  CHARON = 'Charon',
  FENRIR = 'Fenrir',
  ZEPHYR = 'Zephyr'
}

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
