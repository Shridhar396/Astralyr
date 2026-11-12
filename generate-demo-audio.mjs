import fs from 'fs';
import path from 'path';

// Generate a 44.1kHz 16-bit Stereo Ambient Synthwave WAV track
const SAMPLE_RATE = 44100;
const DURATION_SEC = 40;
const TOTAL_SAMPLES = SAMPLE_RATE * DURATION_SEC;
const NUM_CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const BLOCK_ALIGN = NUM_CHANNELS * BYTES_PER_SAMPLE;
const BYTE_RATE = SAMPLE_RATE * BLOCK_ALIGN;
const DATA_SIZE = TOTAL_SAMPLES * BLOCK_ALIGN;

const buffer = Buffer.alloc(44 + DATA_SIZE);

// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + DATA_SIZE, 4);
buffer.write('WAVE', 8);

// fmt chunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // subchunk1 size
buffer.writeUInt16LE(1, 20);  // PCM format
buffer.writeUInt16LE(NUM_CHANNELS, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(BYTE_RATE, 28);
buffer.writeUInt16LE(BLOCK_ALIGN, 32);
buffer.writeUInt16LE(16, 34); // 16-bit

// data chunk
buffer.write('data', 36);
buffer.writeUInt32LE(DATA_SIZE, 40);

// Chord frequencies (Hz)
// Progression: Cm9 -> Abmaj7 -> Ebmaj -> Bb9
const chords = [
  // C minor 9: C3, Eb3, G3, Bb3, D4
  [130.81, 155.56, 196.00, 233.08, 293.66],
  // Ab major 7: Ab2, C3, Eb3, G3
  [103.83, 130.81, 155.56, 196.00],
  // Eb major 7: Eb3, G3, Bb3, D4
  [155.56, 196.00, 233.08, 293.66],
  // Bb add 9: Bb2, D3, F3, C4
  [116.54, 146.83, 174.61, 261.63],
];

const bassNotes = [65.41, 51.91, 77.78, 58.27]; // C2, Ab1, Eb2, Bb1

const CHORD_DURATION = 10; // 10 seconds per chord (4 chords = 40s)

let offset = 44;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;
  const chordIdx = Math.floor((t % DURATION_SEC) / CHORD_DURATION);
  const chordProgress = (t % CHORD_DURATION) / CHORD_DURATION;
  const currentChord = chords[chordIdx];
  const bassFreq = bassNotes[chordIdx];

  // 1. Pad synth (sum of sines with soft envelope)
  let padLeft = 0;
  let padRight = 0;
  const padEnvelope = Math.sin(chordProgress * Math.PI); // smooth swell

  for (let k = 0; k < currentChord.length; k++) {
    const f = currentChord[k];
    // Gentle detuned oscillators for lush stereo width
    const osc1 = Math.sin(2 * Math.PI * f * t);
    const osc2 = Math.sin(2 * Math.PI * (f * 1.003) * t + 0.5);
    const osc3 = Math.sin(2 * Math.PI * (f * 0.997) * t + 1.0);
    
    padLeft += (osc1 * 0.6 + osc2 * 0.4) / currentChord.length;
    padRight += (osc1 * 0.6 + osc3 * 0.4) / currentChord.length;
  }

  // 2. Deep sub-bass (warm sine with gentle 2nd harmonic)
  const bassSine = Math.sin(2 * Math.PI * bassFreq * t);
  const bassHarmonic = Math.sin(4 * Math.PI * bassFreq * t) * 0.25;
  const subBass = (bassSine + bassHarmonic) * 0.45;

  // 3. Gentle Lo-Fi Beat (BPM = 75, beat every 0.8s)
  const beatTime = t % 0.8;
  const isKickBeat = Math.floor(t / 0.8) % 2 === 0;
  
  let kick = 0;
  let rimshot = 0;

  if (isKickBeat && beatTime < 0.25) {
    // 808-style pitch drop kick
    const kickPitch = 120 * Math.exp(-beatTime * 22) + 45;
    const kickEnv = Math.exp(-beatTime * 14);
    kick = Math.sin(2 * Math.PI * kickPitch * beatTime) * kickEnv * 0.45;
  } else if (!isKickBeat && beatTime < 0.15) {
    // Soft lo-fi snare / rimshot
    const noise = (Math.random() * 2 - 1) * Math.exp(-beatTime * 28) * 0.25;
    const tone = Math.sin(2 * Math.PI * 340 * beatTime) * Math.exp(-beatTime * 35) * 0.2;
    rimshot = noise + tone;
  }

  // Master mix
  const mixLeft = (padLeft * padEnvelope * 0.38 + subBass * 0.35 + kick * 0.5 + rimshot * 0.4);
  const mixRight = (padRight * padEnvelope * 0.38 + subBass * 0.35 + kick * 0.5 + rimshot * 0.4);

  // Soft clamp & 16-bit conversion
  const clampedL = Math.max(-1, Math.min(1, mixLeft));
  const clampedR = Math.max(-1, Math.min(1, mixRight));

  const sampleL = Math.floor(clampedL * 32767);
  const sampleR = Math.floor(clampedR * 32767);

  buffer.writeInt16LE(sampleL, offset);
  buffer.writeInt16LE(sampleR, offset + 2);
  offset += 4;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

const outPath = path.join(publicDir, 'demo.wav');
fs.writeFileSync(outPath, buffer);
console.log(`Successfully generated 40s ambient audio file at: ${outPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

