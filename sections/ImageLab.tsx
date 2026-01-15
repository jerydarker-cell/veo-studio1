
import React, { useState, useRef } from 'react';
import { GeminiService, fileToBase64 } from '../services/geminiService';

const ImageLab: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fix: Removed 21:9 as it is not a supported aspect ratio for gemini-2.5/3 image models
  const aspectRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
  const imageSizes = ['1K', '2K', '4K'];

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsGenerating(true);
    try {
      const gemini = GeminiService.getInstance();
      if (editMode && resultImage) {
        // Remove data:image/png;base64, prefix
        const base64 = resultImage.split(',')[1];
        const edited = await gemini.editImage(base64, prompt);
        setResultImage(edited);
      } else {
        const generated = await gemini.generateImage(prompt, aspectRatio, imageSize);
        setResultImage(generated);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setResultImage(`data:image/png;base64,${base64}`);
      setEditMode(true);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-1 space-y-6">
        <div className="glass-morphism p-6 rounded-3xl border-slate-700">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <i className="fa-solid fa-sliders text-purple-500"></i> Settings
          </h3>
          
          <div className="space-y-6">
            {!editMode && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Quality</label>
                  <div className="grid grid-cols-3 gap-2">
                    {imageSizes.map(size => (
                      <button
                        key={size}
                        onClick={() => setImageSize(size)}
                        className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                          imageSize === size 
                            ? 'bg-purple-600/20 border-purple-500 text-purple-400' 
                            : 'border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">Aspect Ratio</label>
                  <div className="grid grid-cols-3 gap-2">
                    {aspectRatios.map(ratio => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-2 rounded-xl border text-[10px] font-bold transition-all ${
                          aspectRatio === ratio 
                            ? 'bg-purple-600/20 border-purple-500 text-purple-400' 
                            : 'border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <button 
                onClick={() => setEditMode(!editMode)}
                className={`w-full py-3 rounded-xl border-2 font-bold transition-all flex items-center justify-center gap-2 ${
                  editMode ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'border-slate-700 text-slate-400'
                }`}
              >
                <i className={`fa-solid ${editMode ? 'fa-pen-to-square' : 'fa-image'}`}></i>
                {editMode ? 'Edit Mode On' : 'Switch to Edit'}
              </button>
              <p className="text-[10px] text-slate-500 mt-2 text-center">
                {editMode ? "Provide text instructions like 'Add a beard' or 'Change background'" : "Generate images from scratch using Nano Banana Pro."}
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 rounded-xl border-2 border-slate-700 border-dashed text-slate-500 hover:border-slate-500 transition-all flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-upload"></i> Upload to Edit
            </button>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />
          </div>
        </div>
      </div>

      <div className="lg:col-span-3 space-y-6">
        <div className="glass-morphism p-6 rounded-3xl border-slate-700">
          <div className="flex flex-col gap-4">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={editMode ? "What should I change? (e.g., 'Make it look like a pencil sketch')" : "Describe your imagination... (e.g., 'Cyberpunk samurai in a rain-slicked Tokyo street')"}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-6 py-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt}
              className="w-full py-4 bg-purple-600 rounded-2xl font-bold hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? <i className="fa-solid fa-rotate animate-spin"></i> : <i className="fa-solid fa-sparkles"></i>}
              {isGenerating ? 'Synthesizing pixels...' : (editMode ? 'Apply Edit' : 'Generate Image')}
            </button>
          </div>
        </div>

        <div className="glass-morphism p-4 rounded-3xl border-slate-700 flex items-center justify-center bg-slate-900/20 min-h-[500px]">
          {resultImage ? (
            <div className="relative group max-w-full">
              <img src={resultImage} alt="Generated" className="rounded-2xl max-h-[70vh] shadow-2xl transition-transform duration-500 group-hover:scale-[1.01]" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-2xl pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-xs pointer-events-auto cursor-pointer" onClick={() => {
                  const link = document.createElement('a');
                  link.href = resultImage!;
                  link.download = 'omnigen-image.png';
                  link.click();
                }}>
                  <i className="fa-solid fa-download mr-2"></i> Download HQ
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <i className="fa-solid fa-palette text-6xl text-slate-800 mb-4"></i>
              <p className="text-slate-500">Your high-fidelity generation will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageLab;
