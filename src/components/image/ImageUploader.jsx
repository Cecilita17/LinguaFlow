import React, { useRef, useState, useCallback } from 'react';
import { Camera, Image as ImageIcon, X, RefreshCw, Upload, AlertCircle } from 'lucide-react';
import { compressAndPrepareImage } from '../../services/imageDescriptionService.js';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';

/**
 * ImageUploader
 *
 * Provides a mobile touch-friendly and desktop drag-and-drop interface for:
 * 1. Taking a photo directly with the device camera (`capture="environment"`).
 * 2. Selecting an existing photo from the gallery / file system.
 * 3. Compressing and resizing in the client before passing to the parent.
 * 4. Displaying a clean preview with dimension/size statistics.
 */
export function ImageUploader({
  image = null,
  onImageSelected,
  onImageCleared,
  disabled = false
}) {
  const { isSpanish } = useSiteLanguage();
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = useCallback(async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage(
        isSpanish
          ? 'El archivo seleccionado no es una imagen válida.'
          : 'The selected file is not a valid image.'
      );
      return;
    }

    // 25MB raw file safety ceiling
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage(
        isSpanish
          ? 'La imagen es demasiado grande (máximo 25 MB antes de comprimir).'
          : 'Image is too large (maximum 25 MB before compression).'
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const prepared = await compressAndPrepareImage(file, 1280, 0.82);
      if (onImageSelected) {
        onImageSelected(prepared);
      }
    } catch (err) {
      console.warn('Image compression error:', err);
      setErrorMessage(
        err.message ||
        (isSpanish
          ? 'Error al procesar la imagen. Inténtalo de nuevo.'
          : 'Error processing the image. Please try again.')
      );
    } finally {
      setIsProcessing(false);
      // Reset input values so selecting the same file again triggers onChange
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isSpanish, onImageSelected]);

  const handleCameraChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const formatSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      {/* Hidden file inputs for camera and gallery */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraChange}
        disabled={disabled || isProcessing}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isProcessing}
      />

      {/* Case A: Image already selected -> Preview state */}
      {image && image.dataUrl ? (
        <div className="relative rounded-3xl overflow-hidden border border-[var(--border-primary)] bg-[var(--surface-primary)] shadow-md group">
          <div className="relative aspect-video sm:aspect-21/9 max-h-80 w-full bg-black/90 flex items-center justify-center overflow-hidden">
            <img
              src={image.dataUrl}
              alt="Preview"
              className="max-h-full max-w-full object-contain transition-transform duration-300"
            />
            {/* Top action buttons */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isProcessing}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white backdrop-blur-md shadow-md border border-white/10 transition-all cursor-pointer"
                title={isSpanish ? 'Cambiar imagen' : 'Change image'}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onImageCleared}
                disabled={disabled || isProcessing}
                className="p-2 rounded-xl bg-rose-900/80 hover:bg-rose-800 text-white backdrop-blur-md shadow-md border border-white/10 transition-all cursor-pointer"
                title={isSpanish ? 'Eliminar imagen' : 'Remove image'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom info chip */}
            <div className="absolute bottom-2.5 left-3 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[11px] font-mono text-white/90 border border-white/10 flex items-center gap-2">
              <span>{image.width}×{image.height}</span>
              {image.originalSize > 0 && image.compressedSize > 0 && (
                <>
                  <span className="text-white/40">•</span>
                  <span>{formatSize(image.originalSize)} → <strong className="text-emerald-400">{formatSize(image.compressedSize)}</strong></span>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Case B: No image selected -> Dropzone & Actions */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-3xl border-2 border-dashed p-6 sm:p-10 transition-all duration-200 text-center flex flex-col items-center justify-center ${
            isDragging
              ? 'border-rose-500 bg-rose-500/10'
              : 'border-[var(--border-primary)] bg-[var(--surface-primary)] hover:border-rose-500/50 hover:bg-[var(--surface-secondary)]'
          } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center py-6 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mb-3 animate-spin">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[var(--text-primary)]">
                {isSpanish ? 'Optimizando imagen...' : 'Optimizing image...'}
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {isSpanish ? 'Redimensionando para un procesamiento veloz' : 'Resizing for fast processing'}
              </p>
            </div>
          ) : (
            <>
              {/* Icon */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/30 mb-4 shrink-0">
                <Camera className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>

              {/* Title & Description */}
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1">
                {isSpanish ? 'Agrega una imagen o toma una foto' : 'Add an image or take a photo'}
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mb-6 leading-relaxed">
                {isSpanish
                  ? 'Toma una foto de lo que te rodea o sube una imagen de tu galería para que la IA la describa en el idioma que estás aprendiendo.'
                  : 'Take a photo of your surroundings or upload an image from your gallery for the AI to describe in the language you are learning.'}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-sm">
                {/* Button 1: Camera */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={disabled || isProcessing}
                  className="flex-1 min-w-[140px] px-4 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>{isSpanish ? 'Tomar foto' : 'Take photo'}</span>
                </button>

                {/* Button 2: File Gallery */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || isProcessing}
                  className="flex-1 min-w-[140px] px-4 py-3 rounded-2xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] font-bold text-xs sm:text-sm shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <ImageIcon className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{isSpanish ? 'Galería' : 'Gallery'}</span>
                </button>
              </div>

              {/* Drag notice for desktop */}
              <p className="hidden sm:block text-[11px] text-[var(--text-muted)] mt-4">
                {isSpanish ? 'O arrastra y suelta tu archivo aquí (JPEG, PNG, WebP)' : 'Or drag and drop your file here (JPEG, PNG, WebP)'}
              </p>
            </>
          )}
        </div>
      )}

      {/* Error notice */}
      {errorMessage && (
        <div className="mt-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-200 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

export default ImageUploader;
