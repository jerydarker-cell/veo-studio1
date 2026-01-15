
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GeminiService, decodeBase64, decodeAudioData, encodeBase64 } from '../services/geminiService';
import { Modality } from '@google/genai';

const LiveTalk: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [status, setStatus] = useState('Tap to begin voice interaction');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const cleanup = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current = null;
    }
    setIsSessionActive(false);
    setStatus('Session ended');
    
    activeSourcesRef.current.forEach(source => source.stop());
    activeSourcesRef.current.clear();
  }, []);

  const startSession = async () => {
    try {
      setStatus('Connecting to Native Audio Core...');
      
      const gemini = GeminiService.getInstance();
      const ai = gemini.getAI();
      
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsSessionActive(true);
            setStatus('OmniGen Voice is listening...');
          },
          onmessage: async (message: any) => {
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              setTranscription(prev => [...prev, `AI: ${text}`]);
            }
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              setTranscription(prev => [...prev, `You: ${text}`]);
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              const audioData = decodeBase64(base64Audio);
              const buffer = await decodeAudioData(audioData, ctx, 24000, 1);
              
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.addEventListener('ended', () => {
                activeSourcesRef.current.delete(source);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              activeSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(s => s.stop());
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error(e);
            setStatus('Connection error. Retrying...');
            cleanup();
          },
          onclose: () => {
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
          systemInstruction: 'You are OmniGen, a helpful and high-performance AI voice assistant. Speak naturally, concisely, and keep the user engaged.'
        }
      });

      sessionRef.current = await sessionPromise;
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const l = inputData.length;
        const int16 = new Int16Array(l);
        for (let i = 0; i < l; i++) {
          int16[i] = inputData[i] * 32768;
        }
        
        // CRITICAL: Always use sessionPromise to send data to avoid race conditions and stale closures
        sessionPromise.then((session) => {
          session.sendRealtimeInput({
            media: {
              data: encodeBase64(new Uint8Array(int16.buffer)),
              mimeType: 'audio/pcm;rate=16000'
            }
          });
        });
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

    } catch (err) {
      console.error(err);
      setStatus('Microphone access or connection failed.');
    }
  };

  const stopSession = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    cleanup();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="glass-morphism p-12 rounded-[40px] border-slate-700 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
        {/* Animated Background Glow */}
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full transition-all duration-1000 ${isSessionActive ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`}></div>

        <div className="relative z-10">
          <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-8 transition-all duration-500 mx-auto ${
            isSessionActive 
              ? 'bg-blue-600 shadow-[0_0_50px_rgba(37,99,235,0.4)] animate-pulse' 
              : 'bg-slate-800'
          }`}>
            <i className={`fa-solid ${isSessionActive ? 'fa-waveform-lines' : 'fa-microphone'} text-5xl text-white`}></i>
          </div>

          <h2 className="text-2xl font-bold mb-2">
            {isSessionActive ? 'Assistant Active' : 'Voice Interaction'}
          </h2>
          <p className="text-slate-500 mb-10 h-6">{status}</p>

          <button
            onClick={isSessionActive ? stopSession : startSession}
            className={`px-12 py-4 rounded-2xl font-extrabold text-lg transition-all transform active:scale-95 ${
              isSessionActive 
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50 hover:bg-red-500/30' 
                : 'bg-blue-600 text-white hover:bg-blue-500 shadow-xl hover:shadow-blue-600/20'
            }`}
          >
            {isSessionActive ? 'Stop Session' : 'Start Talking'}
          </button>
        </div>
      </div>

      <div className="glass-morphism p-6 rounded-3xl border-slate-700 min-h-[200px] max-h-[400px] overflow-y-auto custom-scrollbar flex flex-col-reverse">
        <div className="space-y-4">
          {transcription.length > 0 ? (
            transcription.map((line, i) => (
              <div key={i} className={`p-3 rounded-xl text-sm ${line.startsWith('You:') ? 'bg-blue-500/10 text-blue-300 ml-12 text-right' : 'bg-slate-800/50 text-slate-300 mr-12'}`}>
                {line}
              </div>
            ))
          ) : (
            <p className="text-center text-slate-600 italic">Conversation transcript will appear here...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveTalk;
