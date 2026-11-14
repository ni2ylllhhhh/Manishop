export const DEFAULT_IMGBB_API_KEY = '2b68aa2cef89793027650e5863d2ae34';
const LEGACY_IMGBB_KEYS = new Set(['f7be34ce0b6f4d15277479fb781d6607']);

export function resolveImgbbApiKey(imgbbApiKey?: string): string {
  const trimmed = (imgbbApiKey || '').trim();
  if (!trimmed || LEGACY_IMGBB_KEYS.has(trimmed)) {
    return DEFAULT_IMGBB_API_KEY;
  }
  return trimmed;
}

/**
 * Compresses an image File into a JPEG Data URL (used both for base64 ImgBB retry and offline fallback).
 */
export async function compressImageToDataUrl(file: File, maxWidth = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

async function postToImgbb(key: string, imagePayload: File | string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('image', imagePayload);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.display_url || data?.data?.url || null;
  } catch {
    return null;
  }
}

/**
 * Uploads any image (task proof screenshot, admin banner, profile photo, broadcast photo)
 * directly to ImgBB hosting so the returned URL is permanently accessible everywhere.
 */
export async function uploadProofImage(file: File, imgbbApiKey?: string): Promise<string> {
  const key = resolveImgbbApiKey(imgbbApiKey);

  // 1. Direct upload to ImgBB
  const directUrl = await postToImgbb(key, file);
  if (directUrl) return directUrl;

  // 2. If large phone photo or format issue caused rejection, compress and upload base64 to ImgBB
  const compressedDataUrl = await compressImageToDataUrl(file, 1280, 0.8);
  const base64Body = compressedDataUrl.includes(',')
    ? compressedDataUrl.split(',')[1]
    : compressedDataUrl;

  if (base64Body) {
    const compressedUrl = await postToImgbb(key, base64Body);
    if (compressedUrl) return compressedUrl;
  }

  // 3. Offline fallback if device has no network access to ImgBB
  return compressedDataUrl;
}
