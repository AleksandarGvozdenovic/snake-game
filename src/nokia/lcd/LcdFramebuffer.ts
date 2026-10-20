export const LCD_WIDTH = 84;
export const LCD_HEIGHT = 48;

export type Bitmap = Readonly<{
  width: number;
  height: number;
  bits: Uint8Array;
}>;

export class LcdFramebuffer {
  readonly width = LCD_WIDTH;
  readonly height = LCD_HEIGHT;

  private readonly pixels = new Uint8Array(
    LCD_WIDTH * LCD_HEIGHT
  );

  clear(ink = false): void {
    this.pixels.fill(ink ? 1 : 0);
  }

  getPixel(x: number, y: number): 0 | 1 {
    if (!this.inBounds(x, y)) {
      return 0;
    }

    return this.pixels[
      y * this.width + x
    ] as 0 | 1;
  }

  setPixel(
    x: number,
    y: number,
    ink = true
  ): void {
    if (!this.inBounds(x, y)) {
      return;
    }

    this.pixels[
      y * this.width + x
    ] = ink ? 1 : 0;
  }

  fillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    ink = true
  ): void {
    if (
      ![x, y, width, height].every(Number.isInteger) ||
      width <= 0 ||
      height <= 0
    ) {
      return;
    }

    const left = Math.max(0, x);
    const top = Math.max(0, y);

    const right = Math.min(
      this.width,
      x + width
    );

    const bottom = Math.min(
      this.height,
      y + height
    );

    for (let row = top; row < bottom; row++) {
      this.pixels.fill(
        ink ? 1 : 0,
        row * this.width + left,
        row * this.width + right
      );
    }
  }

  blit(
    sprite: Bitmap,
    x: number,
    y: number,
    mode: 'opaque' | 'ink-only' = 'opaque'
  ): void {
    if (
      ![
        sprite.width,
        sprite.height,
        x,
        y
      ].every(Number.isInteger) ||
      sprite.width <= 0 ||
      sprite.height <= 0 ||
      sprite.bits.length !==
        sprite.width * sprite.height
    ) {
      throw new Error(
        'Invalid bitmap dimensions or coordinates'
      );
    }

    for (
      let sy = 0;
      sy < sprite.height;
      sy++
    ) {
      for (
        let sx = 0;
        sx < sprite.width;
        sx++
      ) {
        const bit =
          sprite.bits[
            sy * sprite.width + sx
          ] !== 0;

        if (mode === 'opaque' || bit) {
          this.setPixel(
            x + sx,
            y + sy,
            bit
          );
        }
      }
    }
  }

  snapshot(): Uint8Array {
    return this.pixels.slice();
  }

  private inBounds(
    x: number,
    y: number
  ): boolean {
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      x < this.width &&
      y >= 0 &&
      y < this.height
    );
  }
}
