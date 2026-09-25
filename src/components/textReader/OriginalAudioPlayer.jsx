import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Play, Pause, Volume2, AlertCircle, Loader2, Bookmark } from 'lucide-react';
import { API_BASE_URL } from '../../services/chatService.js';

function formatTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * OriginalAudioPlayer
 *
 * Isolated HTML5 audio player component for imported audio documents.
 * Conceptually equivalent to YouTubePlayer.jsx, but dedicated to native HTML5 audio.
 * Manages the HTMLAudioElement lifecycle, source loading, playback controls,
 * and renders an integrated, responsive player bar with play/pause, seekable progress,
 * and current/total duration indicators.
 */
export const OriginalAudioPlayer = forwardRef(function OriginalAudioPlayer({
  audioPathname,
  audioUrl = null,
  audioBlob = null,
  onReady = null,
  onTimeUpdate = null,
  onPlay = null,
  onPause = null,
  onEnded = null,
  onError = null,
  initialTime = 0,
  playbackRate = 1.0,
  isPlaying = false,
  onTogglePlay = null,
  onSaveBookmark = null,
  isBookmarked = false
}, ref) {
  const audioRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const [localCurrentTime, setLocalCurrentTime] = useState(initialTime || 0);
  const [isPlayingInternal, setIsPlayingInternal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [seekValue, setSeekValue] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const isSeekingRef = useRef(false);
  const initialSeekDoneRef = useRef(false);
  const [generatedBlobUrl, setGeneratedBlobUrl] = useState(null);

  const activeIsPlaying = typeof isPlaying === 'boolean' ? isPlaying : isPlayingInternal;

  // Manage object URL lifecycle if an audioBlob instance is provided
  useEffect(() => {
    if (audioBlob instanceof Blob) {
      const url = URL.createObjectURL(audioBlob);
      setGeneratedBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setGeneratedBlobUrl(null);
    }
  }, [audioBlob]);

  // Compute clean stream URL from generatedBlobUrl, audioUrl, or audioPathname
  const streamUrl = generatedBlobUrl || audioUrl || (audioPathname
    ? (audioPathname.startsWith('blob:') || audioPathname.startsWith('http:') || audioPathname.startsWith('https:') || audioPathname.startsWith('data:')
        ? audioPathname
        : `${API_BASE_URL || ''}/api/audio-stream?pathname=${encodeURIComponent(audioPathname)}`)
    : '');

  // Imperative handle exposed to parent via ref (equivalent to YouTube player methods)
  useImperativeHandle(ref, () => ({
    play: () => {
      const audio = audioRef.current;
      if (!audio) return;
      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch(err => {
          console.warn('[OriginalAudioPlayer] play() error:', err);
          if (onError) onError(err);
        });
      }
    },

    pause: () => {
      const audio = audioRef.current;
      if (!audio) return;
      try {
        audio.pause();
      } catch (e) {}
    },

    seek: (time) => {
      const audio = audioRef.current;
      if (!audio) return;
      const safeTime = Math.max(0, typeof time === 'number' && !isNaN(time) ? time : 0);
      try {
        audio.currentTime = safeTime;
        setLocalCurrentTime(safeTime);
      } catch (e) {
        console.warn('[OriginalAudioPlayer] seek error:', e);
      }
    },

    getCurrentTime: () => audioRef.current?.currentTime || 0,
    getDuration: () => audioRef.current?.duration || 0,
    isPlaying: () => Boolean(audioRef.current && !audioRef.current.paused && !audioRef.current.ended)
  }), [onError]);

  // Handle source changes & cleanup
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;

    initialSeekDoneRef.current = false;
    setIsLoading(true);
    setErrorMessage(null);
    console.log('[OriginalAudioPlayer] source=', streamUrl);
    audio.src = streamUrl;
    audio.playbackRate = typeof playbackRate === 'number' ? playbackRate : 1.0;
    audio.load();

    return () => {
      if (audio) {
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        } catch (e) {}
      }
    };
  }, [streamUrl]);

  // Handle playbackRate changes
  useEffect(() => {
    if (audioRef.current && typeof playbackRate === 'number') {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Event handlers for HTMLAudioElement
  const handleLoadedMetadata = useCallback((e) => {
    const audio = e.target;
    const dur = audio.duration || 0;
    setDuration(dur);
    setIsLoading(false);
    setErrorMessage(null);
    console.log('[OriginalAudioPlayer] loadedmetadata duration=', dur);

    // Initial seek to restored lastAudioPosition if specified, but stay paused
    if (!initialSeekDoneRef.current && typeof initialTime === 'number' && initialTime > 0) {
      initialSeekDoneRef.current = true;
      try {
        audio.currentTime = initialTime;
        setLocalCurrentTime(initialTime);
      } catch (err) {}
    }

    if (onReady) onReady({ duration: dur });
  }, [initialTime, onReady]);

  const handleTimeUpdate = useCallback((e) => {
    const current = e.target.currentTime || 0;
    if (!isSeekingRef.current && seekValue === null) {
      setLocalCurrentTime(current);
    }
    if (onTimeUpdate) onTimeUpdate(current);
  }, [onTimeUpdate, seekValue]);

  const handlePlay = useCallback(() => {
    console.log('[OriginalAudioPlayer] play');
    setIsPlayingInternal(true);
    setErrorMessage(null);
    if (onPlay) onPlay();
  }, [onPlay]);

  const handlePause = useCallback((e) => {
    const current = e.target.currentTime || 0;
    console.log('[OriginalAudioPlayer] pause time=', current);
    setIsPlayingInternal(false);
    if (!isSeekingRef.current && seekValue === null) {
      setLocalCurrentTime(current);
    }
    if (onPause) onPause(current);
  }, [onPause, seekValue]);

  const handleEnded = useCallback(() => {
    console.log('[OriginalAudioPlayer] ended');
    setIsPlayingInternal(false);
    if (onEnded) onEnded();
  }, [onEnded]);

  const handleError = useCallback((e) => {
    const mediaError = audioRef.current?.error;
    console.warn('[OriginalAudioPlayer] error=', mediaError);
    setIsPlayingInternal(false);
    setIsLoading(false);
    const msg = mediaError?.message || 'Error al cargar o reproducir el audio original.';
    setErrorMessage(msg);
    if (onError) onError(mediaError || e);
  }, [onError]);

  // User Seek Controls
  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value) || 0;
    setSeekValue(val);
  };

  const handleSliderPointerDown = () => {
    isSeekingRef.current = true;
  };

  const handleSliderCommit = (e) => {
    isSeekingRef.current = false;
    const val = parseFloat(e.target.value) || 0;
    setSeekValue(null);
    setLocalCurrentTime(val);

    const audio = audioRef.current;
    if (audio) {
      try {
        audio.currentTime = val;
      } catch (err) {
        console.warn('[OriginalAudioPlayer] seek error:', err);
      }
    }
    if (onTimeUpdate) {
      onTimeUpdate(val);
    }
  };

  const handleTogglePlay = () => {
    if (onTogglePlay) {
      onTogglePlay();
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused || audio.ended) {
        audio.play().catch(err => {
          console.warn('[OriginalAudioPlayer] play() error:', err);
          if (onError) onError(err);
        });
      } else {
        audio.pause();
      }
    }
  };

  if (!streamUrl) {
    return null;
  }

  const displayedTime = seekValue !== null ? seekValue : localCurrentTime;

  return (
    <div className="shrink-0 z-20 bg-[var(--surface-primary)]/95 backdrop-blur-md border-t border-[var(--border-primary)] px-3 sm:px-4 py-2 sm:py-2.5 transition-colors shadow-xs">
      {/* Hidden audio element maintaining the same lifecycle & imperative ref */}
      <audio
        ref={audioRef}
        preload="metadata"
        className="hidden"
        aria-hidden="true"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onError={handleError}
      />

      <div className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-3">
        {/* Badge: Audio original */}
        <div
          className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400"
          title="Audio original importado"
        >
          <Volume2 className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[11px] sm:text-xs font-bold whitespace-nowrap hidden sm:inline">
            Audio original
          </span>
        </div>

        {/* Play / Pause button */}
        <button
          type="button"
          onClick={handleTogglePlay}
          disabled={isLoading && !duration}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white flex items-center justify-center shadow-xs cursor-pointer active:scale-95 shrink-0 disabled:opacity-50 transition-all"
          aria-label={activeIsPlaying ? 'Pausar audio original' : 'Reproducir audio original'}
          title={activeIsPlaying ? 'Pausar audio original' : 'Reproducir audio original'}
        >
          {isLoading && !duration ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : activeIsPlaying ? (
            <Pause className="w-4 h-4 fill-white" />
          ) : (
            <Play className="w-4 h-4 fill-white ml-0.5" />
          )}
        </button>

        {/* Timeline Slider */}
        <div className="flex-1 flex items-center min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={displayedTime}
            onChange={handleSliderChange}
            onPointerDown={handleSliderPointerDown}
            onPointerUp={handleSliderCommit}
            className="w-full h-1.5 sm:h-2 bg-[var(--surface-secondary)] rounded-lg appearance-none cursor-pointer accent-rose-500 focus:outline-hidden"
            aria-label="Progreso del audio original"
          />
        </div>

        {/* Time display */}
        <div className="shrink-0 text-[10px] sm:text-xs font-mono font-medium text-[var(--text-secondary)] whitespace-nowrap">
          <span className="text-[var(--text-primary)] font-bold">{formatTime(displayedTime)}</span>
          <span className="opacity-60"> / </span>
          <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
        </div>

        {/* Manual Bookmark Button */}
        {onSaveBookmark && (
          <button
            type="button"
            onClick={onSaveBookmark}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-medium transition-all cursor-pointer active:scale-95 shrink-0 ${
              isBookmarked
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)]'
            }`}
            title={isBookmarked ? 'Posición guardada (haz clic para actualizar)' : 'Guardar posición actual'}
            aria-label={isBookmarked ? 'Posición guardada' : 'Guardar posición'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-rose-500 text-rose-500' : 'text-rose-500'}`} />
            <span className="hidden sm:inline">
              {isBookmarked ? 'Posición guardada' : 'Guardar posición'}
            </span>
          </button>
        )}
      </div>

      {/* Error banner if audio failed to load */}
      {errorMessage && (
        <div className="max-w-4xl mx-auto mt-1.5 flex items-center gap-1.5 text-[11px] text-rose-500 dark:text-rose-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
});

export default OriginalAudioPlayer;
