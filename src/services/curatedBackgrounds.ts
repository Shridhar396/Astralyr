/**
 * Curated backgrounds — ready-made, no tweaking needed.
 * Each one is a STATIC CSS background (stacked blurred colour blobs on a base),
 * so it costs nothing per frame. They imitate the soft, blurred album-art
 * look from the reference videos.
 *
 * `light` = suggested edge-light colour (r,g,b) that pairs with the background.
 */
export interface CuratedBackground {
  id: string;
  name: string;
  css: string;
  light: [number, number, number];
}

const blob = (x: number, y: number, rx: number, ry: number, rgba: string) =>
  `radial-gradient(ellipse ${rx}% ${ry}% at ${x}% ${y}%, ${rgba} 0%, transparent 100%)`;

export const CURATED_BACKGROUNDS: CuratedBackground[] = [
  {
    id: 'crimson',
    name: 'Crimson',
    light: [255, 45, 60],
    css: [
      blob(75, 30, 60, 70, 'rgba(120,10,25,0.95)'),
      blob(20, 80, 55, 60, 'rgba(70,5,20,0.9)'),
      blob(50, 50, 80, 80, 'rgba(40,3,12,0.9)'),
      '#120208',
    ].join(','),
  },
  {
    id: 'ember',
    name: 'Ember',
    light: [255, 150, 40],
    css: [
      blob(25, 25, 60, 70, 'rgba(150,70,10,0.95)'),
      blob(80, 75, 55, 60, 'rgba(110,30,10,0.9)'),
      blob(55, 55, 85, 85, 'rgba(60,25,5,0.9)'),
      '#120803',
    ].join(','),
  },
  {
    id: 'violet',
    name: 'Violet',
    light: [190, 110, 255],
    css: [
      blob(30, 30, 60, 70, 'rgba(95,40,160,0.95)'),
      blob(80, 70, 55, 60, 'rgba(150,40,120,0.75)'),
      blob(50, 50, 85, 85, 'rgba(35,15,70,0.9)'),
      '#0b0618',
    ].join(','),
  },
  {
    id: 'ocean',
    name: 'Ocean',
    light: [70, 150, 255],
    css: [
      blob(70, 25, 60, 70, 'rgba(20,70,160,0.95)'),
      blob(20, 75, 55, 60, 'rgba(10,110,140,0.75)'),
      blob(50, 50, 85, 85, 'rgba(8,25,70,0.9)'),
      '#040a1c',
    ].join(','),
  },
  {
    id: 'aurora',
    name: 'Aurora',
    light: [90, 255, 190],
    css: [
      blob(25, 35, 60, 60, 'rgba(15,130,110,0.9)'),
      blob(75, 30, 55, 60, 'rgba(60,70,170,0.85)'),
      blob(55, 85, 70, 50, 'rgba(110,40,140,0.7)'),
      '#050b14',
    ].join(','),
  },
  {
    id: 'rose',
    name: 'Rose',
    light: [255, 110, 170],
    css: [
      blob(30, 30, 60, 70, 'rgba(170,40,100,0.9)'),
      blob(80, 75, 55, 60, 'rgba(110,30,90,0.85)'),
      blob(50, 55, 85, 85, 'rgba(55,12,45,0.9)'),
      '#14060f',
    ].join(','),
  },
  {
    id: 'forest',
    name: 'Forest',
    light: [110, 230, 130],
    css: [
      blob(70, 30, 60, 65, 'rgba(25,100,60,0.9)'),
      blob(20, 75, 55, 60, 'rgba(15,70,70,0.85)'),
      blob(50, 50, 85, 85, 'rgba(8,35,25,0.9)'),
      '#040d0a',
    ].join(','),
  },
  {
    id: 'midnight',
    name: 'Midnight',
    light: [255, 255, 255],
    css: [blob(50, 40, 80, 80, 'rgba(30,34,60,0.9)'), '#05060c'].join(','),
  },
  {
    id: 'black',
    name: 'Black',
    light: [255, 255, 255],
    css: '#000000',
  },
];

export const DEFAULT_CURATED_ID = 'crimson';
export const getCuratedBackground = (id: string) =>
  CURATED_BACKGROUNDS.find((b) => b.id === id) ?? CURATED_BACKGROUNDS[0];
