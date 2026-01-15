
import React, { useState, useEffect, useRef } from 'react';
import { GeminiService } from '../services/geminiService';
import { Message } from '../types';

const InsightChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [mapsEnabled, setMapsEnabled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const gemini = GeminiService.getInstance();
      const response = await gemini.chat(input, thinkingEnabled, searchEnabled, mapsEnabled);
      
      const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || chunk.maps?.title || 'Resource',
        uri: chunk.web?.uri || chunk.maps?.uri || '#'
      })) || [];

      const botMsg: Message = {
        role: 'model',
        text: response.text || "I couldn't generate a response.",
        timestamp: Date.now(),
        thinking: response.candidates?.[0]?.content?.parts?.find((p: any) => p.thought)?.text,
        groundingUrls: grounding
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        role: 'system',
        text: "System error: Connection to neural core lost. Please check project configuration.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[75vh] glass-morphism rounded-3xl border-slate-700 overflow-hidden relative">
      {/* Configuration Header */}
      <div className="p-4 border-b border-slate-700/50 bg-slate-900/40 flex flex-wrap items-center gap-4 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Tools:</span>
        </div>
        
        <button 
          onClick={() => setThinkingEnabled(!thinkingEnabled)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
            thinkingEnabled ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'border-slate-700 text-slate-500'
          }`}
        >
          <i className="fa-solid fa-brain"></i> Thinking Mode
        </button>

        <button 
          onClick={() => setSearchEnabled(!searchEnabled)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
            searchEnabled ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'border-slate-700 text-slate-500'
          }`}
        >
          <i className="fa-brands fa-google"></i> Search Grounding
        </button>

        <button 
          onClick={() => setMapsEnabled(!mapsEnabled)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
            mapsEnabled ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'border-slate-700 text-slate-500'
          }`}
        >
          <i className="fa-solid fa-location-dot"></i> Maps Grounding
        </button>
      </div>

      {/* Message List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <i className="fa-solid fa-comments text-7xl mb-4"></i>
            <p className="text-xl font-bold">Start a deep-thought conversation</p>
            <p className="text-sm">Ask about recent events or complex logic.</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-4 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : msg.role === 'system'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-slate-800 border border-slate-700 text-slate-200'
            }`}>
              {msg.thinking && (
                <div className="mb-4 p-3 bg-amber-500/5 border-l-2 border-amber-500/30 rounded-r-lg text-amber-400/80 text-[11px] font-mono leading-tight whitespace-pre-wrap">
                  <div className="flex items-center gap-2 mb-1 uppercase font-bold text-[9px]">
                    <i className="fa-solid fa-microchip"></i> Neural Processing Trace
                  </div>
                  {msg.thinking}
                </div>
              )}
              
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              
              {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-700/50">
                  <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Sources & Links</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.groundingUrls.map((url, uidx) => (
                      <a 
                        key={uidx} 
                        href={url.uri} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-2 py-1 bg-slate-900 rounded-md text-[10px] text-blue-400 hover:text-blue-300 transition-colors border border-slate-700"
                      >
                        <i className="fa-solid fa-link"></i>
                        {url.title.slice(0, 30)}{url.title.length > 30 ? '...' : ''}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              
              <div className={`text-[9px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 flex items-center gap-3">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
              </div>
              <span className="text-xs text-slate-400 italic">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900/50 border-t border-slate-700/50">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message..."
            className="flex-1 min-h-[50px] max-h-[150px] bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none custom-scrollbar"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white hover:bg-blue-500 disabled:opacity-50 transition-all flex-shrink-0"
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsightChat;
