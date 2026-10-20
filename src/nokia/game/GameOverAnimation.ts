import { LCD_WIDTH, LCD_HEIGHT, LcdFramebuffer } from '../lcd/LcdFramebuffer';
import type { PixelPoint } from '../lcd/PixelFont';
import type { DeathReason } from './SnakeIIEngine';

export const GAME_OVER_ANIMATION_MS = 3000;
export const GAME_OVER_SCATTER_END_MS = 1550;

export type DeathParticle = Readonly<{
  x: number;
  y: number;
  burstX: number;
  burstY: number;
  targetX: number;
  targetY: number;
}>;

export function createDeathParticles(snakePixels: Uint8Array, heading: readonly PixelPoint[]): DeathParticle[] {
  if (snakePixels.length !== LCD_WIDTH * LCD_HEIGHT) throw new Error('Invalid snake bitmap');
  const source: PixelPoint[] = [];
  for (let index = 0; index < snakePixels.length; index++) {
    if (snakePixels[index] !== 0) source.push({ x: index % LCD_WIDTH, y: Math.floor(index / LCD_WIDTH) });
  }
  if (!source.length) return [];

  const amount = Math.max(source.length, heading.length);
  const centerX = source.reduce((n, p) => n + p.x, 0) / source.length;
  const centerY = source.reduce((n, p) => n + p.y, 0) / source.length;
  return Array.from({ length: amount }, (_, i) => {
    const from = source[i % source.length];
    const to = heading[i % heading.length] ?? from;
    const angle = i * 2.399963229728653;
    const radius = 8 + ((i * 19) % 21);
    return {
      x: from.x,
      y: from.y,
      burstX: Math.max(0, Math.min(LCD_WIDTH - 1, centerX + Math.cos(angle) * radius)),
      burstY: Math.max(0, Math.min(LCD_HEIGHT - 1, centerY + Math.sin(angle) * radius * 0.7)),
      targetX: to.x,
      targetY: to.y,
    };
  });
}

function eased(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function drawDeathParticles(
  frame: LcdFramebuffer,
  particles: readonly DeathParticle[],
  elapsedMs: number,
  deathReason: DeathReason | null,
): void {
  const hold = deathReason === 'self' ? 420 : 220;
  const scatterFinish = GAME_OVER_SCATTER_END_MS;
  const isHolding = elapsedMs <= hold;
  const inScatter = elapsedMs < scatterFinish;
  const progress = inScatter
    ? eased((elapsedMs - hold) / Math.max(1, scatterFinish - hold))
    : eased((elapsedMs - scatterFinish) / (GAME_OVER_ANIMATION_MS - scatterFinish));

  for (const pixel of particles) {
    const x = isHolding ? pixel.x : inScatter
      ? pixel.x + (pixel.burstX - pixel.x) * progress
      : pixel.burstX + (pixel.targetX - pixel.burstX) * progress;
    const y = isHolding ? pixel.y : inScatter
      ? pixel.y + (pixel.burstY - pixel.y) * progress
      : pixel.burstY + (pixel.targetY - pixel.burstY) * progress;
    frame.setPixel(Math.round(x), Math.round(y));
  }
}
