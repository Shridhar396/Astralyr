import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, colorGen) {
  // RGBA buffer with filter byte per scanline
  const rowSize = 1 + width * 4;
  const buffer = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    buffer[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = colorGen(x, y, width, height);
      buffer[pixelOffset] = r;
      buffer[pixelOffset + 1] = g;
      buffer[pixelOffset + 2] = b;
      buffer[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(buffer);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, 8 + length));
  chunk.writeInt32BE(crc, 8 + length);
  return chunk;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return crc ^ -1;
}

const table = new Int32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c;
}

function ambientIconShader(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = (x - cx) / (w / 2);
  const dy = (y - cy) / (h / 2);
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 0.95) return [0, 0, 0, 0];

  // Glowing ring with cyan to magenta gradient
  const ringDist = Math.abs(dist - 0.65);
  const inRing = ringDist < 0.25;

  const t = (dx + 1) / 2;
  const r = Math.floor(t * 254 + (1 - t) * 0);
  const g = Math.floor(t * 1 + (1 - t) * 242);
  const b = Math.floor(t * 154 + (1 - t) * 254);

  if (inRing) {
    const alpha = Math.floor((1 - ringDist / 0.25) * 255);
    return [r, g, b, alpha];
  }

  // Soft dark glass background
  return [12, 18, 32, 220];
}

const iconsDir = path.resolve('src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(path.join(iconsDir, '32x32.png'), createPNG(32, 32, ambientIconShader));
fs.writeFileSync(path.join(iconsDir, '128x128.png'), createPNG(128, 128, ambientIconShader));
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), createPNG(256, 256, ambientIconShader));
fs.writeFileSync(path.join(iconsDir, 'icon.png'), createPNG(512, 512, ambientIconShader));

// Create a basic .ico containing the 32x32 PNG
const png32 = fs.readFileSync(path.join(iconsDir, '32x32.png'));
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
icoHeader.writeUInt16LE(1, 4); // 1 Image

const icoDir = Buffer.alloc(16);
icoDir[0] = 32; // Width
icoDir[1] = 32; // Height
icoDir[2] = 0;  // Color count
icoDir[3] = 0;  // Reserved
icoDir.writeUInt16LE(1, 4);  // Color planes
icoDir.writeUInt16LE(32, 6); // Bits per pixel
icoDir.writeUInt32LE(png32.length, 8); // Image size
icoDir.writeUInt32LE(22, 12); // Offset to image data (6 + 16 = 22)

fs.writeFileSync(path.join(iconsDir, 'icon.ico'), Buffer.concat([icoHeader, icoDir, png32]));
console.log('Successfully generated all Tauri app and tray icons!');

