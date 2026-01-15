
import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import VideoStudio from './sections/VideoStudio';
import ImageLab from './sections/ImageLab';
import InsightChat from './sections/InsightChat';
import Analyzer from './sections/Analyzer';
import LiveTalk from './sections/LiveTalk';
import { AppTab } from './types';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.VIDEO);
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const checkApiKey = async () => {
      // @ts-ignore
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelection = async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    setHasApiKey(true);
  };

  if (!hasApiKey && (activeTab === AppTab.VIDEO || activeTab === AppTab.VOICE)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950">
        <div className="glass-morphism p-10 rounded-[40px] max-w-md w-full text-center border-slate-700 shadow-2xl">
          <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-key text-blue-500 text-3xl"></i>
          </div>
          <h1 className="text-3xl font-black mb-4 gradient-text">Tính năng Cao cấp</h1>
          <p className="text-slate-400 mb-8 leading-relaxed text-sm">
            Mô hình Veo 3.1 yêu cầu API Key trả phí để hoạt động. Vui lòng chọn dự án có kích hoạt thanh toán để tiếp tục.
          </p>
          <button
            onClick={handleOpenKeySelection}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-5 rounded-2xl hover:opacity-90 transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95 uppercase text-xs tracking-widest"
          >
            Chọn API Key
          </button>
          <p className="mt-6 text-[10px] text-slate-500">
            Xem thêm tại <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-blue-400 underline">tài liệu thanh toán</a>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 pb-24 md:pb-0 md:ml-20 overflow-y-auto h-screen custom-scrollbar">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          <header className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight md:text-5xl gradient-text uppercase">
                {activeTab === AppTab.VIDEO && 'Sản xuất Motion'}
                {activeTab === AppTab.IMAGE && 'Xưởng Hình ảnh'}
                {activeTab === AppTab.CHAT && 'Trò chuyện Insight'}
                {activeTab === AppTab.ANALYZE && 'Phân tích Đa phương thức'}
                {activeTab === AppTab.VOICE && 'Live Talk'}
              </h1>
              <p className="text-slate-500 mt-2 text-sm font-medium">
                {activeTab === AppTab.VIDEO && 'Tạo video người thật AI 20 giây siêu thực với Veo 3.1.'}
                {activeTab === AppTab.IMAGE && 'Sáng tạo hình ảnh độ phân giải cao 4K với Nano Banana Pro.'}
                {activeTab === AppTab.CHAT && 'Trí tuệ nhân tạo chuyên sâu với khả năng tìm kiếm Google thời gian thực.'}
                {activeTab === AppTab.ANALYZE && 'Hiểu sâu nội dung video và hình ảnh bằng Gemini 3 Pro.'}
                {activeTab === AppTab.VOICE && 'Đối thoại giọng nói tự nhiên, độ trễ thấp với mô hình Native Audio.'}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-full border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-2"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-3">Hệ thống Trực tuyến</span>
            </div>
          </header>

          <div className="animate-fadeIn">
            {activeTab === AppTab.VIDEO && <VideoStudio />}
            {activeTab === AppTab.IMAGE && <ImageLab />}
            {activeTab === AppTab.CHAT && <InsightChat />}
            {activeTab === AppTab.ANALYZE && <Analyzer />}
            {activeTab === AppTab.VOICE && <LiveTalk />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
