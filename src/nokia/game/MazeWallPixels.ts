import { LCD_HEIGHT, LCD_WIDTH } from '../lcd/LcdFramebuffer';
import type { Cell } from './MazeDefinitions';
import type { Direction } from './SnakeIIEngine';
import { FIELD_TOP, TILE } from './SnakeIISprites';

export type LcdPoint = Readonly<{
  x: number;
  y: number;
}>;

const cache = new WeakMap<ReadonlySet<string>, Uint8Array>();

function key(x: number, y: number): string {
  return `${x},${y}`;
}

export function forEachWallPixel(
  cell: Cell,
  walls: ReadonlySet<string>,
  plot: (x: number, y: number) => void,
): void {
  const x = cell.x * TILE;
  const y = FIELD_TOP + cell.y * TILE;

  const cx = x + Math.floor((TILE - 1) / 2);
  const cy = y + Math.floor((TILE - 1) / 2);

  plot(cx, cy);

  if (walls.has(key(cell.x - 1, cell.y))) {
    for (let px = x; px < cx; px++) {
      plot(px, cy);
    }
  }

  if (walls.has(key(cell.x + 1, cell.y))) {
    for (let px = cx + 1; px < x + TILE; px++) {
      plot(px, cy);
    }
  }

  if (walls.has(key(cell.x, cell.y - 1))) {
    for (let py = y; py < cy; py++) {
      plot(cx, py);
    }
  }

  if (walls.has(key(cell.x, cell.y + 1))) {
    for (let py = cy + 1; py < y + TILE; py++) {
      plot(cx, py);
    }
  }
}

export function getWallPixelMask(
  walls: ReadonlySet<string>,
): Uint8Array {
  const existing = cache.get(walls);

  if (existing) {
    return existing;
  }

  const pixels = new Uint8Array(
    LCD_WIDTH * LCD_HEIGHT,
  );

  for (const wall of walls) {
    const [cx, cy] = wall.split(',').map(Number);

    forEachWallPixel(
      { x: cx, y: cy },
      walls,
      (x, y) => {
        if (
          x >= 0 &&
          x < LCD_WIDTH &&
          y >= 0 &&
          y < LCD_HEIGHT
        ) {
          pixels[y * LCD_WIDTH + x] = 1;
        }
      },
    );
  }

  cache.set(walls, pixels);

  return pixels;
}

export type WallContact = Readonly<{
  x: number;
  y: number;
  originX: number;
  originY: number;
}>;

const HITBOX_SIZE = 2;

const HITBOX_OFFSET = Math.floor(
  (TILE - HITBOX_SIZE) / 2,
);

function contactAt(
  mask: Uint8Array,
  originX: number,
  originY: number,
): WallContact | null {
  for (
    let y = HITBOX_OFFSET;
    y < HITBOX_OFFSET + HITBOX_SIZE;
    y++
  ) {
    for (
      let x = HITBOX_OFFSET;
      x < HITBOX_OFFSET + HITBOX_SIZE;
      x++
    ) {
      const px = originX + x;
      const py = originY + y;

      if (
        px < 0 ||
        px >= LCD_WIDTH ||
        py < 0 ||
        py >= LCD_HEIGHT
      ) {
        continue;
      }

      if (mask[py * LCD_WIDTH + px] === 1) {
        return {
          x: px,
          y: py,
          originX,
          originY,
        };
      }
    }
  }

  return null;
}

export function getHeadWallImpact(
  walls: ReadonlySet<string>,
  head: Cell,
  _direction: Direction,
  _mouthOpen: boolean,
): LcdPoint | null {
  if (walls.size === 0) {
    return null;
  }

  const impact = contactAt(
    getWallPixelMask(walls),
    head.x * TILE,
    FIELD_TOP + head.y * TILE,
  );

  if (!impact) {
    return null;
  }

  return {
    x: impact.x,
    y: impact.y,
  };
}

export function getSweptHeadWallImpact(
  walls: ReadonlySet<string>,
  from: Cell,
  direction: Direction,
  _mouthOpen: boolean,
): WallContact | null {
  if (walls.size === 0) {
    return null;
  }

  const vectors: Readonly<
    Record<Direction, LcdPoint>
  > = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const mask = getWallPixelMask(walls);

  const dx = vectors[direction].x;
  const dy = vectors[direction].y;

  const originX = from.x * TILE;
  const originY = FIELD_TOP + from.y * TILE;

  for (let pixels = 1; pixels <= TILE; pixels++) {
    const impact = contactAt(
      mask,
      originX + dx * pixels,
      originY + dy * pixels,
    );

    if (impact) {
      return impact;
    }
  }

  return null;
}
