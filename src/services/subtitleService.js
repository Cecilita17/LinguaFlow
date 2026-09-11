/**
 * Service for parsing and normalizing subtitle and transcript files
 * (.srt, .vtt, .txt) into a unified internal model.
 */

/**
 * Converts a timestamp string (e.g. "00:01:23,450" or "01:23.450") to seconds.
 * @param {string} timeStr - Timestamp in SRT/VTT format
 * @returns {number} Time in seconds
 */
export function parseTimestampToSeconds(timeStr) {
  if (!timeStr) return 0;
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }

  return parseFloat(clean) || 0;
}

/**
 * Formats seconds into a clean display timestamp: mm:ss or hh:mm:ss.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatTimestamp(totalSeconds) {
  if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
    return '00:00';
  }

  const s = Math.floor(totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  return `${mm}:${ss}`;
}

/**
 * Strips formatting HTML tags from subtitle text (e.g. <i>, <b>, <font>, {\an8})
 * and decodes standard HTML entities.
 */
function stripSubtitleTags(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\{[^\}]+\}/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Parses SRT subtitle content into normalized subtitle objects.
 * @param {string} content - Raw SRT text
 * @returns {Array} List of normalized subtitle objects
 */
export function parseSrt(content) {
  if (!content || typeof content !== 'string') return [];

  const clean = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = clean.split(/\n\s*\n/);
  const results = [];

  const timeRegex = /(\d+:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d+:\d{2}:\d{2}[,.]\d{1,3})/;

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIdx = -1;
    let match = null;

    for (let i = 0; i < lines.length; i++) {
      match = lines[i].match(timeRegex);
      if (match) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx !== -1 && match) {
      const startTime = parseTimestampToSeconds(match[1]);
      const endTime = parseTimestampToSeconds(match[2]);
      const textLines = lines.slice(timeLineIdx + 1);
      const text = stripSubtitleTags(textLines.join(' '));

      if (text) {
        results.push({
          id: `srt_${results.length + 1}`,
          startTime: typeof startTime === 'number' && !isNaN(startTime) ? Math.max(0, startTime) : 0,
          endTime: typeof endTime === 'number' && !isNaN(endTime) && endTime > startTime ? endTime : startTime + 3.0,
          text,
          tokens: [],
          glosses: []
        });
      }
    }
  }

  return results;
}

/**
 * Parses WebVTT subtitle content into normalized subtitle objects.
 * @param {string} content - Raw VTT text
 * @returns {Array} List of normalized subtitle objects
 */
export function parseVtt(content) {
  if (!content || typeof content !== 'string') return [];

  const clean = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = clean.split(/\n\s*\n/);
  const results = [];

  const timeRegex = /((?:\d+:)?\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*((?:\d+:)?\d{2}:\d{2}[,.]\d{1,3})/;

  for (let idx = 0; idx < blocks.length; idx++) {
    const block = blocks[idx];
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Skip WEBVTT header
    if (lines[0].toUpperCase().startsWith('WEBVTT') && lines.length === 1) {
      continue;
    }

    let timeLineIdx = -1;
    let match = null;

    for (let i = 0; i < lines.length; i++) {
      match = lines[i].match(timeRegex);
      if (match) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx !== -1 && match) {
      const startTime = parseTimestampToSeconds(match[1]);
      const endTime = parseTimestampToSeconds(match[2]);
      const textLines = lines.slice(timeLineIdx + 1);
      const text = stripSubtitleTags(textLines.join(' '));

      if (text) {
        results.push({
          id: `vtt_${results.length + 1}`,
          startTime: typeof startTime === 'number' && !isNaN(startTime) ? Math.max(0, startTime) : 0,
          endTime: typeof endTime === 'number' && !isNaN(endTime) && endTime > startTime ? endTime : startTime + 3.0,
          text,
          tokens: [],
          glosses: []
        });
      }
    }
  }

  return results;
}

import { splitTextIntoNaturalSegments } from './textDocumentService.js';

/**
 * Parses plain text (.txt) transcript content using centralized natural segmentation.
 * If no timestamps exist, assigns sequential spacing for reading.
 * @param {string} content - Raw plain text
 * @param {string} [targetLang='zh'] - Language code for segmentation hints
 * @returns {Array} List of normalized subtitle objects
 */
export function parseTxt(content, targetLang = 'zh') {
  if (!content || typeof content !== 'string') return [];

  const clean = content.replace(/^\uFEFF/, '');
  const rawLines = splitTextIntoNaturalSegments(clean, targetLang);
  const results = [];

  for (let idx = 0; idx < rawLines.length; idx++) {
    const raw = rawLines[idx];
    const line = stripSubtitleTags(raw);
    if (!line) continue;
    results.push({
      id: `txt_${results.length + 1}`,
      startTime: results.length * 3.5,
      endTime: results.length * 3.5 + 3.0,
      text: line,
      tokens: [],
      glosses: []
    });
  }

  return results;
}

/**
 * Auto-detects format (SRT, VTT, or TXT) and parses the content.
 * @param {string} content - Raw transcript content
 * @param {string} [fileName=''] - Optional file name for extension hint
 * @param {string} [targetLang='zh'] - Language code for segmentation hints
 * @returns {{ format: string, subtitles: Array }}
 */
export function parseSubtitlesAuto(content, fileName = '', targetLang = 'zh') {
  if (!content || typeof content !== 'string') {
    return { format: 'unknown', subtitles: [] };
  }

  try {
    const cleanContent = content.replace(/^\uFEFF/, '');
    const lowerName = (fileName || '').toLowerCase();
    const trimmed = cleanContent.trim();

    // 1. Check for WebVTT
    if (lowerName.endsWith('.vtt') || trimmed.toUpperCase().startsWith('WEBVTT')) {
      const subs = parseVtt(cleanContent);
      if (subs.length > 0) return { format: 'vtt', subtitles: subs };
    }

    // 2. Check for SRT (contains --> with hh:mm:ss,ms)
    if (lowerName.endsWith('.srt') || /-->/.test(cleanContent)) {
      const subs = parseSrt(cleanContent);
      if (subs.length > 0) return { format: 'srt', subtitles: subs };
    }

    // 3. Plain TXT
    const subs = parseTxt(cleanContent, targetLang);
    return { format: 'txt', subtitles: subs };
  } catch (err) {
    console.error('Error in parseSubtitlesAuto:', err);
    return { format: 'unknown', subtitles: [] };
  }
}
