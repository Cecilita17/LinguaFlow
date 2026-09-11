import React, { useEffect, useRef, useState } from 'react';
import { loadYouTubeIFrameApi } from '../../services/youtubeService.js';
import { Play, AlertCircle, Video } from 'lucide-react';

export function YouTubePlayer({
  videoId,
  onTimeUpdate,
  onPlayerReady,
  onPlayerStateChange = null,
  seekToTime = null,
  playbackRate = 1
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const timerRef = useRef(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // 1. Load YouTube IFrame API
  useEffect(() => {
    loadYouTubeIFrameApi()
      .then(() => {
        setIsApiReady(true);
      })
      .catch((err) => {
        console.warn('Failed to load YouTube IFrame API:', err);
        setLoadError('No se pudo cargar el reproductor oficial de YouTube.');
      });
  }, []);

  // 2. Initialize or update player when videoId or API changes
  useEffect(() => {
    if (!isApiReady || !videoId || !containerRef.current) return;

    const playerId = `yt-player-${videoId}`;
    containerRef.current.innerHTML = `<div id="${playerId}" class="w-full h-full"></div>`;

    try {
      const player = new window.YT.Player(playerId, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: typeof window !== 'undefined' ? window.location.origin : ''
        },
        events: {
          onReady: (event) => {
            playerRef.current = event.target;
            if (typeof playbackRate === 'number' && typeof event.target.setPlaybackRate === 'function') {
              try {
                event.target.setPlaybackRate(playbackRate);
              } catch (e) {}
            }
            if (seekToTime !== null && typeof seekToTime.time === 'number' && typeof event.target.seekTo === 'function') {
              try {
                event.target.seekTo(seekToTime.time, true);
                if (seekToTime.autoPlay && typeof event.target.playVideo === 'function') {
                  event.target.playVideo();
                }
              } catch (e) {}
            }
            if (onPlayerReady) onPlayerReady(event.target);
          },
          onStateChange: (event) => {
            // YT.PlayerState.PLAYING === 1
            if (event.data === 1) {
              startTrackingTime();
            } else {
              stopTrackingTime();
            }
            if (onPlayerStateChange) onPlayerStateChange(event.data);
          },
          onError: (event) => {
            console.warn('YouTube Player error code:', event.data);
            if (event.data === 101 || event.data === 150) {
              setLoadError('Este vídeo no permite reproducción insertada (embed) según la configuración del autor en YouTube.');
            }
          }
        }
      });

      playerRef.current = player;
    } catch (err) {
      console.warn('Error creating YT.Player:', err);
    }

    const startTrackingTime = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const currentTime = playerRef.current.getCurrentTime();
          if (onTimeUpdate) onTimeUpdate(currentTime);
        }
      }, 250);
    };

    const stopTrackingTime = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Emit one final current time
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const currentTime = playerRef.current.getCurrentTime();
        if (onTimeUpdate) onTimeUpdate(currentTime);
      }
    };

    return () => {
      stopTrackingTime();
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (e) {}
      }
    };
  }, [isApiReady, videoId]);

  // 3. Handle external seek requests (e.g. user clicked a subtitle line)
  useEffect(() => {
    if (seekToTime !== null && playerRef.current && typeof playerRef.current.seekTo === 'function') {
      try {
        playerRef.current.seekTo(seekToTime.time, true);
        if (seekToTime.autoPlay && typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
        }
      } catch (err) {
        console.warn('Seek error:', err);
      }
    }
  }, [seekToTime]);

  // 4. Handle playback rate changes
  useEffect(() => {
    if (playerRef.current && typeof playerRef.current.setPlaybackRate === 'function') {
      try {
        playerRef.current.setPlaybackRate(playbackRate);
      } catch (err) {
        console.warn('Error setting playback rate:', err);
      }
    }
  }, [playbackRate]);

  // Fallback if no video loaded
  if (!videoId) {
    return (
      <div className="aspect-video w-full rounded-2xl border-2 border-dashed border-rose-950/40 dark:border-rose-900/30 bg-[#23110b]/60 flex flex-col items-center justify-center text-rose-300/60 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#3b1e15] flex items-center justify-center text-rose-400 mb-3 shadow-inner">
          <Video className="w-7 h-7" />
        </div>
        <h4 className="text-sm font-bold text-rose-200 mb-1">Sin vídeo seleccionado</h4>
        <p className="text-xs text-rose-300/70 max-w-sm">
          Pega un enlace de YouTube arriba para cargar el vídeo y empezar a leer sus subtítulos en sincronía.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="aspect-video w-full rounded-2xl bg-amber-950/40 border border-amber-800/60 flex flex-col items-center justify-center text-amber-200 p-6 text-center">
        <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
        <h4 className="text-sm font-bold mb-1">Aviso del reproductor</h4>
        <p className="text-xs text-amber-300/80 max-w-md">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-[#5a2e20] bg-black relative">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

export default YouTubePlayer;
