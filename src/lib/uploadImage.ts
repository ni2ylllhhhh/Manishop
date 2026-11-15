export const DEFAULT_IMGBB_API_KEY = '2b68aa2cef89793027650e5863d2ae34';
const LEGACY_IMGBB_KEYS = new Set(['f7be34ce0b6f4d15277479fb781d6607']);

export function resolveImgbbApiKey(imgbbApiKey?: string): string {
  const trimmed = (imgbbApiKey || '').trim();
  if (!trimmed || LEGACY_IMGBB_KEYS.has(trimmed)) {
    return DEFAULT_IMGBB_API_KEY;
  }
  return trimmed;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });
}

async function decodeImageDimensions(
  file: File
): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; cleanup: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        cleanup: () => bitmap.close()
      };
    } catch {
      // Fall through to Image + ObjectURL
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Invalid image file'));
      el.src = objectUrl;
    });
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      cleanup: () => URL.revokeObjectURL(objectUrl)
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

/**
 * Compresses any image File down to a lightweight binary JPEG Blob (~40-90 KB)
 * BEFORE uploading, so even slow mobile networks upload in ~1 second.
 */
export async function compressImageToBlob(
  file: File,
  maxDimension = 960,
  quality = 0.72
): Promise<Blob> {
  // Already tiny (< 90 KB) — skip canvas work completely
  if (file.size > 0 && file.size <= 90 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
    return file;
  }

  const decoded = await decodeImageDimensions(file);
  try {
    const maxSide = Math.max(decoded.width, decoded.height, 1);
    const scale = maxSide > maxDimension ? maxDimension / maxSide : 1;
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // Fill white background in case PNG has transparency
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    decoded.draw(ctx, width, height);

    const blob = await canvasToJpegBlob(canvas, quality);
    return blob && blob.size > 0 ? blob : file;
  } finally {
    decoded.cleanup();
  }
}

export async function compressImageToDataUrl(
  file: File,
  maxDimension = 960,
  quality = 0.72
): Promise<string> {
  const blob = await compressImageToBlob(file, maxDimension, quality);
  return blobToDataUrl(blob);
}

async function postToImgbb(key: string, imagePayload: Blob | string, timeoutMs = 10000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const formData = new FormData();
    if (typeof imagePayload === 'string') {
      formData.append('image', imagePayload);
    } else {
      formData.append('image', imagePayload, 'proof.jpg');
    }
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.display_url || data?.data?.url || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Compresses image first to ~40-90 KB JPEG, then uploads binary Blob to ImgBB
 * with a strict 10s timeout and instant compressed DataURL fallback.
 */
export async function uploadProofImage(file: File, imgbbApiKey?: string): Promise<string> {
  const key = resolveImgbbApiKey(imgbbApiKey);

  // 1. Compress BEFORE upload so multi-MB phone screenshots drop to ~50 KB in <100ms
  let compressedBlob: Blob;
  try {
    compressedBlob = await compressImageToBlob(file, 960, 0.72);
  } catch {
    compressedBlob = file;
  }

  // 2. Upload lightweight binary Blob directly to ImgBB (with 10s timeout)
  const uploadedUrl = await postToImgbb(key, compressedBlob, 10000);
  if (uploadedUrl) return uploadedUrl;

  // 3. Fast local compressed fallback if ImgBB is blocked or times out
  return blobToDataUrl(compressedBlob);
}
