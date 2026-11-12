import { spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const USER_DATA = path.join(process.env.TEMP || 'C:\\Temp', 'edge_icon_cdp_' + Date.now());

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Build standard multi-resolution Windows ICO file containing PNG streams
function buildIco(images) {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // ICO format
  header.writeUInt16LE(count, 4); // Image count

  let currentOffset = 6 + count * 16;
  const dirEntries = [];

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry[0] = img.width >= 256 ? 0 : img.width;
    entry[1] = img.height >= 256 ? 0 : img.height;
    entry[2] = 0; // Palette color count
    entry[3] = 0; // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(img.buffer.length, 8); // Data size
    entry.writeUInt32LE(currentOffset, 12); // Data offset
    dirEntries.push(entry);
    currentOffset += img.buffer.length;
  }

  const buffers = [header, ...dirEntries, ...images.map((img) => img.buffer)];
  return Buffer.concat(buffers);
}

// Build standard Apple macOS ICNS file containing modern PNG icon chunks
function buildIcns(entries) {
  const chunks = [];
  let totalSize = 8; // 'icns' + length

  for (const e of entries) {
    const chunkHeader = Buffer.alloc(8);
    chunkHeader.write(e.tag, 0, 4, 'ascii');
    const chunkSize = 8 + e.buffer.length;
    chunkHeader.writeUInt32BE(chunkSize, 4);
    chunks.push(chunkHeader, e.buffer);
    totalSize += chunkSize;
  }

  const fileHeader = Buffer.alloc(8);
  fileHeader.write('icns', 0, 4, 'ascii');
  fileHeader.writeUInt32BE(totalSize, 4);

  return Buffer.concat([fileHeader, ...chunks]);
}

