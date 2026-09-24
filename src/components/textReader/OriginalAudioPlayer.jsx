import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { API_BASE_URL } from '../../services/chatService.js';

/**
 * OriginalAudioPlayer
 *
 * Isolated audio player component for imported audio documents.
 * Equivalent to YouTubePlayer.jsx, but dedicated to HTML5 audio.
 * Encapsulates HTMLAudioElement lifecycle, stream loading, segment-bounded playback,
 * and exposes callbacks to TextReaderPage.
 */
export const OriginalAudioPlayer = forwardRef(function OriginalAudioPlayer({
  audioPathname,
  onTimeUpdate = null,
  onDurationChange = null,
  onPlay = null,
  onPause = null,
  onEnded = null,
  onError = null,
  onReady = null,
  onSegmentEnd = null,
  initialTime = 0
}, ref) {
  const audioRef = useRef(null);
  const segmentEndRef = useRef(null);
  const monitorIntervalRef = useRef(null);
  const isPlayingRef = useRef(false);
  const initialSeekDoneRef = useRef(false);

  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const clearSegmentMonitor = useCallback(() => {
    if (monitorIntervalRef.current) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
    }
  }, []);

  // Compute clean stream URL from audioPathname
  const streamUrl = audioPathname
    ? `${API_BASE_URL || ''}/api/audio-stream?pathname=${encodeURIComponent(audioPathname)}`
    : '';

  // Setup segment monitoring loop while playing to detect exact end boundaries
  const startSegmentMonitor = useCallback(() => {
    clearSegmentMonitor();
    monitorIntervalRef.current = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const current = audio.currentTime;
      const targetEnd = segmentEndRef.current;

      if (typeof targetEnd === 'number' && current >= targetEnd) {
        // Reached end of current paragraph segment
        clearSegmentMonitor();
        segmentEndRef.current = null;
        try {
          audio.pause();
        } catch (e) {}
        console.log(`[OriginalAudioPlayer] reached segment end: currentTime=${current.toFixed(2)}, targetEnd=${targetEnd}`);
        if (onSegmentEnd) {
          onSegmentEnd({ currentTime: current, targetEnd });
        }
      }
    }, 40); // 40ms interval gives 25fps checking precision without UI overhead
  }, [clearSegmentMonitor, onSegmentEnd]);

  // Imperative handle exposed to parent via ref
  useImperativeHandle(ref, () => ({
    playSegment: (start, end) => {
      const audio = audioRef.current;
      if (!audio) return;

      const safeStart = Math.max(0, typeof start === 'number' ? start : 0);
      const safeEnd = typeof end === 'number' && end > safeStart ? end : null;

      segmentEndRef.current = safeEnd;

      try {
        audio.currentTime = safeStart;
      } catch (e) {}

      console.log(`[OriginalAudioPlayer] play segment: [${safeStart} - ${safeEnd ?? 'end'}]`);

      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch(err => {
          console.warn('[OriginalAudioPlayer] play() rejected:', err);
          clearSegmentMonitor();
          if (onError) onError(err);
        });
      }
    },

    seek: (time) => {
      const audio = audioRef.current;
      if (!audio) return;
      const safeTime = Math.max(0, typeof time === 'number' ? time : 0);
      try {
        audio.currentTime = safeTime;
        console.log(`[OriginalAudioPlayer] seek to ${safeTime}`);
      } catch (e) {
        console.warn('[OriginalAudioPlayer] seek error:', e);
      }
    },

    play: () => {
      const audio = audioRef.current;
      if (!audio) return;
      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch(err => {
          console.warn('[OriginalAudioPlayer] play() rejected:', err);
          if (onError) onError(err);
        });
      }
    },

    pause: () => {
      const audio = audioRef.current;
      if (!audio) return;
      segmentEndRef.current = null;
      clearSegmentMonitor();
      try {
        audio.pause();
      } catch (e) {}
    },

    stop: () => {
      const audio = audioRef.current;
      if (!audio) return;
      segmentEndRef.current = null;
      clearSegmentMonitor();
      try {
        audio.pause();
      } catch (e) {}
    },

    getCurrentTime: () => audioRef.current?.currentTime || 0,
    getDuration: () => audioRef.current?.duration || 0,
    isPlaying: () => isPlayingRef.current
  }), [clearSegmentMonitor, onError]);

  // Audio source lifecycle
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;

    initialSeekDoneRef.current = false;
    segmentEndRef.current = null;
    clearSegmentMonitor();

    console.log(`[OriginalAudioPlayer] source=${audioPathname}`);
    audio.src = streamUrl;
    audio.playbackRate = 1.0;
    audio.load();

    return () => {
      clearSegmentMonitor();
      if (audio) {
        try {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        } catch (e) {}
      }
    };
  }, [streamUrl, audioPathname, clearSegmentMonitor]);

  // Event handlers for HTMLAudioElement
  const handleLoadedMetadata = useCallback((e) => {
    const audio = e.target;
    const dur = audio.duration || 0;
    setDuration(dur);
    setIsReady(true);
    console.log(`[OriginalAudioPlayer] loadedmetadata`);
    console.log(`[OriginalAudioPlayer] duration=${dur}`);

    // Initial seek to restored lastAudioPosition if specified, but stay paused
    if (!initialSeekDoneRef.current && typeof initialTime === 'number' && initialTime > 0) {
      initialSeekDoneRef.current = true;
      try {
        audio.currentTime = initialTime;
        console.log(`[OriginalAudioPlayer] restored initial position to ${initialTime}`);
      } catch (err) {}
    }

    if (onDurationChange) onDurationChange(dur);
    if (onReady) onReady({ duration: dur });
  }, [initialTime, onDurationChange, onReady]);

  const handleTimeUpdate = useCallback((e) => {
    const audio = e.target;
    const current = audio.currentTime;
    if (onTimeUpdate) onTimeUpdate(current);
  }, [onTimeUpdate]);

  const handlePlay = useCallback(() => {
    isPlayingRef.current = true;
    const current = audioRef.current?.currentTime || 0;
    console.log(`[OriginalAudioPlayer] play`);
    console.log(`[OriginalAudioPlayer] currentTime=${current.toFixed(2)}`);
    startSegmentMonitor();
    if (onPlay) onPlay();
  }, [onPlay, startSegmentMonitor]);

  const handlePause = useCallback(() => {
    isPlayingRef.current = false;
    clearSegmentMonitor();
    const current = audioRef.current?.currentTime || 0;
    console.log(`[OriginalAudioPlayer] pause`);
    console.log(`[OriginalAudioPlayer] currentTime=${current.toFixed(2)}`);
    if (onPause) onPause(current);
  }, [clearSegmentMonitor, onPause]);

  const handleEnded = useCallback(() => {
    isPlayingRef.current = false;
    clearSegmentMonitor();
    segmentEndRef.current = null;
    console.log(`[OriginalAudioPlayer] ended`);
    if (onEnded) onEnded();
  }, [clearSegmentMonitor, onEnded]);

  const handleError = useCallback((e) => {
    isPlayingRef.current = false;
    clearSegmentMonitor();
    const mediaError = audioRef.current?.error;
    console.warn(`[OriginalAudioPlayer] error=`, mediaError);
    if (onError) onError(mediaError || e);
  }, [clearSegmentMonitor, onError]);

  if (!streamUrl) {
    return null;
  }

  return (
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
  );
});

export default OriginalAudioPlayer;
