import React, { useState, useEffect, useCallback } from 'react';
import { YouTubePlayer } from '../components/youtube/YouTubePlayer.jsx';
import { YouTubeImporter } from '../components/youtube/YouTubeImporter.jsx';
import { SubtitleImporter } from '../components/youtube/SubtitleImporter.jsx';
import { Transcript } from '../components/youtube/Transcript.jsx';
import { TranscriptControls } from '../components/youtube/TranscriptControls.jsx';
import { Youtube, Sparkles, FileText, CheckCircle2, RotateCcw } from 'lucide-react';

const SESSION_STORAGE_KEY = 'linguaflow_youtube_reader_session';

export function YouTubeReaderPage() {
  // Session state with localStorage persistence
  const [videoId, setVideoId] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLanguage, setVideoLanguage] = useState('auto');
  const [subtitles, setSubtitles] = useState([]);
  const [subtitleFormat, setSubtitleFormat] = useState(null);
  const [subtitleSource, setSubtitleSource] = useState('');

  // Player & synchronization state
  const [currentTime, setCurrentTime] = useState(0);
  const [seekToTime, setSeekToTime] = useState(null);

  // Transcript view preferences
  const [autoScroll, setAutoScroll] = useState(true);
  const [fontSize, setFontSize] = useState('base'); // 'sm' | 'base' | 'lg' | 'xl'
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Restore previous session on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.videoId) setVideoId(parsed.videoId);
        if (parsed.videoUrl) setVideoUrl(parsed.videoUrl);
        if (parsed.videoLanguage) setVideoLanguage(parsed.videoLanguage);
        if (Array.isArray(parsed.subtitles) && parsed.subtitles.length > 0) {
          setSubtitles(parsed.subtitles);
        }
        if (parsed.subtitleFormat) setSubtitleFormat(parsed.subtitleFormat);
        if (parsed.subtitleSource) setSubtitleSource(parsed.subtitleSource);
        if (parsed.preferences) {
          if (typeof parsed.preferences.autoScroll === 'boolean') {
            setAutoScroll(parsed.preferences.autoScroll);
          }
          if (parsed.preferences.fontSize) {
            setFontSize(parsed.preferences.fontSize);
          }
          if (typeof parsed.preferences.showTimestamps === 'boolean') {
            setShowTimestamps(parsed.preferences.showTimestamps);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load YouTube Reader session from storage:', e);
    }
  }, []);

  // 2. Persist session when critical state changes
  useEffect(() => {
    try {
      const sessionData = {
        videoId,
        videoUrl,
        videoLanguage,
        subtitles,
        subtitleFormat,
        subtitleSource,
        preferences: {
          autoScroll,
          fontSize,
          showTimestamps
        }
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (e) {
      console.warn('Failed to save YouTube Reader session to storage:', e);
    }
  }, [videoId, videoUrl, videoLanguage, subtitles, subtitleFormat, subtitleSource, autoScroll, fontSize, showTimestamps]);

  // Handlers
  const handleImportVideo = (newVideoId, newUrl) => {
    setVideoId(newVideoId);
    setVideoUrl(newUrl);
    setCurrentTime(0);
  };

  const handleSubtitlesLoaded = (newSubtitles, format, sourceName) => {
    setSubtitles(newSubtitles);
    setSubtitleFormat(format);
    setSubtitleSource(sourceName);
  };

  const handleClearSubtitles = () => {
    setSubtitles([]);
    setSubtitleFormat(null);
    setSubtitleSource('');
  };

  const handleResetSession = () => {
    setVideoId('');
    setVideoUrl('');
    setSubtitles([]);
    setSubtitleFormat(null);
    setSubtitleSource('');
    setCurrentTime(0);
    setSearchQuery('');
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {}
  };

  const handleSeek = (timeInSeconds) => {
    setSeekToTime({ time: timeInSeconds, autoPlay: true });
  };

  const handleResetToStart = () => {
    handleSeek(0);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 animate-fade-in text-white">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#32170f]/90 border border-[#52271a] shadow-lg shadow-black/30 flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-md shadow-rose-950 mt-0.5">
            <Youtube className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                YouTube Reader
              </h2>
              <span className="text-[10px] uppercase font-bold bg-rose-950 text-rose-300 px-2 py-0.5 rounded-full border border-rose-800">
                Inmersión
              </span>
            </div>
            <p className="text-xs text-rose-200/70 mt-0.5 leading-relaxed max-w-xl">
              Pega cualquier vídeo de YouTube e importa sus subtítulos en <span className="font-semibold text-rose-300">SRT</span>, <span className="font-semibold text-rose-300">VTT</span> o <span className="font-semibold text-rose-300">TXT</span>. Lee la transcripción sincronizada y haz clic en cualquier línea para saltar a ese instante del vídeo.
            </p>
          </div>
        </div>

        {(videoId || subtitles.length > 0) && (
          <button
            type="button"
            onClick={handleResetSession}
            title="Limpiar lector y empezar de nuevo"
            className="p-2 text-rose-300/60 hover:text-white hover:bg-[#482519] rounded-xl transition-colors flex-shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 1. YouTube Importer Input */}
      <YouTubeImporter
        onImportVideo={handleImportVideo}
        initialUrl={videoUrl}
        selectedLanguage={videoLanguage}
        onLanguageChange={setVideoLanguage}
      />

      {/* 2. Video Player Section */}
      <div className="space-y-2">
        <YouTubePlayer
          videoId={videoId}
          onTimeUpdate={setCurrentTime}
          seekToTime={seekToTime}
        />
      </div>

      {/* 3. Subtitles Importer Section */}
      <SubtitleImporter
        onSubtitlesLoaded={handleSubtitlesLoaded}
        subtitlesCount={subtitles.length}
        currentFormat={subtitleFormat}
        onClearSubtitles={subtitles.length > 0 ? handleClearSubtitles : null}
      />

      {/* 4. Transcript & Synchronized Reader Section */}
      {subtitles.length > 0 && (
        <div className="space-y-3 pt-2">
          {/* Controls Bar */}
          <TranscriptControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onResetToStart={handleResetToStart}
            autoScroll={autoScroll}
            onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
            fontSize={fontSize}
            onChangeFontSize={setFontSize}
            showTimestamps={showTimestamps}
            onToggleTimestamps={() => setShowTimestamps(!showTimestamps)}
          />

          {/* Transcript Lines View */}
          <Transcript
            subtitles={subtitles}
            currentTime={currentTime}
            onSeek={handleSeek}
            autoScroll={autoScroll}
            fontSize={fontSize}
            showTimestamps={showTimestamps}
            searchQuery={searchQuery}
          />
        </div>
      )}
    </div>
  );
}

export default YouTubeReaderPage;
