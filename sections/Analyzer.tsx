
import React, { useState, useRef } from 'react';
import { GeminiService, fileToBase64 } from '../services/geminiService';

const Analyzer: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState('');
  const [prompt, setPrompt] = useState('Explain what is happening in this media in detail. Identify key objects, actions, and the overall mood.');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        setPreview(URL.createObjectURL(file));
      }
    }
  };

  const runAnalysis = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setAnalysis('');

    try {
      const base64 = await fileToBase64(selectedFile);
      const gemini = GeminiService.getInstance();
      const result = await gemini.analyzeMedia(prompt, base64, selectedFile.type);
      setAnalysis(result || "Analysis failed to produce text.");
    } catch (error) {
      console.error(error);
      setAnalysis("Error analyzing media. Ensure the file size is within limits (max 10MB recommended for prompt efficiency).");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="glass-morphism p-6 rounded-3xl border-slate-700">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <i className="fa-solid fa-file-import text-blue-500"></i> Media Input
          </h3>
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-video rounded-3xl border-2 border-dashed border-slate-700 hover:border-blue-500/50 transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-slate-900/20 relative"
          >
            {preview ? (
              selectedFile?.type.startsWith('video/') ? (
                <video src={preview} className="w-full h-full object-contain" controls muted />
              ) : (
                <img src={preview} className="w-full h-full object-contain" />
              )
            ) : (
              <div className="text-center p-8">
                <i className="fa-solid fa-cloud-arrow-up text-4xl text-slate-700 mb-4"></i>
                <p className="text-slate-500 font-medium">Upload Image or Video</p>
                <p className="text-xs text-slate-600 mt-2">Gemini 3 Pro will provide deep multimodal understanding</p>
              </div>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
          </div>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-400">Analysis Intent</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            />
            <button
              onClick={runAnalysis}
              disabled={!selectedFile || isAnalyzing}
              className="w-full py-4 bg-blue-600 rounded-2xl font-bold hover:bg-blue-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isAnalyzing ? <i className="fa-solid fa-scanner animate-pulse"></i> : <i className="fa-solid fa-magnifying-glass-chart"></i>}
              {isAnalyzing ? 'Processing Media Intelligence...' : 'Run Deep Analysis'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-morphism h-full p-8 rounded-3xl border-slate-700 flex flex-col">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            <i className="fa-solid fa-file-invoice text-green-500"></i> Insights Report
          </h3>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950/50 border border-slate-800/50 rounded-2xl p-6">
            {analysis ? (
              <div className="prose prose-invert max-w-none text-slate-300 whitespace-pre-wrap leading-loose text-sm">
                {analysis}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                <i className="fa-solid fa-microchip text-6xl mb-4"></i>
                <p>Waiting for analysis trigger...</p>
              </div>
            )}
          </div>

          {analysis && (
            <button 
              onClick={() => {
                const blob = new Blob([analysis], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'analysis-report.txt';
                link.click();
              }}
              className="mt-6 text-xs text-blue-400 font-bold hover:text-blue-300 transition-colors self-end flex items-center gap-2"
            >
              <i className="fa-solid fa-file-export"></i> Export Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analyzer;
