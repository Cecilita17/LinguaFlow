import React, { useEffect, useRef, useMemo } from 'react';
import { TranscriptLine } from './TranscriptLine.jsx';
import { FileText, SearchX } from 'lucide-react';
import { isGlossComplete } from '../../services/subtitleGlossService.js';

export function Transcript({
  subtitles = [],
  currentTime = 0,
  onSeek,
  onGloss = null,
  onGlossLine = null,
  glossingLineIds = null,
  loadingLineIds = null,
  autoScroll = true,
  fontSize = 'base',
  showTimestamps = true,
  searchQuery = '',
  interlinearMode = true,
  targetLang = 'zh',
  pendingScrollSubtitleId = null,
  onScrollComplete = null
}) {
  const containerRef = useRef(null);
  const activeLineRef = useRef(null);
  const userInteractingRef = useRef(false);
  const handleGloss = onGloss || onGlossLine;
  const activeGlossingIds = glossingLineIds || loadingLineIds;

  // 1. Identify active subtitle line based on currentTime
  const activeIndex = useMemo(() => {
    if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) return -1;
    const time = typeof currentTime === 'number' && !isNaN(currentTime) ? currentTime : 0;

    // Direct interval match
    const exactIdx = subtitles.findIndex((sub) => {
      if (!sub || typeof sub.startTime !== 'number') return false;
      const end = typeof sub.endTime === 'number' && sub.endTime > sub.startTime ? sub.endTime : sub.startTime + 4.0;
      return time >= sub.startTime && time <= end;
    });
    if (exactIdx !== -1) return exactIdx;

    // Closest preceding line
    for (let i = subtitles.length - 1; i >= 0; i--) {
      const sub = subtitles[i];
      if (sub && typeof sub.startTime === 'number' && time >= sub.startTime) {
        // Only if within 6 seconds
        if (time - sub.startTime <= 6.0) {
          return i;
        }
        break;
      }
    }

    return -1;
  }, [subtitles, currentTime]);

  // 2. Filter subtitles based on search query
  const filteredSubtitles = useMemo(() => {
    if (!subtitles || !Array.isArray(subtitles)) return [];
    const valid = subtitles.filter(s => s && typeof s === 'object' && s.text);
    if (!searchQuery || !searchQuery.trim()) {
      return valid;
    }
    const query = searchQuery.toLowerCase().trim();
    return valid.filter((sub) => (sub.text || '').toLowerCase().includes(query));
  }, [subtitles, searchQuery]);

  // 3. Smooth auto-scroll strictly within the transcript container (no page scrolling)
  useEffect(() => {
    if (!autoScroll || activeIndex === -1 || userInteractingRef.current) return;

    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const element = activeLineRef.current;
      const elemTop = element.offsetTop - container.offsetTop;
      const elemBottom = elemTop + element.clientHeight;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;

      if (elemTop < containerScrollTop || elemBottom > containerScrollTop + containerHeight) {
        container.scrollTo({
          top: Math.max(0, elemTop - containerHeight / 3),
          behavior: 'smooth'
        });
      }
    }
  }, [activeIndex, autoScroll]);

  // 4. Dedicated scroll to restored subtitle line (e.g. on library restoration)
  useEffect(() => {
    if (!pendingScrollSubtitleId || !containerRef.current) return;

    const timer = setTimeout(() => {
      const targetEl = containerRef.current?.querySelector(`[data-subtitle-id="${pendingScrollSubtitleId}"]`);
      if (targetEl && containerRef.current) {
        const container = containerRef.current;
        const elemTop = targetEl.offsetTop - container.offsetTop;
        const containerHeight = container.clientHeight;
        container.scrollTo({
          top: Math.max(0, elemTop - containerHeight / 3),
          behavior: 'smooth'
        });
        if (onScrollComplete) onScrollComplete();
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [pendingScrollSubtitleId, subtitles, onScrollComplete]);

  // Detect manual user scroll to avoid fighting the user
  const handleScroll = () => {
    userInteractingRef.current = true;
    if (window._userScrollTimeout) clearTimeout(window._userScrollTimeout);
    window._userScrollTimeout = setTimeout(() => {
      userInteractingRef.current = false;
    }, 2500);
  };

  if (!subtitles || subtitles.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-[#2b160f]/60 border border-[#482519] text-center flex flex-col items-center justify-center text-rose-300/60 my-auto">
        <FileText className="w-10 h-10 text-rose-400/50 mb-2" />
        <h4 className="text-sm font-bold text-rose-200 mb-1">Sin subtítulos cargados</h4>
        <p className="text-xs text-rose-300/70 max-w-sm">
          Pega el transcript o sube un archivo .srt, .vtt o .txt para ver la transcripción y seguir el vídeo en sincronía.
        </p>
      </div>
    );
  }

  if (filteredSubtitles.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-[#2b160f]/60 border border-[#482519] text-center flex flex-col items-center justify-center text-rose-300/60 my-auto">
        <SearchX className="w-8 h-8 text-rose-400 mb-2" />
        <h4 className="text-sm font-bold text-rose-200 mb-1">Sin coincidencias</h4>
        <p className="text-xs text-rose-300/70">
          No se encontraron líneas que coincidan con "{searchQuery}".
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 h-full min-h-0 overflow-y-auto pr-1 sm:pr-2 space-y-2 rounded-2xl custom-scrollbar touch-pan-y select-text pb-16"
    >
      {filteredSubtitles.map((line, idx) => {
        const isCurrentActive = subtitles[activeIndex]?.id === line.id;

        return (
          <div
            key={line.id || idx}
            data-subtitle-id={line.id}
            ref={isCurrentActive ? activeLineRef : null}
          >
            <TranscriptLine
              line={line}
              isActive={isCurrentActive}
              onSeek={onSeek}
              onGloss={handleGloss}
              onGlossLine={handleGloss}
              isGlossing={Boolean(activeGlossingIds && (activeGlossingIds instanceof Set ? activeGlossingIds.has(line.id) : activeGlossingIds[line.id]))}
              isGlossingThisLine={Boolean(activeGlossingIds && (activeGlossingIds instanceof Set ? activeGlossingIds.has(line.id) : activeGlossingIds[line.id]))}
              hasGloss={isGlossComplete(line, targetLang)}
              fontSize={fontSize}
              showTimestamps={showTimestamps}
              searchQuery={searchQuery}
              interlinearMode={interlinearMode}
              targetLang={targetLang}
            />
          </div>
        );
      })}
    </div>
  );
}

export default Transcript;
