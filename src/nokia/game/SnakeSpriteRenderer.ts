import { LcdFramebuffer } from '../lcd/LcdFramebuffer';
import type { Cell, Direction, SnakeIIEngine } from './SnakeIIEngine';
import { forEachWallPixel } from './MazeWallPixels';
import {
  TILE, FIELD_TOP, type Sprite,
  HEAD_UP_CLOSED, HEAD_UP_OPEN,
  BODY_HORIZONTAL, CORNER_UP_LEFT, TAIL_TOWARD_RIGHT,
  DIGEST, FOOD, BONUS, rotateSprite,
} from './SnakeIISprites';

function paint(frame: LcdFramebuffer, sprite: Sprite, x: number, y: number): void {
  for (let row = 0; row < sprite.height; row++) {
    for (let col = 0; col < sprite.width; col++) {
      if (sprite.pixels[row][col] === '1') frame.setPixel(x + col, y + row);
    }
  }
}

function position(cell: Cell): { x: number; y: number } {
  return { x: cell.x * TILE, y: FIELD_TOP + cell.y * TILE };
}

function toward(from: Cell, to: Cell, width: number, height: number): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 || dx === -(width - 1)) return 'right';
  if (dx === -1 || dx === width - 1) return 'left';
  if (dy === 1 || dy === -(height - 1)) return 'down';
  return 'up';
}

function opposite(direction: Direction): Direction {
  switch (direction) {
    case 'up': return 'down';
    case 'down': return 'up';
    case 'left': return 'right';
    case 'right': return 'left';
  }
}

const HEAD_TURNS: Record<Direction, number> = {
  up: 0, right: 1, down: 2, left: 3,
};
const TAIL_TURNS: Record<Direction, number> = {
  right: 0, down: 1, left: 2, up: 3,
};

function cornerTurns(a: Direction, b: Direction): number {
  const pair = new Set([a, b]);
  if (pair.has('up') && pair.has('left')) return 0;
  if (pair.has('up') && pair.has('right')) return 1;
  if (pair.has('right') && pair.has('down')) return 2;
  if (pair.has('down') && pair.has('left')) return 3;
  throw new Error(`Invalid corner ${a}/${b}`);
}

function bodySprite(toHead: Direction, toTail: Direction): Sprite {
  if (opposite(toHead) === toTail) {
    return toHead === 'left' || toHead === 'right'
      ? BODY_HORIZONTAL
      : rotateSprite(BODY_HORIZONTAL, 1);
  }
  return rotateSprite(CORNER_UP_LEFT, cornerTurns(toHead, toTail));
}

export function drawSnakeSprites(frame: LcdFramebuffer, game: SnakeIIEngine): void {
  const segments = game.snake;
  if (!segments.length) return;
  for (let i = segments.length - 1; i >= 1; i--) {
    const cell = segments[i];
    const { x, y } = position(cell);
    const toHead = toward(cell, segments[i - 1], game.width, game.height);
    if (i === segments.length - 1) {
      paint(frame, rotateSprite(TAIL_TOWARD_RIGHT, TAIL_TURNS[toHead]), x, y);
    } else {
      const toTail = toward(cell, segments[i + 1], game.width, game.height);
      paint(frame, bodySprite(toHead, toTail), x, y);
    }
  }
  for (const index of game.digestion) {
    if (index > 0 && index < segments.length) {
      const { x, y } = position(segments[index]);
      paint(frame, DIGEST, x, y);
    }
  }

  const { x, y } = position(segments[0]);
  const mouthOpen = game.deathReason === 'self' || (game.wallImpactHeadOrigin
    ? game.wallImpactMouthOpen
    : game.mouthOpen);
  const head = rotateSprite(
    mouthOpen ? HEAD_UP_OPEN : HEAD_UP_CLOSED,
    HEAD_TURNS[game.direction],
  );

  const headX = x + Math.floor((TILE - head.width) / 2);
  const headY = y + Math.floor((TILE - head.height) / 2);
  paint(frame, head, headX, headY);
}

export function drawFoodSprite(frame: LcdFramebuffer, cell: Cell): void {
  const { x, y } = position(cell);
  paint(frame, FOOD, x, y);
}

export function drawBonusSprite(frame: LcdFramebuffer, cell: Cell): void {
  const { x, y } = position(cell);
  paint(frame, BONUS, x, y);
}

export function drawWallSprite(
  frame: LcdFramebuffer,
  cell: Cell,
  walls: ReadonlySet<string>,
): void {

  forEachWallPixel(cell, walls, (x, y) => frame.setPixel(x, y));
}
