import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { API_BASE_URL } from '../../services/chatService.js';

/**
 * OriginalAudioPlayer
 *
 * Isolated HTML5 audio player component for imported audio documents.
 * Conceptually equivalent to YouTubePlayer.jsx, but dedicated to native HTML5 audio.
 * Manages only the HTMLAudioElement lifecycle, source loading, playback controls,
 * and reports events (currentTime, duration, ready, play, pause, ended, error) to the parent.
 *
 * It has NO knowledge of paragraphs, timestamps, auto-play, or persistence.
 */
export const OriginalAudioPlayer = forwardRef(function OriginalAudioPlayer({
  audioPathname,
  onReady = null,
  onTimeUpdate = null,
  onPlay = null,
  onPause = null,
  onEnded = null,
  onError = null,
  initialTime = 0,
  playbackRate = 1.0
}, ref) {
  const audioRef = useRef(null);
  const [duration, setDuration] = useState(0);
  const initialSeekDoneRef = useRef(false);

  // Compute clean stream URL from audioPathname
  const streamUrl = audioPathname
    ? `${API_BASE_URL || ''}/api/audio-stream?pathname=${encodeURIComponent(audioPathname)}`
    : '';

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
    console.log('[OriginalAudioPlayer] loadedmetadata');
    console.log('[OriginalAudioPlayer] duration=', dur);

    // Initial seek to restored lastAudioPosition if specified, but stay paused
    if (!initialSeekDoneRef.current && typeof initialTime === 'number' && initialTime > 0) {
      initialSeekDoneRef.current = true;
      try {
        audio.currentTime = initialTime;
      } catch (err) {}
    }

    if (onReady) onReady({ duration: dur });
  }, [initialTime, onReady]);

  const handleTimeUpdate = useCallback((e) => {
    const current = e.target.currentTime || 0;
    if (onTimeUpdate) onTimeUpdate(current);
  }, [onTimeUpdate]);

  const handlePlay = useCallback(() => {
    console.log('[OriginalAudioPlayer] play');
    if (onPlay) onPlay();
  }, [onPlay]);

  const handlePause = useCallback((e) => {
    const current = e.target.currentTime || 0;
    console.log('[OriginalAudioPlayer] pause');
    console.log('[OriginalAudioPlayer] time=', current);
    if (onPause) onPause(current);
  }, [onPause]);

  const handleEnded = useCallback(() => {
    console.log('[OriginalAudioPlayer] ended');
    if (onEnded) onEnded();
  }, [onEnded]);

  const handleError = useCallback((e) => {
    const mediaError = audioRef.current?.error;
    console.warn('[OriginalAudioPlayer] error=', mediaError);
    if (onError) onError(mediaError || e);
  }, [onError]);

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
