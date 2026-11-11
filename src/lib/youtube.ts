/**
 * Helper utilities for YouTube video URLs, IDs, thumbnails, and embedding
 */

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // If already an 11-char alphanumeric ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Common YouTube URL patterns:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  // - https://www.youtube.com/shorts/VIDEO_ID
  // - https://m.youtube.com/watch?v=VIDEO_ID
  const regExp = /(?:youtube(?:-nocookie)?\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);

  return match && match[1] ? match[1] : null;
}

export function getYouTubeThumbnail(url: string, quality: 'mq' | 'max' | 'hq' = 'mq'): string {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80';
  }
  // Note: mqdefault.jpg (320x180) is native 16:9 on YouTube without any top/bottom black bars!
  // hqdefault.jpg is 4:3 with letterboxed black bars, so mq is preferred for clean display.
  const filename = quality === 'max' ? 'maxresdefault.jpg' : quality === 'hq' ? 'hqdefault.jpg' : 'mqdefault.jpg';
  return `https://i.ytimg.com/vi/${videoId}/${filename}`;
}

export function getYouTubeEmbedUrl(url: string, autoplay = true): string {
  const videoId = extractYouTubeId(url);
  if (!videoId) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
    iv_load_policy: '3',
    fs: '0',
    disablekb: '1',
    controls: '1',
    vq: 'medium'
  });
  if (origin) {
    params.set('origin', origin);
  }
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
