import { LCD_HEIGHT, LCD_WIDTH, LcdFramebuffer } from './LcdFramebuffer';

export class LcdCanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly observer: ResizeObserver;
  private readonly onResize = (): void => { this.resize(); };

  private pitch = 1;
  private disposed = false;
  private wallPixelMask: Uint8Array | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly viewport: HTMLElement,
    private readonly framebuffer: LcdFramebuffer,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Canvas 2D support is required');
    }

    this.ctx = ctx;
    this.canvas.style.imageRendering = 'pixelated';

    this.observer = new ResizeObserver(this.onResize);
    this.observer.observe(viewport);
    const stage = this.viewport.parentElement;
    if (stage?.classList.contains('lcd-stage')) this.observer.observe(stage);
    window.addEventListener('resize', this.onResize);
    window.visualViewport?.addEventListener('resize', this.onResize);

    this.resize();
  }

  // Walls are drawn continuously; sprites retain the LCD pixel spacing.
  setWallPixelMask(mask: Uint8Array | null): void {
    if (mask && mask.length !== LCD_WIDTH * LCD_HEIGHT) {
      throw new Error('Maze wall mask must be 84 x 48 pixels');
    }
    this.wallPixelMask = mask;
  }

  resize(): void {
    if (this.disposed) return;

    const stage = this.viewport.parentElement;
    if (stage?.classList.contains('lcd-stage')) {
      const availableWidth = Math.max(1, stage.clientWidth);
      const availableHeight = Math.max(1, stage.clientHeight);
      const fitWidth = Math.min(1080, availableWidth, availableHeight * LCD_WIDTH / LCD_HEIGHT);
      const fitHeight = fitWidth * LCD_HEIGHT / LCD_WIDTH;
      const width = `${Math.floor(fitWidth)}px`;
      const height = `${Math.floor(fitHeight)}px`;
      if (this.viewport.style.width !== width) this.viewport.style.width = width;
      if (this.viewport.style.height !== height) this.viewport.style.height = height;
    }

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const computed = window.getComputedStyle(this.viewport);
    const horizontalInsets = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);
    const verticalInsets = parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom);
    const availableWidth = Math.max(1, this.viewport.clientWidth - (horizontalInsets || 0));
    const availableHeight = Math.max(1, this.viewport.clientHeight - (verticalInsets || 0));
    const scale = Math.min(availableWidth / LCD_WIDTH, availableHeight / LCD_HEIGHT);
    this.pitch = Math.max(1, Math.floor(scale * dpr));

    const backingWidth = LCD_WIDTH * this.pitch;
    const backingHeight = LCD_HEIGHT * this.pitch;
    const cssWidth = `${backingWidth / dpr}px`;
    const cssHeight = `${backingHeight / dpr}px`;
    if (this.canvas.style.width !== cssWidth) this.canvas.style.width = cssWidth;
    if (this.canvas.style.height !== cssHeight) this.canvas.style.height = cssHeight;

    if (this.canvas.width !== backingWidth) this.canvas.width = backingWidth;
    if (this.canvas.height !== backingHeight) this.canvas.height = backingHeight;

    this.ctx.imageSmoothingEnabled = false;
    this.render();
  }

  render(): void {
    if (this.disposed) return;

    const bits = this.framebuffer.snapshot();
    if (bits.length !== LCD_WIDTH * LCD_HEIGHT) {
      throw new Error('Expected an 84 x 48 monochrome framebuffer');
    }

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = '#b2bd07';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#14220e';

    const gap = this.pitch >= 6 ? 1 : 0;
    const dotSize = this.pitch - gap;
    const walls = this.wallPixelMask;

    for (let y = 0; y < LCD_HEIGHT; y++) {
      const row = y * LCD_WIDTH;

      for (let x = 0; x < LCD_WIDTH; x++) {
        const index = row + x;
        if (!bits[index]) continue;

        const size = walls?.[index] ? this.pitch : dotSize;
        ctx.fillRect(x * this.pitch, y * this.pitch, size, size);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    window.removeEventListener('resize', this.onResize);
    window.visualViewport?.removeEventListener('resize', this.onResize);
  }
}
