/**
 * Image Description Service for LinguaFlow
 * Handles client-side image compression/resizing and communicates with the backend
 * Groq Vision endpoint (/api/image-description).
 */

import { API_BASE_URL } from './chatService.js';

/**
 * Resizes and compresses an image file in the browser using HTML5 Canvas.
 * Keeps payload lightweight (~100-300KB) to minimize latency, token usage, and memory.
 *
 * @param {File} file - The raw image file from file input or camera capture
 * @param {number} [maxDimension=1280] - Maximum width or height in pixels
 * @param {number} [quality=0.8] - JPEG quality (0.0 to 1.0)
 * @returns {Promise<{ dataUrl: string, base64: string, mimeType: string, width: number, height: number, originalSize: number, compressedSize: number }>}
 */
export async function compressAndPrepareImage(file, maxDimension = 1280, quality = 0.8) {
  if (!file || !(file instanceof Blob)) {
    throw new Error('Archivo de imagen no válido.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        // Scale proportionally if either dimension exceeds maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('No se pudo inicializar el contexto de imagen.'));
        }

        // Draw image resized onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        const targetMimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(targetMimeType, quality);
        const parts = dataUrl.split(',');
        const base64 = parts[1] || '';

        const approxCompressedSize = Math.round((base64.length * 3) / 4);

        resolve({
          dataUrl,
          base64,
          mimeType: targetMimeType,
          width,
          height,
          originalSize: file.size || 0,
          compressedSize: approxCompressedSize
        });
      };

      img.onerror = () => {
        reject(new Error('No se pudo decodificar la imagen seleccionada.'));
      };

      img.src = readerEvent.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Error al leer el archivo de imagen local.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Requests an AI pedagogical image description from the backend Groq Vision model.
 *
 * @param {Object} params
 * @param {string} params.imageBase64 - Base64 encoded image string (without data: prefix)
 * @param {string} [params.mimeType='image/jpeg'] - Image MIME type
 * @param {string} params.targetLang - Target language code (e.g. 'zh', 'ar', 'en', 'es', 'pl')
 * @param {string} [params.nativeLang='es'] - User native language code
 * @param {string} [params.level='B1'] - CEFR level ('A1', 'A2', 'B1', 'B2', 'C1')
 * @param {string} [params.apiKey=''] - Optional client override API key
 * @returns {Promise<{ success: boolean, title: string, description: string, model?: string }>}
 */
export async function describeImageApi({
  imageBase64,
  mimeType = 'image/jpeg',
  targetLang,
  nativeLang = 'es',
  level = 'B1',
  apiKey = ''
}) {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    throw new Error('Se requiere el contenido de la imagen en formato Base64.');
  }
  if (!targetLang) {
    throw new Error('Se requiere especificar el idioma objetivo (targetLang).');
  }

  const endpoint = `${API_BASE_URL || ''}/api/image-description`;

  const headers = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      imageBase64,
      mimeType,
      targetLang,
      nativeLang,
      level
    })
  });

  if (!response.ok) {
    let errorMsg = `Error ${response.status} al procesar la imagen con IA`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.error) {
        errorMsg = errJson.error;
      }
    } catch (e) {}
    throw new Error(errorMsg);
  }

  const data = await response.json();
  if (!data || !data.success) {
    throw new Error(data?.error || 'No se pudo generar la descripción pedagógica de la imagen.');
  }

  return {
    success: true,
    title: data.title || '',
    description: data.description || '',
    model: data.model || ''
  };
}
