import React from 'react';
import { Home, BarChart2, Settings as SettingsIcon } from 'lucide-react';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';

export default function BottomNavBar({ activeTab, onSelectTab }) {
  const { isSpanish } = useSiteLanguage();

  return (
    <div className="fixed bottom-3 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
      <nav
        aria-label="Bottom Navigation"
        className="pointer-events-auto flex items-center justify-around gap-2 px-5 py-2 rounded-full bg-white/80 dark:bg-[#1a0904]/85 backdrop-blur-2xl border border-stone-200/70 dark:border-[#421b12]/80 shadow-2xl shadow-black/20 dark:shadow-black/60 max-w-xs w-full transition-all"
      >
        {/* Item 1: Inicio */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-full text-xs transition-all cursor-pointer active:scale-95 ${
            activeTab === 'home'
              ? 'text-rose-600 dark:text-rose-400 bg-rose-500/15 dark:bg-rose-500/20 font-semibold shadow-xs'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-500/10'
          }`}
          title={isSpanish ? 'Ir a Inicio' : 'Go to Home'}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] font-bold">{isSpanish ? 'Inicio' : 'Home'}</span>
        </button>

        {/* Item 2: Progreso */}
        <button
          type="button"
          onClick={() => onSelectTab('habits')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-full text-xs transition-all cursor-pointer active:scale-95 ${
            activeTab === 'habits'
              ? 'text-rose-600 dark:text-rose-400 bg-rose-500/15 dark:bg-rose-500/20 font-semibold shadow-xs'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-500/10'
          }`}
          title={isSpanish ? 'Ir a Progreso' : 'Go to Progress'}
        >
          <BarChart2 className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] font-medium">{isSpanish ? 'Progreso' : 'Progress'}</span>
        </button>

        {/* Item 3: Ajustes */}
        <button
          type="button"
          onClick={() => onSelectTab('settings')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-full text-xs transition-all cursor-pointer active:scale-95 ${
            activeTab === 'settings'
              ? 'text-rose-600 dark:text-rose-400 bg-rose-500/15 dark:bg-rose-500/20 font-semibold shadow-xs'
              : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-500/10'
          }`}
          title={isSpanish ? 'Ir a Ajustes' : 'Go to Settings'}
        >
          <SettingsIcon className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] font-medium">{isSpanish ? 'Ajustes' : 'Settings'}</span>
        </button>
      </nav>
    </div>
  );
}
