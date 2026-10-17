// Read pixel dimensions from image headers (JPEG, PNG, WebP, GIF, SVG) without
// any dependencies, so every <img> can carry width/height and avoid layout shift.
import { readFileSync } from 'node:fs';

export function imageSize(file) {
  const buf = readFileSync(file);
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
    if (buf.toString('ascii', 0, 3) === 'GIF') {
      return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) return jpegSize(buf);
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return webpSize(buf);
    if (/\.svg$/i.test(file)) return svgSize(buf.toString('utf8', 0, 2000));
  } catch {
    // fall through: unknown or truncated file
  }
  return null;
}

function jpegSize(buf) {
  let o = 2;
  let orientation = 1;
  while (o + 9 < buf.length) {
    if (buf[o] !== 0xff) { o++; continue; }
    const marker = buf[o + 1];
    if (marker === 0xff) { o++; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
    const len = buf.readUInt16BE(o + 2);
    if (marker === 0xe1 && buf.toString('ascii', o + 4, o + 8) === 'Exif') {
      orientation = exifOrientation(buf, o + 10) || 1;
    }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = buf.readUInt16BE(o + 5);
      const width = buf.readUInt16BE(o + 7);
      // Phone photos are often stored sideways with an EXIF rotation flag;
      // browsers honour it, so report the dimensions as displayed.
      return orientation >= 5 ? { width: height, height: width } : { width, height };
    }
    o += 2 + len;
  }
  return null;
}

function exifOrientation(buf, tiff) {
  const le = buf.toString('ascii', tiff, tiff + 2) === 'II';
  const u16 = (p) => (le ? buf.readUInt16LE(p) : buf.readUInt16BE(p));
  const u32 = (p) => (le ? buf.readUInt32LE(p) : buf.readUInt32BE(p));
  const ifd = tiff + u32(tiff + 4);
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (u16(entry) === 0x0112) return u16(entry + 8);
  }
  return 1;
}

function webpSize(buf) {
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  return null;
}

function svgSize(head) {
  const tag = /<svg\b[^>]*>/i.exec(head);
  if (!tag) return null;
  const num = (name) => {
    const m = new RegExp(`\\s${name}="([\\d.]+)(px)?"`).exec(tag[0]);
    return m ? Math.round(+m[1]) : 0;
  };
  const width = num('width');
  const height = num('height');
  if (width && height) return { width, height };
  const vb = /viewBox="[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)"/.exec(tag[0]);
  return vb ? { width: Math.round(+vb[1]), height: Math.round(+vb[2]) } : null;
}
