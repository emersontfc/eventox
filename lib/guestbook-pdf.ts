import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import { acceptableGuestbookImage } from './guestbook-images';
import { storage } from './storage';

const pageSize: [number, number] = [595.28, 841.89];
const paper = rgb(0.98, 0.965, 0.941);
const ink = rgb(0.11, 0.16, 0.19);
const accent = rgb(0.47, 0.23, 0.17);
const muted = rgb(0.37, 0.34, 0.31);

export function pdfText(value: string, font: PDFFont) {
  const allowed = new Set(font.getCharacterSet());
  return Array.from(value.normalize('NFC').replace(/\r\n?|[\u2028\u2029]/g, '\n').replace(/\t/g, ' '))
    .filter(char => char === '\n' || allowed.has(char.codePointAt(0)!))
    .join('').trim();
}

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of pdfText(value, font).split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      for (const char of word) {
        if (line && font.widthOfTextAtSize(line + char, size) > width) {
          lines.push(line);
          line = '';
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

type Dedication = { senderName: string; relationship: string | null; message: string; photoKey: string | null };
type Photo = { key: string; caption: string };

export async function makeGuestbookPdf(options: {
  title: string;
  date: string;
  volume: number;
  dedications: Dedication[];
  gallery: Photo[];
}) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Livro de recordações · ${options.title}`);
  doc.setAuthor('EventoX');
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let remainingBytes = 16 * 1024 * 1024;
  let remainingPixels = 36_000_000;

  async function image(key: string) {
    if (remainingBytes < 256 || remainingPixels < 1) return null;
    try {
      const object = await storage.get(key);
      if (!object) return null;
      if (object.size && object.size > remainingBytes) {
        await new Response(object.body).body?.cancel();
        return null;
      }
      const bytes = Buffer.from(await new Response(object.body).arrayBuffer());
      if (bytes.length > remainingBytes) return null;
      const details = acceptableGuestbookImage(bytes);
      if (!details) return null;
      const pixels = details.width * details.height;
      if (pixels > remainingPixels) return null;
      const result = details.extension === 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
      remainingBytes -= bytes.length;
      remainingPixels -= pixels;
      return result;
    } catch {
      return null;
    }
  }

  function page() {
    const current = doc.addPage(pageSize);
    current.drawRectangle({ x: 0, y: 0, width: pageSize[0], height: pageSize[1], color: paper });
    current.drawLine({ start: { x: 52, y: 56 }, end: { x: 543, y: 56 }, color: accent, thickness: 0.5 });
    current.drawText('EVENTOX', { x: 52, y: 37, font: sans, size: 9, color: muted });
    current.drawText(String(doc.getPageCount()), { x: 525, y: 37, font: sans, size: 9, color: muted });
    return current;
  }

  const cover = page();
  cover.drawRectangle({ x: 34, y: 93, width: 527, height: 662, borderColor: accent, borderWidth: 1 });
  cover.drawText('Livro de recordações', { x: 66, y: 674, font: italic, size: 27, color: accent });
  const title = wrap(options.title, serif, 42, 463).slice(0, 7).filter(Boolean);
  for (let index = 0; index < title.length; index += 1) {
    cover.drawText(title[index], { x: 66, y: 603 - index * 49, font: serif, size: 42, color: ink });
  }
  cover.drawText(pdfText(options.date, sans), { x: 66, y: 200, font: sans, size: 14, color: muted });
  if (options.volume > 1) cover.drawText(`Volume ${options.volume}`, { x: 66, y: 173, font: sans, size: 12, color: muted });

  for (const dedication of options.dedications) {
    const current = page();
    let y = 748;
    for (const line of wrap(dedication.senderName, bold, 21, 478).slice(0, 4)) {
      current.drawText(line, { x: 58, y, font: bold, size: 21, color: ink });
      y -= 26;
    }
    if (dedication.relationship) {
      for (const line of wrap(dedication.relationship, sans, 13, 478).slice(0, 2)) {
        current.drawText(line, { x: 58, y, font: sans, size: 13, color: accent });
        y -= 17;
      }
    }
    y -= 12;
    const message = wrap(dedication.message.replace(/\n{3,}/g, '\n\n'), serif, 18, 478);
    // The form accepts 500 characters. Large numbers of explicit line breaks may need a continuation page.
    let writingPage = current;
    for (const line of message) {
      if (y < 90) {
        writingPage = page();
        y = 750;
      }
      writingPage.drawText(line, { x: 58, y, font: serif, size: 18, color: ink });
      y -= 25;
    }
    const attachment = dedication.photoKey ? await image(dedication.photoKey) : null;
    if (attachment) {
      if (y < 275) {
        writingPage = page();
        y = 750;
      }
      const fit = attachment.scaleToFit(478, Math.min(y - 90, 382));
      writingPage.drawImage(attachment, { x: (pageSize[0] - fit.width) / 2, y: y - fit.height, ...fit });
    }
  }

  let galleryPage: ReturnType<typeof page> | undefined;
  let position = 0;
  for (const photo of options.gallery) {
    const attachment = await image(photo.key);
    if (!attachment) continue;
    if (!galleryPage || position === 4) {
      galleryPage = page();
      galleryPage.drawText('Galeria de recordações', { x: 52, y: 750, font: serif, size: 28, color: accent });
      position = 0;
    }
    const x = 52 + (position % 2) * 251;
    const y = 704 - Math.floor(position / 2) * 287;
    const fit = attachment.scaleToFit(240, 247);
    galleryPage.drawImage(attachment, { x: x + (240 - fit.width) / 2, y: y - fit.height, ...fit });
    const caption = wrap(photo.caption, sans, 11, 236).slice(0, 2);
    caption.forEach((line, index) => galleryPage!.drawText(line, {
      x: x + 2, y: y - fit.height - 16 - index * 14, font: sans, size: 11, color: muted,
    }));
    position += 1;
  }

  return doc.save();
}
