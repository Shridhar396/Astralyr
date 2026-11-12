export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  duration?: number;
}

/**
 * Lightweight, zero-dependency in-browser ID3v2 & ID3v1 metadata tag parser.
 * Reads Title, Artist, Album, and APIC (Cover Artwork) directly from audio ArrayBuffer.
 */
export class Id3Parser {
  public static async parseFile(file: File): Promise<AudioMetadata> {
    const result: AudioMetadata = {};

    try {
      // Read the first 256 KB which contains the ID3v2 header and tags
      const headerChunkSize = Math.min(file.size, 262144);
      const headerBuffer = await file.slice(0, headerChunkSize).arrayBuffer();
      const view = new DataView(headerBuffer);

      // 1. Check for ID3v2 header: 'ID3' (0x49, 0x44, 0x33)
      if (
        view.byteLength >= 10 &&
        view.getUint8(0) === 0x49 &&
        view.getUint8(1) === 0x44 &&
        view.getUint8(2) === 0x33
      ) {
        const majorVersion = view.getUint8(3);
        const flags = view.getUint8(5);
        // Synchsafe integer (7 bits per byte)
        const tagSize =
          ((view.getUint8(6) & 0x7f) << 21) |
          ((view.getUint8(7) & 0x7f) << 14) |
          ((view.getUint8(8) & 0x7f) << 7) |
          (view.getUint8(9) & 0x7f);

        let offset = 10;
        // Check for extended header flag
        if (flags & 0x40 && offset + 4 < view.byteLength) {
          const extSize = view.getUint32(offset);
          offset += extSize + 4;
        }

        const maxOffset = Math.min(view.byteLength, 10 + tagSize);

        while (offset + 10 < maxOffset) {
          // Frame ID: 4 ASCII characters
          const f0 = view.getUint8(offset);
          const f1 = view.getUint8(offset + 1);
          const f2 = view.getUint8(offset + 2);
          const f3 = view.getUint8(offset + 3);

          if (f0 === 0 && f1 === 0 && f2 === 0 && f3 === 0) break; // Padding reached

          const frameId = String.fromCharCode(f0, f1, f2, f3);

          let frameSize = 0;
          if (majorVersion === 4) {
            // ID3v2.4 synchsafe
            frameSize =
              ((view.getUint8(offset + 4) & 0x7f) << 21) |
              ((view.getUint8(offset + 5) & 0x7f) << 14) |
              ((view.getUint8(offset + 6) & 0x7f) << 7) |
              (view.getUint8(offset + 7) & 0x7f);
          } else {
            // ID3v2.3 standard uint32
            frameSize = view.getUint32(offset + 4);
          }

          offset += 10; // Skip header

          if (frameSize <= 0 || offset + frameSize > view.byteLength) {
            break;
          }

          const frameBytes = new Uint8Array(headerBuffer, offset, frameSize);

          if (frameId === 'TIT2') {
            result.title = this.decodeTextFrame(frameBytes);
          } else if (frameId === 'TPE1') {
            result.artist = this.decodeTextFrame(frameBytes);
          } else if (frameId === 'TALB') {
            result.album = this.decodeTextFrame(frameBytes);
          } else if (frameId === 'APIC' && !result.artworkUrl) {
            // Attached picture (Cover Art)
            const artUrl = this.parseApicFrame(frameBytes);
            if (artUrl) {
              result.artworkUrl = artUrl;
            }
          }

          offset += frameSize;
        }
      }

      // 2. If no ID3v2 found or title is missing, try ID3v1 at the end of the file
      if ((!result.title || !result.artist) && file.size >= 128) {
        const tailBuffer = await file.slice(file.size - 128, file.size).arrayBuffer();
        const tailView = new DataView(tailBuffer);
        // 'TAG' at offset 0
        if (
          tailView.getUint8(0) === 0x54 &&
          tailView.getUint8(1) === 0x41 &&
          tailView.getUint8(2) === 0x47
        ) {
          const dec = new TextDecoder('utf-8');
          if (!result.title) {
            const raw = dec.decode(new Uint8Array(tailBuffer, 3, 30)).replace(/\0/g, '').trim();
            if (raw) result.title = raw;
          }
          if (!result.artist) {
            const raw = dec.decode(new Uint8Array(tailBuffer, 33, 30)).replace(/\0/g, '').trim();
            if (raw) result.artist = raw;
          }
          if (!result.album) {
            const raw = dec.decode(new Uint8Array(tailBuffer, 63, 30)).replace(/\0/g, '').trim();
            if (raw) result.album = raw;
          }
        }
      }
    } catch (err) {
      console.warn('[Id3Parser] Error reading tags:', err);
    }

    return result;
  }

  private static decodeTextFrame(bytes: Uint8Array): string {
    if (bytes.length < 2) return '';
    const encoding = bytes[0];
    const data = bytes.subarray(1);

    try {
      if (encoding === 0) {
        // ISO-8859-1
        const dec = new TextDecoder('iso-8859-1');
        return dec.decode(data).replace(/\0/g, '').trim();
      } else if (encoding === 1 || encoding === 2) {
        // UTF-16 with BOM or UTF-16BE
        const dec = new TextDecoder('utf-16');
        return dec.decode(data).replace(/\0/g, '').trim();
      } else if (encoding === 3) {
        // UTF-8
        const dec = new TextDecoder('utf-8');
        return dec.decode(data).replace(/\0/g, '').trim();
      }
    } catch {
      // Fallback
    }

    return new TextDecoder('utf-8').decode(data).replace(/\0/g, '').trim();
  }

  private static parseApicFrame(bytes: Uint8Array): string | null {
    try {
      if (bytes.length < 10) return null;
      let offset = 1; // skip encoding byte

      // Read MIME type (null-terminated ASCII)
      let mime = '';
      while (offset < bytes.length && bytes[offset] !== 0) {
        mime += String.fromCharCode(bytes[offset]);
        offset++;
      }
      offset++; // skip null terminator

      if (!mime || mime.length === 0) {
        mime = 'image/jpeg';
      }

      // Picture type (1 byte, 0x03 is front cover)
      offset++;

      // Skip description (null-terminated)
      while (offset < bytes.length && bytes[offset] !== 0) {
        offset++;
      }
      offset++; // skip null

      if (offset < bytes.length) {
        const imgBytes = bytes.subarray(offset);
        const arrayBuffer = imgBytes.buffer.slice(
          imgBytes.byteOffset,
          imgBytes.byteOffset + imgBytes.byteLength
        ) as ArrayBuffer;
        const blob = new Blob([arrayBuffer], { type: mime });
        return URL.createObjectURL(blob);
      }
    } catch (err) {
      console.warn('[Id3Parser] APIC parse failed:', err);
    }
    return null;
  }
}
