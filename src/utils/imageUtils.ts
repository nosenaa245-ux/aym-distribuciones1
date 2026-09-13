/**
 * Utility functions for image optimization, resizing, compression, and URL normalization.
 * Ensures images saved to the local database are optimized,
 * loading instantly and conserving storage.
 */

/**
 * Normalizes user-entered image URLs (e.g. converting Google Drive and Dropbox share links
 * to direct embeddable image streams).
 */
export function normalizeImageUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  // Handle Google Drive links
  // Format 1: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // Format 2: https://drive.google.com/open?id=FILE_ID
  const gDriveMatch = trimmed.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i);
  if (gDriveMatch && gDriveMatch[1]) {
    // lh3.googleusercontent.com is Google's fast CDN for drive images
    return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
  }

  // Handle Dropbox links: replace dl=0 with raw=1
  if (trimmed.includes('dropbox.com')) {
    if (trimmed.includes('dl=0')) {
      return trimmed.replace('dl=0', 'raw=1');
    }
    if (!trimmed.includes('raw=1')) {
      const sep = trimmed.includes('?') ? '&' : '?';
      return `${trimmed}${sep}raw=1`;
    }
  }

  return trimmed;
}

/**
 * Format bytes to readable human text (e.g. "45 KB")
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Calculate approximate byte size of a base64 Data URL string
 */
export function getBase64Size(dataUrl: string): number {
  if (!dataUrl || !dataUrl.startsWith('data:')) return 0;
  const base64Content = dataUrl.split(',')[1] || '';
  const padding = (base64Content.match(/=+$/) || [''])[0].length;
  return Math.floor((base64Content.length * 3) / 4) - padding;
}

/**
 * Loads an image from a source (File or Data URL) into an HTMLImageElement
 */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('No se pudo cargar la imagen para procesarla: ' + err));
    img.src = src;
  });
}

/**
 * Resizes and compresses an image (File or base64 string) using HTML5 Canvas.
 * Produces an optimized JPEG data URL typically between 25KB and 70KB,
 * fitting safely and loading with maximum performance.
 */
export async function compressAndResizeImage(
  source: File | string,
  maxWidth = 750,
  maxHeight = 750,
  initialQuality = 0.82
): Promise<{ dataUrl: string; originalSize: number; compressedSize: number }> {
  let sourceUrl = '';
  let originalSize = 0;

  if (source instanceof File) {
    originalSize = source.size;
    sourceUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(source);
    });
  } else if (typeof source === 'string') {
    sourceUrl = source;
    originalSize = getBase64Size(source) || source.length;
  } else {
    throw new Error('Formato de imagen no soportado');
  }

  // If it's already an SVG or small icon, don't re-compress if it's already tiny
  if (sourceUrl.startsWith('data:image/svg+xml') && originalSize < 100000) {
    return { dataUrl: sourceUrl, originalSize, compressedSize: originalSize };
  }

  const img = await loadImageElement(sourceUrl);

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  // Calculate new dimensions preserving aspect ratio
  if (width > maxWidth || height > maxHeight) {
    if (width / maxWidth > height / maxHeight) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    } else {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }
  }

  // Ensure minimum dimensions
  width = Math.max(1, width);
  height = Math.max(1, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el lienzo para procesar la imagen');
  }

  // Draw smooth background (white for transparency handling in jpeg)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Enable high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(img, 0, 0, width, height);

  // First compression attempt
  let quality = initialQuality;
  let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
  let compressedSize = getBase64Size(compressedDataUrl);

  // If size is somehow still > 200KB, drop quality slightly
  if (compressedSize > 200 * 1024 && quality > 0.6) {
    quality = 0.68;
    compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
    compressedSize = getBase64Size(compressedDataUrl);
  }

  return {
    dataUrl: compressedDataUrl,
    originalSize,
    compressedSize,
  };
}
