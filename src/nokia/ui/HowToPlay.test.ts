import { describe, expect, it } from 'vitest';
import { drawMazePreview, shouldPauseForGuide } from './HowToPlay';
import { BOARD_HEIGHT, BOARD_WIDTH, getWallCells, MAZE_IDS, requirePlayableMaze } from '../game/MazeDefinitions';

describe('How To Play display data and pause policy', () => {
  it('opens from gameplay only after the caller pauses it', () => {
    expect(shouldPauseForGuide('game')).toBe(true);
    for (const page of ['menu', 'pause', 'maze', 'level', 'over']) {
      expect(shouldPauseForGuide(page)).toBe(false);
    }
  });

  it('draws preview obstacles ONLY from each authoritative maze wall set', () => {
    for (const id of MAZE_IDS) {
      const fills: Array<[number, number, number, number]> = [];
      const context = {
        imageSmoothingEnabled: true,
        fillStyle: '',
        fillRect: (x: number, y: number, w: number, h: number): void => {
          fills.push([x, y, w, h]);
        },
      };
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => context,
      } as unknown as HTMLCanvasElement;
      const maze = requirePlayableMaze(id);
      drawMazePreview(canvas, maze);
      expect(canvas.width).toBe(BOARD_WIDTH * 5);
      expect(canvas.height).toBe(BOARD_HEIGHT * 5);
      expect(context.imageSmoothingEnabled).toBe(false);
      expect(fills[0]).toEqual([0, 0, BOARD_WIDTH * 5, BOARD_HEIGHT * 5]);
      const walls = getWallCells(maze);
      const wallRects = fills.slice(1);
      expect(wallRects.length).toBe(walls.length);
      expect(new Set(wallRects.map(([x, y]) => `${x / 5},${y / 5}`)))
        .toEqual(new Set(maze.walls));
    }
  });
});
