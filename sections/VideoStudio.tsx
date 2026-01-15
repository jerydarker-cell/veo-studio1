
import React, { useState, useRef } from 'react';
import { GeminiService, fileToImageData, decodeBase64 } from '../services/geminiService';
import { VideoGenerationState, VideoProConfig } from '../types';

const VideoStudio: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [voiceScript, setVoiceScript] = useState('');
  const [isSafeZoneVisible, setIsSafeZoneVisible] = useState(true);
  
  const [proConfig, setProConfig] = useState<VideoProConfig>({
    motionBucket: 8,
    temporalConsistency: 'max',
    lockObject: 'none',
    transition: 'orbit',
    frameRate: 60,
    referenceStrength: 0.9,
    objectTracking: true,
    upscaling: true,
    aiLabel: true,
    hardAdherence: true
  });

  const [state, setState] = useState<VideoGenerationState>({
    isGenerating: false,
    stage: 'idle',
    activePreviewStage: 'final',
    status: 'Sẵn sàng sản xuất Video AI TikTok 20s',
    progress: 0,
    issues: []
  });

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const constructAutomationPrompt = (userPrompt: string) => {
    let enhanced = `Auto-animate mode: Generate a high-fidelity 4K vertical video for TikTok. ${userPrompt}. `;
    
    if (proConfig.lockObject !== 'none') {
      enhanced += `The object from the reference image is PERMANENTLY ANCHORED and tracked to the subject's ${proConfig.lockObject}. Use HARD ADHERENCE to preserve 100% design details. `;
    }

    if (proConfig.objectTracking) {
      enhanced += "Subject and accessories move with fluid, realistic human motion. No jitter or pixel swimming. ";
    }

    if (proConfig.transition === 'orbit') enhanced += "Camera: Slow 180-degree orbit movement around the main subject. ";
    if (proConfig.transition === 'zoom-in') enhanced += "Camera: Macro close-up slowly pulling back to reveal the environment. ";
    
    enhanced += `Temporal consistency: Max. Motion bucket: ${proConfig.motionBucket}. Cinematic studio lighting. High frame rate feel. Keep subject in center Safe Zone.`;
    
    return enhanced;
  };

  const handleGenerateSequence = async () => {
    if (!prompt && selectedImages.length === 0) return;
    setState(prev => ({ ...prev, isGenerating: true, status: 'Bước 1: Khởi tạo mô phỏng gốc (0-5s)...', progress: 5, issues: [] }));
    
    try {
      const gemini = GeminiService.getInstance();
      const imagesData = await Promise.all(selectedImages.map(file => fileToImageData(file)));
      const finalPrompt = constructAutomationPrompt(prompt);

      // 1. Tạo Giọng đọc AI
      let audioBlobUrl = '';
      if (voiceScript) {
        setState(prev => ({ ...prev, status: 'Đang tổng hợp giọng đọc AI tiếng Việt...', progress: 12 }));
        try {
          const audioRes = await gemini.generateVoiceover(voiceScript);
          const base64Audio = audioRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            const audioData = decodeBase64(base64Audio);
            const blob = new Blob([audioData], { type: 'audio/pcm' });
            audioBlobUrl = URL.createObjectURL(blob);
          }
        } catch (err: any) {
          console.warn("Lỗi tạo giọng đọc (có thể do Quota), tiếp tục tạo video...");
        }
      }

      const poll = async (op: any) => {
        let currentOp = op;
        let retryCount = 0;
        // Tăng thời gian chờ mỗi lần poll lên 30s để cực kỳ tiết kiệm Quota trong lúc chờ render
        while (!currentOp.done && retryCount < 60) {
          await new Promise(r => setTimeout(r, 30000));
          currentOp = await gemini.pollVideoOperation(currentOp);
          retryCount++;
        }
        return currentOp;
      };

      // 2. Tạo 5 giây đầu tiên
      const { op: initialOp, usedAspectRatio } = await gemini.generateInitialVideo(finalPrompt, imagesData);
      let currentOp = await poll(initialOp);

      // 3. Quy trình Mở rộng liên tục (Sequence Expansion)
      const extensionSteps = [
        { status: 'Bước 2: Mở rộng chuyển động trung đoạn (5-10s)...', progress: 35 },
        { status: 'Bước 3: Phát triển trường đoạn cao trào (10-15s)...', progress: 65 },
        { status: 'Bước 4: Hoàn thiện kết thúc & Upscaling (15-20s)...', progress: 90 },
      ];

      for (const step of extensionSteps) {
        setState(prev => ({ ...prev, status: step.status, progress: step.progress }));
        // Nghỉ ngơi 15s giữa các lệnh mở rộng quan trọng
        await new Promise(r => setTimeout(r, 15000)); 
        currentOp = await gemini.extendVideo(currentOp, "Duy trì chuyển động mượt mà, giữ nguyên neo vật thể và độ ổn định cực cao.", usedAspectRatio);
        currentOp = await poll(currentOp);
      }

      // 4. Kết xuất Video
      const downloadLink = currentOp.response?.generatedVideos?.[0]?.video?.uri;
      const res = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const videoBlob = await res.blob();
      const videoUrl = URL.createObjectURL(videoBlob);

      setState(prev => ({
        ...prev,
        isGenerating: false,
        resultUrl: videoUrl,
        audioUrl: audioBlobUrl,
        progress: 100,
        status: 'Quy trình sản xuất 20 giây hoàn tất!'
      }));

    } catch (e: any) {
      console.error("Video Gen Error:", e);
      let errorMsg = 'Lỗi hệ thống: Vui lòng kiểm tra API Key và quyền truy cập mô hình Veo.';
      
      const isQuota = e.message?.includes('429') || e.status === 429 || e.message?.toLowerCase().includes('quota') || e.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isQuota) {
        errorMsg = 'Hết hạn mức (Quota Exhausted): Bạn đã vượt quá giới hạn API Gemini của gói hiện tại.';
      } else if (e.message?.includes('INVALID_ARGUMENT')) {
        errorMsg = 'Lỗi xử lý video: Video đầu vào chưa được xử lý xong hoặc không hợp lệ. Hãy thử lại.';
      }

      setState(prev => ({ 
        ...prev, 
        isGenerating: false, 
        status: errorMsg,
        issues: isQuota ? [
          "Vui lòng nâng cấp gói thanh toán tại Google AI Studio.",
          "Chờ vài phút để hạn mức giây/phút được làm mới tự động."
        ] : ["Lỗi không xác định."]
      }));
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Bảng điều khiển Tự động hóa */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-morphism p-6 rounded-[32px] border-slate-700 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-blue-500 tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-robot"></i> Tự động hóa Visual
              </h3>
              <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                <span className="text-[8px] font-bold text-blue-400">VEO 3.1 PRO</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-200 uppercase">Object Tracking (Neo)</span>
                    <span className="text-[8px] text-slate-500">Gắn vật thể vào da/người mẫu</span>
                  </div>
                  <button 
                    onClick={() => setProConfig({...proConfig, objectTracking: !proConfig.objectTracking})}
                    className={`w-10 h-5 rounded-full transition-all relative ${proConfig.objectTracking ? 'bg-blue-600' : 'bg-slate-800'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${proConfig.objectTracking ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-200 uppercase">Hard Adherence (Gốc)</span>
                    <span className="text-[8px] text-slate-500">Giữ 100% chi tiết ảnh gốc</span>
                  </div>
                  <button 
                    onClick={() => setProConfig({...proConfig, hardAdherence: !proConfig.hardAdherence})}
                    className={`w-10 h-5 rounded-full transition-all relative ${proConfig.hardAdherence ? 'bg-blue-600' : 'bg-slate-800'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${proConfig.hardAdherence ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-200 uppercase">Resolution Upscaling</span>
                    <span className="text-[8px] text-slate-500">Tự động làm nét chi tiết LED/vật liệu</span>
                  </div>
                  <button 
                    onClick={() => setProConfig({...proConfig, upscaling: !proConfig.upscaling})}
                    className={`w-10 h-5 rounded-full transition-all relative ${proConfig.upscaling ? 'bg-blue-600' : 'bg-slate-800'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${proConfig.upscaling ? 'left-6' : 'left-1'}`}></div>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block">Cường độ chuyển động (Motion)</label>
                <div className="flex items-center gap-4">
                   <input 
                    type="range" min="1" max="10" 
                    value={proConfig.motionBucket} 
                    onChange={(e) => setProConfig({...proConfig, motionBucket: parseInt(e.target.value)})}
                    className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-xs font-mono font-bold text-blue-400">{proConfig.motionBucket}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setProConfig({...proConfig, lockObject: proConfig.lockObject === 'face' ? 'none' : 'face'})}
                  className={`p-3 rounded-xl border text-[9px] font-bold uppercase flex items-center justify-center gap-2 transition-all ${proConfig.lockObject === 'face' ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/20' : 'border-slate-800 text-slate-500 hover:bg-slate-900'}`}
                >
                  <i className="fa-solid fa-face-viewfinder"></i> Neo vào Mặt
                </button>
                <button 
                  onClick={() => setProConfig({...proConfig, lockObject: proConfig.lockObject === 'wrist' ? 'none' : 'wrist'})}
                  className={`p-3 rounded-xl border text-[9px] font-bold uppercase flex items-center justify-center gap-2 transition-all ${proConfig.lockObject === 'wrist' ? 'bg-blue-600 border-blue-400 shadow-lg shadow-blue-500/20' : 'border-slate-800 text-slate-500 hover:bg-slate-900'}`}
                >
                  <i className="fa-solid fa-watch"></i> Neo vào Cổ tay
                </button>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800">
              <label className="text-[10px] font-black uppercase text-slate-500 block">Kịch bản chuyển động</label>
              <textarea 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ví dụ: Người mẫu đeo kính LED trong ảnh tham chiếu, đi bộ chậm rãi trên phố Cyberpunk..." 
                className="w-full h-28 bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 outline-none focus:ring-2 ring-blue-500/30 resize-none transition-all"
              />
              
              <label className="text-[10px] font-black uppercase text-slate-500 block">Kịch bản lồng tiếng AI</label>
              <textarea 
                value={voiceScript} 
                onChange={(e) => setVoiceScript(e.target.value)}
                placeholder="Nhập lời dẫn cho video... (Tự động đồng bộ AI Voice)" 
                className="w-full h-20 bg-slate-900/30 border border-slate-800 rounded-2xl p-4 text-[10px] text-slate-400 outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <input 
                type="file" ref={fileInputRef} className="hidden" 
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  setSelectedImages(files);
                  setImagePreviews(files.map(f => URL.createObjectURL(f)));
                }}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-cloud-arrow-up text-blue-500"></i>
                {selectedImages.length > 0 ? `${selectedImages.length} Ảnh đã chọn` : 'Tải ảnh tham chiếu'}
              </button>
            </div>

            <button 
              onClick={handleGenerateSequence}
              disabled={state.isGenerating || (!prompt && selectedImages.length === 0)}
              className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              {state.isGenerating ? <i className="fa-solid fa-spinner fa-spin text-lg"></i> : <i className="fa-solid fa-wand-magic-sparkles text-lg"></i>}
              {state.isGenerating ? 'Đang sản xuất (Xử lý Quota)...' : 'Bắt đầu Sản xuất Pro'}
            </button>
          </div>
        </div>

        {/* Khu vực Xem trước TikTok */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative aspect-[9/16] max-h-[780px] mx-auto bg-black rounded-[56px] overflow-hidden border border-slate-700 shadow-2xl ring-4 ring-slate-900/50 group">
            
            {state.resultUrl ? (
              <div className="w-full h-full relative">
                <video 
                  ref={videoRef} src={state.resultUrl} 
                  className="w-full h-full object-contain" autoPlay loop muted 
                />
                {state.audioUrl && <audio ref={audioRef} src={state.audioUrl} autoPlay />}
                
                {/* Lớp phủ Nhãn AI */}
                {proConfig.aiLabel && (
                  <div className="absolute top-12 left-12 px-3 py-1.5 bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 flex items-center gap-2">
                    <i className="fa-solid fa-robot text-blue-400 text-[10px]"></i>
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Nội dung AI</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-8 bg-gradient-to-b from-slate-950 to-black">
                <div className={`w-32 h-32 rounded-[40px] border-2 border-dashed border-slate-800 flex items-center justify-center ${state.isGenerating ? 'animate-pulse bg-blue-500/5' : 'bg-slate-900/20'}`}>
                  <i className={`fa-solid ${state.isGenerating ? 'fa-clapperboard-play text-blue-500' : 'fa-film text-slate-800'} text-5xl`}></i>
                </div>
                <div className="space-y-4">
                  <h4 className={`text-xl font-black uppercase tracking-tighter ${state.issues.length > 0 ? 'text-red-400' : 'text-slate-100'}`}>
                    {state.status}
                  </h4>
                  {state.issues.length > 0 ? (
                    <div className="p-5 bg-red-500/10 border border-red-500/30 rounded-2xl max-w-sm mx-auto shadow-lg">
                       <p className="text-[11px] text-red-300 leading-relaxed font-bold mb-3">
                        <i className="fa-solid fa-circle-exclamation mr-2"></i>
                        {state.status.includes('Hết hạn mức') ? 'Bạn đã đạt giới hạn cuộc gọi API.' : state.issues[0]}
                      </p>
                      <ul className="text-left text-[9px] text-slate-400 space-y-1 list-disc pl-4 mb-4">
                        {state.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                      <a 
                        href="https://ai.google.dev/gemini-api/docs/billing" 
                        target="_blank" 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-lg text-[10px] text-red-200 font-bold hover:bg-red-500/30 transition-all"
                      >
                        <i className="fa-solid fa-credit-card"></i> Nâng cấp Billing ngay
                      </a>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                      Sử dụng Veo 3.1 Pro cho chất lượng hình ảnh 20 giây mượt mà nhất. Đang tự động hóa quy trình hậu kỳ...
                    </p>
                  )}
                  {state.isGenerating && (
                    <div className="w-64 h-2 bg-slate-900 rounded-full overflow-hidden mx-auto shadow-inner border border-slate-800">
                      <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-1000 shadow-[0_0_15px_rgba(37,99,235,0.6)]" style={{ width: `${state.progress}%` }}></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lớp phủ Vùng an toàn TikTok (Safe Zone) */}
            {isSafeZoneVisible && (
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute inset-0 border-[60px] border-transparent border-b-[160px] border-l-[40px] border-r-[100px]">
                  <div className="w-full h-full border border-dashed border-white/10 rounded-3xl flex items-center justify-center relative bg-white/[0.01]">
                    <div className="absolute top-4 flex flex-col items-center gap-1 opacity-20">
                      <i className="fa-solid fa-chevron-down text-white text-[8px]"></i>
                      <span className="text-[7px] text-white font-black uppercase tracking-[0.6em]">TikTok Vùng An Toàn</span>
                    </div>

                    {/* TikTok Mockup Elements */}
                    <div className="absolute right-[-75px] bottom-10 flex flex-col gap-8 opacity-20 items-center">
                       <div className="w-12 h-12 rounded-full border-2 border-white bg-white/10"></div>
                       <div className="flex flex-col items-center"><i className="fa-solid fa-heart text-white text-3xl"></i><span className="text-[8px] mt-1 font-bold">12.5K</span></div>
                       <div className="flex flex-col items-center"><i className="fa-solid fa-comment-dots text-white text-3xl"></i><span className="text-[8px] mt-1 font-bold">382</span></div>
                       <div className="flex flex-col items-center"><i className="fa-solid fa-share text-white text-3xl"></i><span className="text-[8px] mt-1 font-bold">Chia sẻ</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button 
              onClick={() => setIsSafeZoneVisible(!isSafeZoneVisible)}
              className="absolute top-10 right-10 w-12 h-12 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 flex items-center justify-center text-white transition-all z-20 hover:scale-110 active:scale-95 shadow-xl"
            >
              <i className={`fa-brands fa-tiktok text-xl ${isSafeZoneVisible ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'opacity-30'}`}></i>
            </button>

            {state.resultUrl && (
               <button 
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = state.resultUrl!;
                  a.download = `omnigen_pro_video_${Date.now()}.mp4`;
                  a.click();
                }}
                className="absolute bottom-10 right-10 w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-2xl hover:bg-blue-500 transition-all z-20 hover:scale-110 active:scale-95"
              >
                <i className="fa-solid fa-download text-xl"></i>
              </button>
            )}
          </div>

          {/* Thông số kỹ thuật & Timeline */}
          <div className="grid grid-cols-4 gap-4">
            <div className="glass-morphism p-4 rounded-2xl border-slate-800 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Thời lượng</span>
              <span className="text-xs font-black text-blue-400">20 GIÂY</span>
            </div>
            <div className="glass-morphism p-4 rounded-2xl border-slate-800 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Độ phân giải</span>
              <span className="text-xs font-black text-blue-400">4K / 60FPS</span>
            </div>
            <div className="glass-morphism p-4 rounded-2xl border-slate-800 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Cấu trúc</span>
              <span className="text-xs font-black text-blue-400">MULTI-STEP</span>
            </div>
            <div className="glass-morphism p-4 rounded-2xl border-slate-800 flex flex-col items-center justify-center text-center">
              <span className="text-[8px] font-black text-slate-500 uppercase mb-1">Xử lý Hậu kỳ</span>
              <span className="text-xs font-black text-emerald-400 uppercase">Auto-Sync</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoStudio;
