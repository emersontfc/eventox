export const galleryMimeExtensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
} as const;

export type GalleryMime = keyof typeof galleryMimeExtensions;

const extensionMimes: Record<string, GalleryMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

export const galleryMoments = ['Momentos especiais', 'Cerimónia', 'Família e amigos', 'Jantar e brinde', 'Festa e dança'] as const;

export function galleryFileMime(file: Pick<File, 'type' | 'name'>): GalleryMime | null {
  if (Object.hasOwn(galleryMimeExtensions, file.type)) return file.type as GalleryMime;
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.type && file.type !== 'application/octet-stream') return null;
  return Object.hasOwn(extensionMimes, extension) ? extensionMimes[extension] : null;
}

export function galleryFileIssue(file: Pick<File, 'type' | 'name' | 'size'>): string | null {
  const mime = galleryFileMime(file);
  if (!mime) return 'Formato não suportado. Usa JPG, PNG, WebP, HEIC, MP4, WebM ou MOV.';
  if (file.size < 1) return 'Este ficheiro está vazio.';
  const video = mime.startsWith('video/');
  if (file.size > (video ? 50 : 15) * 1024 * 1024) {
    return video ? 'O vídeo excede 50 MB.' : 'A foto excede 15 MB.';
  }
  return null;
}
