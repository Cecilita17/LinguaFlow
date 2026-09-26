/**
 * Groq Whisper Adapter
 * Handles audio uploading to temporary storage, technical chunking when required,
 * communication with /api/transcribe, and returns canonical raw transcription data.
 *
 * GUARANTEES:
 * - Never alters, filters, or deletes Whisper's raw transcription text.
 * - Converts all chunk timestamps to absolute seconds.
 * - Does not perform paragraph creation, tokenization, or document logic.
 */

import { upload } from '@vercel/blob/client';
import { API_BASE_URL } from '../chatService.js';
import {
  decodeAudioFile,
  encodeAudioSliceToWav,
  planAudioChunks,
  LONG_AUDIO_THRESHOLD_SECONDS,
  CHUNK_DURATION_SECONDS,
  CHUNK_OVERLAP_SECONDS
} from './audioUtils.js';

/**
 * Transcribes an audio file (.mp3, .wav, .m4a, .webm, .ogg) using Groq Whisper (cloud).
 *
 * @param {object} params
 * @param {File|Blob} params.audio - The audio file or blob
 * @param {string} [params.language='es'] - Target language code (e.g. 'es', 'zh', 'en')
 * @param {string} [params.apiKey=''] - Optional client Groq API key override
 * @param {Function} [params.onProgress=null] - Progress reporting callback
 * @param {AbortSignal} [params.abortSignal=null] - Abort signal for cancellation
 * @returns {Promise<{ text: string, segments: Array<{ id: number, start: number, end: number, text: string }>, duration: number, language: string, engine: string, pathname: string|null, url: string|null, mimeType: string }>}
 */
