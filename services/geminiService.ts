
import { GoogleGenAI, Type, Modality } from "@google/genai";

export interface ImageData {
  data: string;
  mimeType: string;
}

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result?.toString().split(',')[1];
      if (base64) resolve(base64);
      else reject(new Error("Cannot convert file to base64"));
    };
    reader.onerror = error => reject(error);
  });
};

export const fileToImageData = async (file: File): Promise<ImageData> => {
  const data = await fileToBase64(file);
  return { data, mimeType: file.type };
};

export function encodeBase64(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export class GeminiService {
  private static instance: GeminiService;
  private constructor() {}

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Cơ chế retry nâng cao:
   * 429 (Quota): Chờ lâu hơn vì thường là giới hạn phút/ngày.
   * 500/503/504: Chờ ngắn hơn để thử lại ngay.
   */
  private async withRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 10000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const isQuotaError = error?.status === 429 || error?.code === 429 || error?.message?.includes("quota") || error?.message?.includes("429") || error?.statusText?.includes("Too Many Requests");
      const isServerError = error?.status >= 500 || error?.code >= 500;

      if ((isQuotaError || isServerError) && retries > 0) {
        // Tăng thời gian chờ cho lỗi Quota (Exponential backoff mạnh hơn)
        const backoffDelay = isQuotaError ? initialDelay * (4 - retries) : initialDelay;
        console.warn(`Đang thử lại sau ${backoffDelay}ms do lỗi ${error?.status || 'API Quota'}... (Còn ${retries} lần thử)`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return this.withRetry(fn, retries - 1, backoffDelay * 1.5);
      }
      throw error;
    }
  }

  async generateInitialVideo(prompt: string, images: ImageData[], useFast = false) {
    const ai = this.getAI();
    return await this.withRetry(async () => {
      const model = useFast ? 'veo-3.1-fast-generate-preview' : 'veo-3.1-generate-preview';
      const params: any = {
        model: model,
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '9:16'
        }
      };

      if (images.length === 1) {
        params.image = { imageBytes: images[0].data, mimeType: images[0].mimeType };
      } else if (images.length > 1) {
        params.config.referenceImages = images.slice(0, 3).map(img => ({
          image: { imageBytes: img.data, mimeType: img.mimeType },
          referenceType: 'ASSET'
        }));
        params.config.aspectRatio = '16:9';
      }

      const op = await ai.models.generateVideos(params);
      return { op, usedAspectRatio: params.config.aspectRatio };
    });
  }

  async extendVideo(previousOp: any, prompt: string, aspectRatio: string) {
    const ai = this.getAI();
    const video = previousOp.response?.generatedVideos?.[0]?.video;
    if (!video) throw new Error("Không tìm thấy dữ liệu video để mở rộng.");

    return await this.withRetry(() => ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt,
      video,
      config: { 
        numberOfVideos: 1, 
        resolution: '720p', 
        aspectRatio: aspectRatio as any 
      }
    }));
  }

  async pollVideoOperation(operation: any) {
    const ai = this.getAI();
    return await this.withRetry(() => ai.operations.getVideosOperation({ operation }));
  }

  async generateVoiceover(text: string) {
    const ai = this.getAI();
    return await this.withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Đọc văn bản sau với giọng nam chuyên nghiệp, truyền cảm: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
        }
      }
    }));
  }

  async generateImage(prompt: string, aspectRatio: string, imageSize: string) {
    const ai = this.getAI();
    const model = (imageSize === '2K' || imageSize === '4K') ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
    return await this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: imageSize as any
          }
        }
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      throw new Error("Không thể tạo hình ảnh.");
    });
  }

  async editImage(base64: string, prompt: string) {
    const ai = this.getAI();
    return await this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: 'image/png' } },
            { text: prompt }
          ]
        }
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
      throw new Error("Không thể chỉnh sửa hình ảnh.");
    });
  }

  async analyzeMedia(prompt: string, base64: string, mimeType: string) {
    const ai = this.getAI();
    return await this.withRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: prompt }
          ]
        }
      });
      return response.text;
    });
  }

  async chat(message: string, thinking: boolean, search: boolean, maps: boolean) {
    const ai = this.getAI();
    const tools: any[] = [];
    if (search) tools.push({ googleSearch: {} });
    if (maps) tools.push({ googleMaps: {} });
    
    const model = maps ? 'gemini-2.5-flash' : (thinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview');
    
    return await this.withRetry(() => ai.models.generateContent({
      model,
      contents: message,
      config: {
        tools: tools.length > 0 ? tools : undefined,
        thinkingConfig: thinking ? { thinkingBudget: 32768 } : undefined
      }
    }));
  }
}
