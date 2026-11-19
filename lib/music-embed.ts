export interface EmbedInfo {
  type: 'youtube' | 'spotify' | 'soundcloud' | 'audio' | 'youtube-search';
  embedUrl: string;
  sourceLabel: string;
}

export function parseMusicEmbed(url?: string | null, searchFallback?: string | null): EmbedInfo | null {
  const cleanUrl = (url || '').trim();

  if (cleanUrl) {
    // 1. YouTube video / shorts / youtu.be
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i;
    const ytMatch = cleanUrl.match(ytRegex);
    if (ytMatch && ytMatch[1]) {
      return {
        type: 'youtube',
        embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0`,
        sourceLabel: 'YouTube',
      };
    }

    // 2. Spotify track / playlist / album
    const spotRegex = /open\.spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/i;
    const spotMatch = cleanUrl.match(spotRegex);
    if (spotMatch) {
      return {
        type: 'spotify',
        embedUrl: `https://open.spotify.com/embed/${spotMatch[1]}/${spotMatch[2]}?utm_source=generator&theme=0`,
        sourceLabel: 'Spotify',
      };
    }

    // 3. Direct audio file
    if (/\.(mp3|wav|ogg|m4a)($|\?)/i.test(cleanUrl)) {
      return {
        type: 'audio',
        embedUrl: cleanUrl,
        sourceLabel: 'Ficheiro de Áudio',
      };
    }

    // 4. SoundCloud
    if (/soundcloud\.com/i.test(cleanUrl)) {
      return {
        type: 'soundcloud',
        embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(cleanUrl)}&color=%23d4af37&auto_play=true`,
        sourceLabel: 'SoundCloud',
      };
    }
  }

  // 5. Search fallback on YouTube if song title/artist given
  if (searchFallback && searchFallback.trim().length > 1) {
    return {
      type: 'youtube-search',
      embedUrl: `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(searchFallback.trim())}&autoplay=1`,
      sourceLabel: 'YouTube Search',
    };
  }

  return null;
}
