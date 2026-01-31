
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName, Accent } from "./types";

/**
 * Generates speech from text using the Gemini TTS model.
 * Incorporates accent instructions by prepending them to the prompt text.
 */
export const generateSpeech = async (
  text: string, 
  voice: VoiceName, 
  speakingRate: number = 1.0, 
  accent: Accent = 'Neutral'
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Construct the prompt with accent instructions if applicable
  const promptText = accent !== 'Neutral' 
    ? `Speak with a ${accent} accent: ${text}` 
    : text;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ 
      parts: [{ 
        text: promptText 
      }] 
    }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
        // speakingRate integration can be attempted if the SDK supports it in the runtime 
        // even if types are missing, or handled by steering instructions if preferred.
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!base64Audio) {
    throw new Error("No audio data received from the model.");
  }

  return base64Audio;
};
