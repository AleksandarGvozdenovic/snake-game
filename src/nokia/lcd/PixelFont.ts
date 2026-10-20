import { LcdFramebuffer } from './LcdFramebuffer';

const FONT: Record<string, string[]> = {

  '0':['111','101','101','101','111'], '1':['010','110','010','010','111'],

  '2':['111','001','111','100','111'], '3':['111','001','111','001','111'],

  '4':['101','101','111','001','001'], '5':['111','100','111','001','111'],

  '6':['111','100','111','101','111'], '7':['111','001','010','010','010'],

  '8':['111','101','111','101','111'], '9':['111','101','111','001','111'],

  'A':['010','101','111','101','101'], 'C':['111','100','100','100','111'],

  'E':['111','100','110','100','111'], 'G':['111','100','101','101','111'],

  'L':['100','100','100','100','111'], 'M':['101','111','111','101','101'],

  'O':['111','101','101','101','111'], 'P':['111','101','111','100','100'],

  'R':['110','101','110','101','101'], 'S':['111','100','111','001','111'],

  'U':['101','101','101','101','111'], 'V':['101','101','101','101','010'],

  ':':['0','1','0','1','0'], '-':['000','000','111','000','000'],

  'B':['110','101','110','101','110'],
  'N':['101','111','111','111','101'],
  'T':['111','010','010','010','010'],
  'Y':['101','101','010','010','010'],
  '>':['100','010','001','010','100'],
  ' ':['000','000','000','000','000'],

};

export type PixelPoint = Readonly<{ x: number; y: number }>;

export function pixelTextPoints(message: string, x: number, y: number): PixelPoint[] {
  const points: PixelPoint[] = [];
  let cursor = x;
  for (const character of message.toUpperCase()) {
    const glyph = FONT[character] ?? FONT[' '];
    for (let row = 0; row < glyph.length; row++) {
      for (let col = 0; col < glyph[row].length; col++) {
        if (glyph[row][col] === '1') points.push({ x: cursor + col, y: y + row });
      }
    }
    cursor += glyph[0].length + 1;
  }
  return points;
}

export function drawPixelText(frame: LcdFramebuffer, message: string, x: number, y: number): void {
  for (const point of pixelTextPoints(message, x, y)) frame.setPixel(point.x, point.y);
}
