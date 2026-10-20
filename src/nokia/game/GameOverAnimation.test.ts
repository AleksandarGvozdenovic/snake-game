import { describe, expect, it } from 'vitest';
import { LcdFramebuffer, LCD_WIDTH, LCD_HEIGHT } from '../lcd/LcdFramebuffer';
import { pixelTextPoints } from '../lcd/PixelFont';
import { createDeathParticles, drawDeathParticles, GAME_OVER_ANIMATION_MS } from './GameOverAnimation';
import { SnakeIIEngine } from './SnakeIIEngine';
import { drawSnakeSprites } from './SnakeSpriteRenderer';

describe('Nokia Canvas death animation', () => {
  const snake = new SnakeIIEngine(1, 1);
  const snakeFrame = new LcdFramebuffer();
  drawSnakeSprites(snakeFrame, snake);
  const title = pixelTextPoints('GAME OVER', 24, 5);
  const particles = createDeathParticles(snakeFrame.snapshot(), title);

  it('does not alter the original snake bitmap or maze data', () => {
    expect(particles.length).toBeGreaterThanOrEqual(title.length);
    expect(snakeFrame.snapshot().length).toBe(LCD_WIDTH * LCD_HEIGHT);
    expect(snake.mazeDefinition.walls.size).toBeGreaterThan(0);
  });

  it('keeps snake frozen initially and then scatters its pixels', () => {
    const initial = new LcdFramebuffer();
    drawDeathParticles(initial, particles, 0, 'wall');
    expect(initial.snapshot()).toEqual(snakeFrame.snapshot());
    const scattered = new LcdFramebuffer();
    drawDeathParticles(scattered, particles, 1100, 'wall');
    expect(scattered.snapshot()).not.toEqual(initial.snapshot());
  });

  it('holds the open-mouth collision longer for self-bites', () => {
    const held = new LcdFramebuffer();
    drawDeathParticles(held, particles, 300, 'self');
    expect(held.snapshot()).toEqual(snakeFrame.snapshot());
  });

  it('assembles GAME OVER using the exact LCD pixel font', () => {
    const frame = new LcdFramebuffer();
    drawDeathParticles(frame, particles, GAME_OVER_ANIMATION_MS, 'wall');
    const expected = new LcdFramebuffer();
    title.forEach(({ x, y }) => expected.setPixel(x, y));
    expect(frame.snapshot()).toEqual(expected.snapshot());
  });
});
