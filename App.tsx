import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface VoiceOption {
  id: string;
  name: string;
  description: string;
}

export const VOICES: VoiceOption[] = [
  { id: 'Algieba', name: 'Algieba', description: 'Deep & Commanding (Default)' },
  { id: 'Orus', name: 'Orus', description: 'Gravelly & Intense' },
  { id: 'Puck', name: 'Puck', description: 'Sharp & Quick' },
  { id: 'Charon', name: 'Charon', description: 'Somber & Wise' },
  { id: 'Kore', name: 'Kore', description: 'Smooth & Elegant' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Powerful & Rough' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Light & Airy' },
];

export async function generateSpeech(text: string, voiceId: string, speed: number = 1.0) {
  try {
    // Voice Mapping to ensure compatibility with Gemini TTS model
    const voiceMapping: Record<string, string> = {
      'Algieba': 'Charon',
      'Orus': 'Fenrir',
    };
    const mappedVoice = voiceMapping[voiceId] || (['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].includes(voiceId) ? voiceId : 'Charon');

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview", 
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { 
               voiceName: mappedVoice as any
            },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('No audio data returned from Gemini');
    }

    const binary = atob(base64Audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    return {
      blob: createWavBlob(bytes, 24000),
      pcm: bytes
    };
  } catch (error) {
    console.error('Error generating speech:', error);
    throw error;
  }
}

// Helper: Wrap raw PCM in a WAV header
export function createWavBlob(pcmData: Uint8Array, sampleRate: number) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + pcmData.length, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // channel count (1 for mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, pcmData.length, true);

  return new Blob([header, pcmData], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
