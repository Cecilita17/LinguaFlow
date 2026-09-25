/**
 * Local Audio Import Manager
 * Manages background in-browser audio transcription lifecycle, progress state,
 * and persistence across application page navigations.
 */

import { transcribeAudioFileLocal, isLocalWhisperSupported } from './localWhisperService.js';
import { createTextDocument, saveDocument } from './textDocumentService.js';

class LocalAudioImportManager {
  constructor() {
    this.state = {
      status: 'idle', // 'idle' | 'loading-model' | 'transcribing' | 'completed' | 'error' | 'cancelled'
      fileName: '',
      fileSize: 0,
      targetLang: 'zh',
      nativeLang: 'es',
      progressPercent: 0,
      currentChunk: 0,
      totalChunks: 0,
      statusMessage: '',
      isMinimized: false,
      resultDoc: null,
      error: null,
      startedAt: null
    };

    this.listeners = new Set();
    this.abortController = null;
    this.activeTaskPromise = null;
  }

  getState() {
    return { ...this.state };
  }

  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
      listener(this.getState());
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.warn('[LocalAudioImportManager] Listener error:', err);
      }
    });
  }

  updateState(partial) {
    this.state = {
      ...this.state,
      ...partial
    };
    this.notify();
  }

  setMinimized(minimized) {
    this.updateState({ isMinimized: Boolean(minimized) });
  }

  toggleMinimized() {
    this.updateState({ isMinimized: !this.state.isMinimized });
  }

  clearTask() {
    if (this.state.status === 'transcribing' || this.state.status === 'loading-model') {
      this.cancelImport();
    }
    this.updateState({
      status: 'idle',
      fileName: '',
      fileSize: 0,
      progressPercent: 0,
      currentChunk: 0,
      totalChunks: 0,
      statusMessage: '',
      isMinimized: false,
      resultDoc: null,
      error: null,
      startedAt: null
    });
  }

  cancelImport() {
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch (e) {}
      this.abortController = null;
    }
    this.updateState({
      status: 'cancelled',
      statusMessage: 'Importación cancelada por el usuario.',
      error: null
    });
  }

  async startImport({ audioFile, targetLang = 'zh', nativeLang = 'es' }) {
    if (!audioFile) return null;

    if (this.state.status === 'transcribing' || this.state.status === 'loading-model') {
      console.warn('[LocalAudioImportManager] An audio import task is already running.');
      return this.activeTaskPromise;
    }

    if (!isLocalWhisperSupported()) {
      const errMsg = 'Tu navegador no soporta WebAssembly/Web Workers necesario para la transcripción local.';
      this.updateState({
        status: 'error',
        error: errMsg,
        statusMessage: errMsg
      });
      throw new Error(errMsg);
    }

    this.abortController = new AbortController();
    const abortSignal = this.abortController.signal;

    const fileName = audioFile.name || 'audio';
    const fileSize = audioFile.size || 0;

    this.updateState({
      status: 'transcribing',
      fileName,
      fileSize,
      targetLang,
      nativeLang,
      progressPercent: 0,
      currentChunk: 1,
      totalChunks: 1,
      statusMessage: 'Importando archivo de audio: decodificando audio en el navegador...',
      isMinimized: false,
      resultDoc: null,
      error: null,
      startedAt: Date.now()
    });

    this.activeTaskPromise = (async () => {
      try {
        const result = await transcribeAudioFileLocal({
          audioFile,
          targetLang,
          abortSignal,
          onModelProgress: (prog) => {
            if (abortSignal.aborted) return;
            if (prog?.status === 'progress' && prog?.total) {
              const pct = Math.round((prog.loaded / prog.total) * 100) || 0;
              this.updateState({
                status: 'loading-model',
                progressPercent: pct,
                statusMessage: `Descargando modelo Whisper local (${pct}%)...`
              });
            }
          },
          onProgress: (msg) => {
            if (abortSignal.aborted) return;
            let currentChunk = this.state.currentChunk;
            let totalChunks = this.state.totalChunks;
            let pct = this.state.progressPercent;

            // Extract chunk information from progress message if present
            const match = msg.match(/fragmento\s+(\d+)\s+de\s+(\d+)\s+\((\d+)%\)/i);
            if (match) {
              currentChunk = parseInt(match[1], 10);
              totalChunks = parseInt(match[2], 10);
              pct = parseInt(match[3], 10);
            }

            this.updateState({
              status: 'transcribing',
              statusMessage: msg.startsWith('Importando') ? msg : `Importando archivo de audio: ${msg}`,
              currentChunk,
              totalChunks,
              progressPercent: pct
            });
          }
        });

        if (abortSignal.aborted) {
          throw new Error('Importación cancelada por el usuario.');
        }

        const transcriptText = (result.transcript || '').trim();
        if (!transcriptText) {
          throw new Error('No se detectó contenido de voz en el audio.');
        }

        this.updateState({
          statusMessage: 'Importando archivo de audio: guardando documento sincronizado...',
          progressPercent: 100
        });

        const defaultTitle = fileName.replace(/\.[^/.]+$/, '') || 'Audio transcrito';

        const docToSave = createTextDocument({
          title: defaultTitle,
          sourceType: 'audio',
          format: 'audio',
          rawText: transcriptText,
          targetLang,
          nativeLang,
          audioPathname: null,
          audioUrl: null,
          audioBlob: audioFile,
          audioMimeType: audioFile.type || result.mimeType || 'audio/webm',
          audioSegments: Array.isArray(result.segments) ? result.segments : [],
          audioDuration: typeof result.duration === 'number' ? result.duration : 0,
          createdAt: new Date().toISOString()
        });

        const saved = await saveDocument(docToSave);

        console.log('[LocalAudioImportManager] Document saved successfully in background:', {
          id: saved.id,
          title: saved.title,
          paragraphsCount: saved.paragraphs?.length,
          audioDuration: saved.audioDuration
        });

        this.updateState({
          status: 'completed',
          progressPercent: 100,
          statusMessage: '¡Importación de archivo de audio completada!',
          resultDoc: saved,
          error: null
        });

        return saved;
      } catch (err) {
        if (abortSignal.aborted || (err.message && (err.message.includes('cancelada') || err.message.includes('abort')))) {
          console.log('[LocalAudioImportManager] Task was explicitly cancelled.');
          this.updateState({
            status: 'cancelled',
            statusMessage: 'Importación cancelada.',
            error: null
          });
        } else {
          console.error('[LocalAudioImportManager] Import error:', err);
          const errorMsg = err.message || 'Error durante la transcripción del audio.';
          this.updateState({
            status: 'error',
            statusMessage: `Error al importar: ${errorMsg}`,
            error: errorMsg
          });
        }
        throw err;
      } finally {
        this.abortController = null;
        this.activeTaskPromise = null;
      }
    })();

    return this.activeTaskPromise;
  }
}

export const localAudioImportManager = new LocalAudioImportManager();
