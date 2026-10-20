import { describe, expect, it } from 'vitest';
import { LCD_WIDTH, LcdFramebuffer } from '../lcd/LcdFramebuffer';
import {
  getWallPixelMask,
  getHeadWallImpact,
  getSweptHeadWallImpact,
} from './MazeWallPixels';
import { drawWallSprite } from './SnakeSpriteRenderer';
import { getWallCells, requirePlayableMaze } from './MazeDefinitions';
import { SnakeIIEngine } from './SnakeIIEngine';

describe('Thin maze walls and forgiving head collision', () => {
  it('uses identical wall pixels for rendering and collision', () => {
    for (const id of [0, 1, 2, 3, 4, 5] as const) {
      const maze = requirePlayableMaze(id);
      const frame = new LcdFramebuffer();
      for (const wall of getWallCells(maze)) {
        drawWallSprite(frame, wall, maze.walls);
      }
      expect(Array.from(frame.snapshot())).toEqual(
        Array.from(getWallPixelMask(maze.walls)),
      );
    }
  });

  it('creates a complete 84x48 collision mask', () => {
    const maze = requirePlayableMaze(1);
    const mask = getWallPixelMask(maze.walls);
    expect(mask.length).toBe(84 * 48);
  });

  it('draws horizontal walls exactly one pixel thick', () => {
    const walls = new Set(['3,3', '4,3', '5,3']);
    const mask = getWallPixelMask(walls);
    const y = 8 + 3 * 4 + 1;
    for (let x = 13; x <= 21; x++) {
      expect(mask[y * LCD_WIDTH + x]).toBe(1);
      expect(mask[(y + 1) * LCD_WIDTH + x]).toBe(0);
    }
  });

  it('draws vertical walls exactly one pixel thick', () => {
    const walls = new Set(['3,3', '3,4', '3,5']);
    const mask = getWallPixelMask(walls);
    const x = 3 * 4 + 1;
    for (let y = 21; y <= 29; y++) {
      expect(mask[y * LCD_WIDTH + x]).toBe(1);
      expect(mask[y * LCD_WIDTH + x + 1]).toBe(0);
    }
  });

  it('does not collide in the free cell beside a wall', () => {
    const walls = new Set(['3,2', '3,3', '3,4', '3,5']);
    expect(getHeadWallImpact(walls, { x: 2, y: 3 }, 'right', false)).toBeNull();
  });

  it('can turn up beside a vertical wall', () => {
    const walls = new Set(['3,2', '3,3', '3,4', '3,5']);
    expect(getSweptHeadWallImpact(walls, { x: 2, y: 3 }, 'up', false)).toBeNull();
  });

  it('can turn down beside a vertical wall', () => {
    const walls = new Set(['3,2', '3,3', '3,4', '3,5']);
    expect(getSweptHeadWallImpact(walls, { x: 2, y: 3 }, 'down', false)).toBeNull();
  });

  it('still collides when moving directly into a wall', () => {
    const walls = new Set(['3,2', '3,3', '3,4', '3,5']);
    const impact = getSweptHeadWallImpact(walls, { x: 2, y: 3 }, 'right', false);
    expect(impact).not.toBeNull();
    expect(impact?.x).toBe(13);
  });

  it('does not change collision when the mouth opens', () => {
    const walls = new Set(['3,3']);
    const closed = getSweptHeadWallImpact(walls, { x: 2, y: 3 }, 'right', false);
    const open = getSweptHeadWallImpact(walls, { x: 2, y: 3 }, 'right', true);
    expect(open).toEqual(closed);
  });

  it('allows movement through a one-cell-wide corridor', () => {
    const walls = new Set<string>();
    for (let y = 2; y <= 6; y++) {
      walls.add(`3,${y}`);
      walls.add(`5,${y}`);
    }
    expect(getSweptHeadWallImpact(walls, { x: 4, y: 4 }, 'up', false)).toBeNull();
  });

  it('prevents crossing a thin wall between grid steps', () => {
    const walls = new Set(['3,3']);
    expect(getSweptHeadWallImpact(walls, { x: 2, y: 3 }, 'right', false))
      .toMatchObject({ x: 13, y: 21 });
  });

  it('detects the logical head center on a wall', () => {
    const walls = new Set(['3,3']);
    expect(getHeadWallImpact(walls, { x: 3, y: 3 }, 'up', false))
      .toEqual({ x: 13, y: 21 });
  });

  it('retains solid outer-wall collisions in Maze 1', () => {

    for (const [direction, head] of [
      ['right', { x: 19, y: 5 }],
      ['up', { x: 10, y: 1 }],
      ['down', { x: 10, y: 8 }],
    ] as const) {
      const game = new SnakeIIEngine(3, 1);
      game.cornerGraceEnabled = false;
      game.snake = [head];
      game.food = { x: 10, y: 7 };
      game.setDirection(direction);
      expect(game.step(), `collision ${direction}`).toBe('dead');
      expect(game.wallImpact).not.toBeNull();
      expect(game.wallImpactHeadOrigin).not.toBeNull();
    }

    const game = new SnakeIIEngine(3, 1);
    game.cornerGraceEnabled = false;
    game.snake = [{ x: 2, y: 5 }];
    game.food = { x: 10, y: 7 };
    game.setDirection('up');
    expect(game.step()).toBe('move');
    expect(game.snake[0]).toEqual({ x: 2, y: 4 });
    game.setDirection('left');
    expect(game.step()).toBe('move');
    expect(game.snake[0]).toEqual({ x: 1, y: 4 });
    expect(game.step(), 'collision left').toBe('dead');
    expect(game.wallImpact).not.toBeNull();
    expect(game.wallImpactHeadOrigin).not.toBeNull();
  });

  it('retains wraparound in No Maze', () => {
    const game = new SnakeIIEngine(3, 0);
    game.snake = [{ x: 20, y: 5 }, { x: 19, y: 5 }];
    game.food = { x: 5, y: 7 };
    expect(game.step()).toBe('move');
    expect(game.snake[0]).toEqual({ x: 0, y: 5 });
    expect(game.wallImpact).toBeNull();
  });

  it('offers 150ms corner grace instead of immediate wall death when enabled', () => {
    const game = new SnakeIIEngine(3, 1);
    game.cornerGraceEnabled = true;
    game.snake = [{ x: 19, y: 5 }, { x: 18, y: 5 }];
    game.food = { x: 10, y: 7 };
    expect(game.step()).toBe('grace');
    expect(game.dead).toBe(false);
    expect(game.cornerGracePending).toBe(true);
    expect(game.snake[0]).toEqual({ x: 19, y: 5 });
    game.setDirection('up');
    expect(game.tryCornerGraceTurn()).toBe('move');
    expect(game.snake[0]).toEqual({ x: 19, y: 4 });
  });
});
