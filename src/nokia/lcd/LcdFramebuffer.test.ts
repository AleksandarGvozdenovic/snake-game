import {
  describe,
  expect,
  it,
} from 'vitest';

import {
  LCD_HEIGHT,
  LCD_WIDTH,
  LcdFramebuffer,
} from './LcdFramebuffer';

describe('Nokia LCD framebuffer', () => {
  it('always contains exactly 84 × 48 pixels', () => {
    const lcd = new LcdFramebuffer();

    expect(lcd.snapshot()).toHaveLength(
      LCD_WIDTH * LCD_HEIGHT
    );
  });

  it('supports monochrome pixel switching', () => {
    const lcd = new LcdFramebuffer();

    lcd.setPixel(5, 7);
    expect(lcd.getPixel(5, 7)).toBe(1);

    lcd.setPixel(5, 7, false);
    expect(lcd.getPixel(5, 7)).toBe(0);
  });

  it('clips shapes to LCD boundaries', () => {
    const lcd = new LcdFramebuffer();

    lcd.fillRect(-1, -1, 3, 3);

    const active = lcd.snapshot().reduce(
      (sum, bit) => sum + bit,
      0
    );

    expect(active).toBe(4);
  });

  it('supports transparent bitmap sprites', () => {
    const lcd = new LcdFramebuffer();

    lcd.fillRect(0, 0, 2, 2);

    lcd.blit(
      {
        width: 2,
        height: 2,
        bits: new Uint8Array([
          1, 0,
          0, 1,
        ]),
      },
      0,
      0,
      'ink-only'
    );

    expect(
      lcd.snapshot().slice(0, 2)
    ).toEqual(
      new Uint8Array([1, 1])
    );
  });

  it('rejects invalid sprite dimensions', () => {
    const lcd = new LcdFramebuffer();

    expect(() =>
      lcd.blit(
        {
          width: 3,
          height: 3,
          bits: new Uint8Array(2),
        },
        0,
        0
      )
    ).toThrow('Invalid bitmap');
  });

  it('returns independent snapshots', () => {
    const lcd = new LcdFramebuffer();

    const copy = lcd.snapshot();
    copy[0] = 1;

    expect(
      lcd.getPixel(0, 0)
    ).toBe(0);
  });
});
