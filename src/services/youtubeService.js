/**
 * Service for handling YouTube URL parsing, video ID extraction,
 * and YouTube IFrame Player API integration.
 */

// Regular expressions to extract 11-character YouTube video ID
const YOUTUBE_REGEXES = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i,
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
  /(?:https?:\/\/)?(?:www\.)?youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
  /(?:https?:\/\/)?m\.youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i,
  /^([a-zA-Z0-9_-]{11})$/ // Direct 11-char ID
];

/**
 * Extracts YouTube video ID from various URL formats.
 * @param {string} url - YouTube URL or ID
 * @returns {string|null} - 11-character video ID or null if invalid
 */
export function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();

  for (const regex of YOUTUBE_REGEXES) {
    const match = cleanUrl.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Validates a YouTube URL or video ID.
 * @param {string} url - YouTube URL or ID
 * @returns {{ isValid: boolean, videoId: string|null, error: string|null }}
 */
export function validateYouTubeUrl(url) {
  if (!url || !url.trim()) {
    return {
      isValid: false,
      videoId: null,
      error: 'Por favor, introduce un enlace de YouTube.'
    };
  }

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return {
      isValid: false,
      videoId: null,
      error: 'Enlace de YouTube no válido. Asegúrate de que tenga el formato youtube.com/watch?v=... o youtu.be/...'
    };
  }

  return {
    isValid: true,
    videoId,
    error: null
  };
}

/**
 * Returns a clean standard watch URL for a video ID.
 */
export function getStandardWatchUrl(videoId) {
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
}

/**
 * Loads the YouTube IFrame API script dynamically if not already loaded.
 * @returns {Promise<void>}
 */
let ytApiPromise = null;

export function loadYouTubeIFrameApi() {
  if (typeof window === 'undefined') return Promise.resolve();

  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  if (ytApiPromise) {
    return ytApiPromise;
  }

  ytApiPromise = new Promise((resolve) => {
    // Check if script element is already present
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (existingScript && window.YT && window.YT.Player) {
      resolve();
      return;
    }

    const previousOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousOnReady === 'function') previousOnReady();
      resolve();
    };

    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  });

  return ytApiPromise;
}