async function run() {
  console.log('1. Spawning Edge browser for high-definition hardware canvas rendering...');
  const edgeProc = spawn(
    EDGE_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9223',
      `--user-data-dir=${USER_DATA}`,
      '--disable-gpu',
      '--no-sandbox',
    ],
    { stdio: 'ignore' }
  );

  let cdpWsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(350);
    try {
      const res = await fetch('http://127.0.0.1:9223/json/version');
      if (res.ok) {
        const json = await res.json();
        cdpWsUrl = json.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!cdpWsUrl) {
    console.error('Failed to connect to CDP on 9223');
    edgeProc.kill('SIGKILL');
    return;
  }

  let targets = [];
  try {
    const listRes = await fetch('http://127.0.0.1:9223/json/list');
    targets = await listRes.json();
  } catch {}

  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  function send(method, params = {}) {
    const msgId = id++;
    return new Promise((resolve, reject) => {
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await new Promise((resolve) => {
    ws.onopen = resolve;
  });

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');

  console.log('2. Navigating to local Vite server...');
  await send('Page.navigate', { url: 'http://localhost:5173/' });
  await sleep(1500);

  console.log('3. Injecting image rendering and scaling functions into page...');
  const setupScript = `
    window.renderResized = function(srcUrl, targetW, targetH, maskablePadding = false) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          if (maskablePadding) {
            ctx.fillStyle = '#050608';
            ctx.fillRect(0, 0, targetW, targetH);
            const insetW = targetW * 0.78;
            const insetH = targetH * 0.78;
            const offsetX = (targetW - insetW) / 2;
            const offsetY = (targetH - insetH) / 2;
            ctx.drawImage(img, offsetX, offsetY, insetW, insetH);
          } else {
            ctx.clearRect(0, 0, targetW, targetH);
            ctx.drawImage(img, 0, 0, targetW, targetH);
          }
          resolve(canvas.toDataURL('image/png').split(',')[1]);
        };
        img.onerror = () => reject(new Error('Failed to load ' + srcUrl));
        img.src = srcUrl;
      });
    };

    window.renderSocialOg = function(srcUrl) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 1280;
          canvas.height = 640;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, 1280, 640);

          const scale = Math.min(1280 / img.width, 640 / img.height) * 0.95;
          const destW = img.width * scale;
          const destH = img.height * scale;
          const destX = (1280 - destW) / 2;
          const destY = (640 - destH) / 2;

          ctx.drawImage(img, destX, destY, destW, destH);
          resolve(canvas.toDataURL('image/png').split(',')[1]);
        };
        img.onerror = () => reject(new Error('Failed to load ' + srcUrl));
        img.src = srcUrl;
      });
    };
  `;

  await send('Runtime.evaluate', { expression: setupScript });

  const renderPng = async (targetW, targetH, maskable = false) => {
    const res = await send('Runtime.evaluate', {
      expression: `window.renderResized('/icon-512.png', ${targetW}, ${targetH}, ${maskable})`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (!res || !res.result || !res.result.value) {
      console.error('Render error:', JSON.stringify(res));
      throw new Error('Canvas render failed: ' + JSON.stringify(res));
    }
    return Buffer.from(res.result.value, 'base64');
  };

  console.log('4. Generating favicons and PWA icons...');
  const png16 = await renderPng(16, 16);
  const png32 = await renderPng(32, 32);
  const png48 = await renderPng(48, 48);
  const png64 = await renderPng(64, 64);
  const png128 = await renderPng(128, 128);
  const png192 = await renderPng(192, 192);
  const png256 = await renderPng(256, 256);
  const png512 = await renderPng(512, 512);

  const pngMaskable192 = await renderPng(192, 192, true);
  const pngMaskable512 = await renderPng(512, 512, true);

  console.log('5. Generating 1280x640 Open Graph & Social Preview image...');
  const ogRes = await send('Runtime.evaluate', {
    expression: `window.renderSocialOg('/constella-banner.png')`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (!ogRes || !ogRes.result || !ogRes.result.value) {
    throw new Error('OG render failed: ' + JSON.stringify(ogRes));
  }
  const ogPng = Buffer.from(ogRes.result.value, 'base64');

  // Build ICO and ICNS
  console.log('6. Building Windows multi-size .ico and macOS .icns containers...');
  const icoBuffer = buildIco([
    { width: 256, height: 256, buffer: png256 },
    { width: 128, height: 128, buffer: png128 },
    { width: 64, height: 64, buffer: png64 },
    { width: 48, height: 48, buffer: png48 },
    { width: 32, height: 32, buffer: png32 },
    { width: 16, height: 16, buffer: png16 },
  ]);

  const icnsBuffer = buildIcns([
    { tag: 'ic07', buffer: png128 },
    { tag: 'ic08', buffer: png256 },
    { tag: 'ic09', buffer: png512 },
  ]);

  console.log('7. Writing files to /assets/branding, /public, and /src-tauri/icons ...');
  const brandingDir = 'assets/branding';
  const publicDir = 'public';
  const tauriIconsDir = 'src-tauri/icons';

  if (!existsSync(brandingDir)) mkdirSync(brandingDir, { recursive: true });
  if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });
  if (!existsSync(tauriIconsDir)) mkdirSync(tauriIconsDir, { recursive: true });

  // 1. Branding folder
  writeFileSync(path.join(brandingDir, 'favicon-16.png'), png16);
  writeFileSync(path.join(brandingDir, 'favicon-32.png'), png32);
  writeFileSync(path.join(brandingDir, 'favicon-48.png'), png48);
  writeFileSync(path.join(brandingDir, 'favicon.ico'), icoBuffer);
  writeFileSync(path.join(brandingDir, 'icon-192.png'), png192);
  writeFileSync(path.join(brandingDir, 'icon-512.png'), png512);
  writeFileSync(path.join(brandingDir, 'icon-maskable-192.png'), pngMaskable192);
  writeFileSync(path.join(brandingDir, 'icon-maskable-512.png'), pngMaskable512);
  writeFileSync(path.join(brandingDir, 'icon.ico'), icoBuffer);
  writeFileSync(path.join(brandingDir, 'icon.icns'), icnsBuffer);
  writeFileSync(path.join(brandingDir, 'og-image.png'), ogPng);
  writeFileSync(path.join(brandingDir, 'social-preview.png'), ogPng);

  // 2. Public folder for Web & PWA
  writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  writeFileSync(path.join(publicDir, 'favicon-16.png'), png16);
  writeFileSync(path.join(publicDir, 'favicon-32.png'), png32);
  writeFileSync(path.join(publicDir, 'favicon-48.png'), png48);
  writeFileSync(path.join(publicDir, 'icon-192.png'), png192);
  writeFileSync(path.join(publicDir, 'icon-512.png'), png512);
  writeFileSync(path.join(publicDir, 'icon-maskable-192.png'), pngMaskable192);
  writeFileSync(path.join(publicDir, 'icon-maskable-512.png'), pngMaskable512);
  writeFileSync(path.join(publicDir, 'og-image.png'), ogPng);
  writeFileSync(path.join(publicDir, 'social-preview.png'), ogPng);

  // 3. Tauri Desktop Icons
  writeFileSync(path.join(tauriIconsDir, '32x32.png'), png32);
  writeFileSync(path.join(tauriIconsDir, '128x128.png'), png128);
  writeFileSync(path.join(tauriIconsDir, '128x128@2x.png'), png256);
  writeFileSync(path.join(tauriIconsDir, 'icon.png'), png512);
  writeFileSync(path.join(tauriIconsDir, 'icon.ico'), icoBuffer);
  writeFileSync(path.join(tauriIconsDir, 'icon.icns'), icnsBuffer);

  console.log('✓ All branding assets, favicons, PWA icons, ICO, ICNS, and OG images generated successfully!');
  ws.close();
  edgeProc.kill('SIGKILL');
}

run().catch((err) => {
  console.error('Error generating branding assets:', err);
  process.exit(1);
});