export async function transcribeWithGroq({
  audio,
  language = 'es',
  apiKey = '',
  onProgress = null,
  abortSignal = null
}) {
  if (!audio) {
    throw new Error('No se seleccionó ningún archivo de audio.');
  }

  if (abortSignal?.aborted) {
    throw new Error('Transcripción cancelada por el usuario.');
  }

  // Max 25 MB client validation
  const MAX_BYTES = 25 * 1024 * 1024;
  if (audio.size > MAX_BYTES) {
    const mbSize = (audio.size / (1024 * 1024)).toFixed(1);
    throw new Error(`El archivo de audio (${mbSize} MB) supera el límite permitido de 25 MB.`);
  }

  if (typeof onProgress === 'function') {
    onProgress('Subiendo archivo de audio a almacenamiento temporal...');
  }

  const rawExt = (audio.name || '').split('.').pop()?.toLowerCase();
  const validExts = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'aac', 'flac', 'opus'];
  const fileExt = validExts.includes(rawExt) ? rawExt : 'webm';
  const safePathname = `transcribe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

  // 1. Direct binary upload to Vercel Blob storage
  const isLargeFile = audio.size > 5 * 1024 * 1024;
  const ticketUrl = (typeof window !== 'undefined' && !API_BASE_URL)
    ? '/api/transcribe-ticket'
    : `${API_BASE_URL}/api/transcribe-ticket`;

  const uploadOptions = {
    access: 'private',
    handleUploadUrl: ticketUrl,
    contentType: audio.type || 'audio/webm',
    multipart: isLargeFile
  };

  let blobResult;
  try {
    blobResult = await upload(safePathname, audio, uploadOptions);
  } catch (uploadErr) {
    const errMsg = (uploadErr?.message || '').toLowerCase();
    if (errMsg.includes('public access') || errMsg.includes('public store')) {
      blobResult = await upload(safePathname, audio, {
        ...uploadOptions,
        access: 'public'
      });
    } else {
      throw new Error(`Error al subir el archivo de audio: ${uploadErr.message || 'Fallo de red'}`);
    }
  }

  if (!blobResult || !blobResult.url) {
    throw new Error('No se recibió la confirmación de almacenamiento del archivo temporal.');
  }

  if (abortSignal?.aborted) {
    throw new Error('Transcripción cancelada por el usuario.');
  }

  const headers = { 'Content-Type': 'application/json' };
  const effectiveKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
  if (effectiveKey) {
    headers['x-api-key'] = effectiveKey;
  }

  // 2. Decode audio locally using Web Audio API to plan technical chunking if > 180s
  let chunkPlan = null;
  let decodedAudioBuffer = null;

  try {
    decodedAudioBuffer = await decodeAudioFile(audio);
    if (decodedAudioBuffer && decodedAudioBuffer.duration > LONG_AUDIO_THRESHOLD_SECONDS) {
      chunkPlan = planAudioChunks(decodedAudioBuffer, {
        chunkDurationSec: CHUNK_DURATION_SECONDS,
        overlapSec: CHUNK_OVERLAP_SECONDS,
        minDurationForChunking: LONG_AUDIO_THRESHOLD_SECONDS
      });
    }
  } catch (decodeErr) {
    console.warn('[GroqAdapter] Web Audio API decoding notice:', decodeErr);
  }

  // 3A. Long Audio Technical Chunking (> 180s)
  if (chunkPlan && chunkPlan.shouldChunk && chunkPlan.chunks.length > 1) {
    const totalChunks = chunkPlan.chunks.length;
    const allSegments = [];
    let combinedTextParts = [];

    for (let i = 0; i < totalChunks; i++) {
      if (abortSignal?.aborted) {
        throw new Error('Transcripción cancelada por el usuario.');
      }

      const chunk = chunkPlan.chunks[i];
      if (typeof onProgress === 'function') {
        const percent = Math.round((i / totalChunks) * 100);
        onProgress(`Transcribiendo audio: fragmento ${i + 1} de ${totalChunks} (${percent}%)...`);
      }

      // Encode chunk to 16kHz mono WAV Blob
      const chunkWavBlob = await encodeAudioSliceToWav(decodedAudioBuffer, chunk.startSec, chunk.endSec, 16000);
      const chunkPathname = `chunk-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}.wav`;

      const chunkUploadOptions = {
        access: 'private',
        handleUploadUrl: ticketUrl,
        contentType: 'audio/wav',
        multipart: false
      };

      let chunkBlobResult;
      try {
        chunkBlobResult = await upload(chunkPathname, chunkWavBlob, chunkUploadOptions);
      } catch (chunkUpErr) {
        chunkBlobResult = await upload(chunkPathname, chunkWavBlob, { ...chunkUploadOptions, access: 'public' });
      }

      if (!chunkBlobResult || !chunkBlobResult.url) {
        throw new Error(`Error al subir el fragmento temporal ${i + 1} de ${totalChunks}.`);
      }

      // Transcribe chunk via backend
      const chunkController = new AbortController();
      const chunkTimeoutId = setTimeout(() => chunkController.abort(), 90000);

      const abortHandler = () => chunkController.abort();
      if (abortSignal) {
        abortSignal.addEventListener('abort', abortHandler, { once: true });
      }

      try {
        const chunkRes = await fetch(`${API_BASE_URL}/api/transcribe`, {
          method: 'POST',
          headers,
          signal: chunkController.signal,
          body: JSON.stringify({
            fileUrl: chunkBlobResult.url,
            fileName: chunkPathname,
            mimeType: 'audio/wav',
            targetLang: language,
            apiKey: effectiveKey,
            timeoutMs: 85000,
            persistBlob: false
          })
        });

        clearTimeout(chunkTimeoutId);
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler);
        }

        const chunkData = await chunkRes.json().catch(() => ({}));

        if (!chunkRes.ok) {
          throw new Error(chunkData?.error || `Error del servidor al transcribir fragmento ${i + 1} (${chunkRes.status})`);
        }

        const rawSegments = Array.isArray(chunkData.segments)
          ? chunkData.segments.filter(s => s && typeof s.text === 'string' && s.text.trim())
          : [];
        const rawTranscript = (chunkData.transcript || '').trim();

        if (rawTranscript) {
          combinedTextParts.push(rawTranscript);
        }

        if (rawSegments.length > 0) {
          for (const seg of rawSegments) {
            const relStart = typeof seg.start === 'number' ? seg.start : 0;
            const relEnd = typeof seg.end === 'number' ? seg.end : (relStart + 2.0);
            allSegments.push({
              id: allSegments.length,
              start: Math.round((relStart + chunk.offsetSec) * 100) / 100,
              end: Math.round((relEnd + chunk.offsetSec) * 100) / 100,
              text: seg.text.trim()
            });
          }
        } else if (rawTranscript) {
          // Preserve chunk transcript as a single segment spanning the chunk offset
          allSegments.push({
            id: allSegments.length,
            start: Math.round(chunk.offsetSec * 100) / 100,
            end: Math.round((chunk.offsetSec + chunk.duration) * 100) / 100,
            text: rawTranscript
          });
        }
      } catch (chunkErr) {
        clearTimeout(chunkTimeoutId);
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler);
        }
        if (abortSignal?.aborted) {
          throw new Error('Transcripción cancelada por el usuario.');
        }
        throw new Error(`Fallo al transcribir el fragmento ${i + 1} de ${totalChunks}: ${chunkErr.message || 'Error de red'}`);
      }
    }

    // Sort all segments chronologically by absolute start time
    allSegments.sort((a, b) => a.start - b.start || a.end - b.end);
    for (let idx = 0; idx < allSegments.length; idx++) {
      allSegments[idx].id = idx;
    }

    const fullText = combinedTextParts.join(' ').trim() || allSegments.map(s => s.text).join(' ').trim();
    if (!fullText) {
      throw new Error('No se detectó contenido de voz en los fragmentos del audio.');
    }

    return {
      text: fullText,
      segments: allSegments,
      duration: Math.round((chunkPlan.totalDuration || blobResult.duration || 0) * 100) / 100,
      language,
      engine: 'groq',
      pathname: blobResult.pathname,
      url: blobResult.url,
      mimeType: audio.type || blobResult.contentType || 'audio/webm'
    };
  }

  // 3B. Standard Workflow for Short Audio (<= 180s) or non-chunked
  if (typeof onProgress === 'function') {
    onProgress('Transcribiendo con Groq Whisper...');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 125000);

  const abortHandler = () => controller.abort();
  if (abortSignal) {
    abortSignal.addEventListener('abort', abortHandler, { once: true });
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        fileUrl: blobResult.url,
        fileName: audio.name || safePathname,
        mimeType: audio.type || 'audio/webm',
        targetLang: language,
        apiKey: effectiveKey,
        timeoutMs: 120000,
        persistBlob: true
      })
    });

    clearTimeout(timeoutId);
    if (abortSignal) {
      abortSignal.removeEventListener('abort', abortHandler);
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.error || (res.status === 413 ? 'El archivo excede el tamaño máximo permitido por el servidor (HTTP 413).' : `Error del servidor de transcripción (${res.status})`);
      throw new Error(errMsg);
    }

    if (!data.success || !data.transcript) {
      throw new Error(data?.error || 'No se detectó contenido de voz en el audio.');
    }

    const rawSegments = Array.isArray(data.segments) ? data.segments : [];
    const normalizedSegments = rawSegments.map((seg, idx) => ({
      id: typeof seg.id === 'number' ? seg.id : idx,
      start: typeof seg.start === 'number' ? Math.round(seg.start * 100) / 100 : 0,
      end: typeof seg.end === 'number' ? Math.round(seg.end * 100) / 100 : 0,
      text: (seg.text || '').trim()
    })).filter(s => Boolean(s.text));

    const totalDur = typeof data.duration === 'number'
      ? data.duration
      : (decodedAudioBuffer?.duration || (Number(data.duration) || 0));

    return {
      text: data.transcript.trim(),
      segments: normalizedSegments,
      duration: Math.round(totalDur * 100) / 100,
      language,
      engine: 'groq',
      pathname: data.pathname || blobResult.pathname || null,
      url: blobResult.url || data.url || null,
      mimeType: audio.type || blobResult.contentType || 'audio/webm'
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (abortSignal) {
      abortSignal.removeEventListener('abort', abortHandler);
    }
    if (abortSignal?.aborted || err.name === 'AbortError') {
      throw new Error('Transcripción cancelada o tiempo de espera agotado.');
    }
    throw err;
  }
}
