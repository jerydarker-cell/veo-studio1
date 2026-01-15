
import React from 'react';
import { AppTab } from '../types';

interface NavigationProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: AppTab.VIDEO, label: 'Video AI', icon: 'fa-film' },
    { id: AppTab.IMAGE, label: 'Ảnh Lab', icon: 'fa-wand-magic-sparkles' },
    { id: AppTab.CHAT, label: 'Chat AI', icon: 'fa-brain' },
    { id: AppTab.ANALYZE, label: 'Phân tích', icon: 'fa-magnifying-glass-chart' },
    { id: AppTab.VOICE, label: 'Đối thoại', icon: 'fa-microphone' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full glass-morphism border-t border-slate-700/50 px-4 py-2 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:flex-col md:w-20 md:h-full md:border-t-0 md:border-r">
      <div className="hidden md:flex flex-col items-center mb-10 pt-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center mb-2 shadow-lg shadow-blue-500/20">
          <i className="fa-solid fa-om text-white text-2xl"></i>
        </div>
        <span className="text-[8px] font-black text-slate-500 uppercase">OmniGen</span>
      </div>
      
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex flex-col items-center gap-1 transition-all duration-300 p-2 rounded-xl group relative ${
            activeTab === tab.id ? 'text-blue-400' : 'text-slate-500 hover:text-slate-200'
          }`}
        >
          <div className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 ${
            activeTab === tab.id ? 'bg-blue-500/20 border border-blue-500/30' : 'group-hover:bg-slate-700/50'
          }`}>
            <i className={`fa-solid ${tab.icon} text-lg`}></i>
          </div>
          <span className="text-[9px] font-black uppercase md:hidden">{tab.label}</span>
          
          <div className={`absolute left-0 w-1 h-8 bg-blue-500 rounded-r-full hidden md:block transition-all duration-300 ${
            activeTab === tab.id ? 'opacity-100' : 'opacity-0'
          }`} style={{ left: '-4px' }}></div>
          
          {/* Tooltip cho Desktop */}
          <div className="absolute left-16 px-3 py-1 bg-slate-800 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block whitespace-nowrap z-50 shadow-xl border border-slate-700">
            {tab.label}
          </div>
        </button>
      ))}
    </nav>
  );
};

export default Navigation;
