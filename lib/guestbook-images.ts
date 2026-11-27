import { GUESTBOOK_PHOTO_MAX_BYTES } from './guestbook';

const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function jpegDimensions(bytes: Buffer) {
  let cursor = 2;
  while (cursor + 4 < bytes.length && bytes[cursor++] === 0xff) {
    while (bytes[cursor] === 0xff) cursor += 1;
    const marker = bytes[cursor++];
    if (marker === undefined || marker === 0xda || marker === 0xd9) return null;
    const length = bytes.readUInt16BE(cursor);
    if (length < 2 || cursor + length > bytes.length) return null;
    if ((marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker) && length >= 8) {
      return { height: bytes.readUInt16BE(cursor + 3), width: bytes.readUInt16BE(cursor + 5) };
    }
    cursor += length;
  }
  return null;
}

export function guestbookImageInfo(bytes: Buffer) {
  if (!bytes.length || bytes.length > GUESTBOOK_PHOTO_MAX_BYTES) return null;
  if (bytes.length > 24 && bytes.subarray(0, 8).equals(pngMagic) && bytes.toString('ascii', 12, 16) === 'IHDR') {
    return { extension: 'png' as const, mime: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length > 8 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const dimensions = jpegDimensions(bytes);
    return dimensions && { extension: 'jpg' as const, mime: 'image/jpeg', ...dimensions };
  }
  return null;
}

export function acceptableGuestbookImage(bytes: Buffer) {
  const image = guestbookImageInfo(bytes);
  return image && image.width > 0 && image.height > 0 && image.width * image.height <= 25_000_000 ? image : null;
}
