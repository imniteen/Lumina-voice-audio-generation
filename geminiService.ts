
import { GoogleGenAI } from "@google/genai";
import { VoiceName } from "./types";

const API_KEY = process.env.API_KEY || '';

export const generateSpeech = async (text: string, voice: VoiceName) => {
  if (!API_KEY) {
    throw new Error("API Key is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  // Note: For TTS-specific models, sending the text directly is more reliable 
  // than including instructions, which can sometimes trigger 500 errors.
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ 
      parts: [{ 
        text: text 
      }] 
    }],
    config: {
      // Using string 'AUDIO' for robustness across SDK versions
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  
  if (!base64Audio) {
    throw new Error("No audio data received from the model.");
  }

  return base64Audio;
};
