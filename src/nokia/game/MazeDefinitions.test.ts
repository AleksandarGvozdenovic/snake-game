import { describe, expect, it } from 'vitest';
import {
  applyEdgeRule, BOARD_HEIGHT, BOARD_WIDTH, cellKey, getMazeDefinition,
  getWallCells, inside, isWall, MAZE_IDS, readMazeSelection,
  reachableEmptyCells, requirePlayableMaze, saveMazeSelection, validateMazeDefinition,
  MAZE_STORAGE_KEY, type MazeDefinition,
} from './MazeDefinitions';

const allMazes = MAZE_IDS.map(requirePlayableMaze);

describe('Snake II — six fixed maze definitions', () => {
  it('exposes exactly the six requested options, all playable', () => {
    expect(MAZE_IDS).toEqual([0, 1, 2, 3, 4, 5]);
    for (const id of MAZE_IDS) expect(getMazeDefinition(id)).toBeDefined();
  });

  it('No Maze has no walls and wraps across all four edges', () => {
    const maze = requirePlayableMaze(0);
    expect(maze.edgeMode).toBe('wrap');
    expect(maze.walls.size).toBe(0);
    expect(applyEdgeRule({ x: 21, y: 5 }, maze)).toEqual({ x: 0, y: 5 });
    expect(applyEdgeRule({ x: -1, y: 5 }, maze)).toEqual({ x: 20, y: 5 });
    expect(applyEdgeRule({ x: 10, y: -1 }, maze)).toEqual({ x: 10, y: 9 });
    expect(applyEdgeRule({ x: 10, y: 10 }, maze)).toEqual({ x: 10, y: 0 });
  });

  it('Maze 1 has uninterrupted outside walls and no interior obstacles', () => {
    const maze = requirePlayableMaze(1);
    expect(maze.edgeMode).toBe('solid');
    expect(maze.walls.size).toBe(2 * BOARD_WIDTH + 2 * (BOARD_HEIGHT - 2));
    for (let x = 0; x < BOARD_WIDTH; x++) {
      expect(maze.walls.has(`${x},0`)).toBe(true);
      expect(maze.walls.has(`${x},9`)).toBe(true);
    }
    for (let y = 0; y < BOARD_HEIGHT; y++) {
      expect(maze.walls.has(`0,${y}`)).toBe(true);
      expect(maze.walls.has(`20,${y}`)).toBe(true);
    }
    for (let y = 1; y <= 8; y++) for (let x = 1; x <= 19; x++) {
      expect(maze.walls.has(`${x},${y}`)).toBe(false);
    }
    expect(applyEdgeRule({ x: -1, y: 5 }, maze)).toBeNull();
  });

  it('Maze 2 has the two prescribed pillars', () => {
    const maze = requirePlayableMaze(2);
    for (const y of [2, 3, 4]) expect(isWall(maze, { x: 6, y })).toBe(true);
    for (const y of [5, 6, 7]) expect(isWall(maze, { x: 14, y })).toBe(true);
    expect(isWall(maze, { x: 10, y: 4 })).toBe(false);
    expect(isWall(maze, { x: 6, y: 5 })).toBe(false);
  });

  it('Maze 3 uses fixed horizontal and vertical partition passages', () => {
    const maze = requirePlayableMaze(3);
    expect(isWall(maze, { x: 4, y: 3 })).toBe(true);
    expect(isWall(maze, { x: 10, y: 3 })).toBe(true);
    expect(isWall(maze, { x: 16, y: 6 })).toBe(true);
    expect(isWall(maze, { x: 10, y: 5 })).toBe(false);
    expect(isWall(maze, { x: 11, y: 6 })).toBe(false);
  });

  it('Maze 4 has open connectors between all four regions', () => {
    const maze = requirePlayableMaze(4);
    expect(isWall(maze, { x: 10, y: 1 })).toBe(true);
    expect(isWall(maze, { x: 10, y: 2 })).toBe(false);
    expect(isWall(maze, { x: 10, y: 7 })).toBe(false);
    expect(isWall(maze, { x: 4, y: 5 })).toBe(false);
    expect(isWall(maze, { x: 16, y: 5 })).toBe(false);
    expect(isWall(maze, { x: 9, y: 5 })).toBe(true);
  });

  it('Maze 5 has complex, but connected, corridors', () => {
    const maze = requirePlayableMaze(5);
    expect(maze.walls.size).toBeGreaterThan(requirePlayableMaze(3).walls.size);
    expect(isWall(maze, { x: 8, y: 3 })).toBe(true);
    expect(isWall(maze, { x: 9, y: 3 })).toBe(false);
    expect(isWall(maze, { x: 3, y: 6 })).toBe(false);
    expect(isWall(maze, { x: 7, y: 6 })).toBe(false);
  });

  it.each(allMazes)('Maze $id has a valid start, safe forward step and no isolated cells', (maze: MazeDefinition) => {
    expect(validateMazeDefinition(maze)).toEqual([]);
    for (const cell of maze.initialSnake) {
      expect(inside(cell)).toBe(true);
      expect(isWall(maze, cell)).toBe(false);
    }
    const keys = new Set(reachableEmptyCells(maze, [maze.initialSnake[0]]).map(cellKey));
    keys.add(cellKey(maze.initialSnake[0]));
    expect(keys.size).toBe(BOARD_WIDTH * BOARD_HEIGHT - maze.walls.size);
  });

  it.each(allMazes)('Maze $id renders exactly the same wall coordinates as collisions', (maze: MazeDefinition) => {
    const visible = getWallCells(maze).map(cellKey);
    expect(new Set(visible)).toEqual(new Set(maze.walls));
    expect(visible.length).toBe(maze.walls.size);
  });

  it('food BFS cannot cross isolated walls, even in a malformed custom map', () => {
    const outer = requirePlayableMaze(1);
    const wall = new Set(outer.walls);
    for (let y = 1; y <= 8; y++) wall.add(`10,${y}`);
    const disconnected = { ...outer, walls: wall };
    const candidates = reachableEmptyCells(disconnected, outer.initialSnake);
    expect(candidates.some(cell => cell.x >= 11)).toBe(false);
    expect(candidates.some(cell => cell.x === 9)).toBe(true);
    expect(validateMazeDefinition(disconnected).some(e => e.startsWith('Isolated'))).toBe(true);
  });

  it('persists valid map selection; corrupt or missing values fall back safely', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(readMazeSelection(storage)).toBe(0);
    saveMazeSelection(storage, 5);
    expect(values.get(MAZE_STORAGE_KEY)).toBe('5');
    expect(readMazeSelection(storage)).toBe(5);
    values.set(MAZE_STORAGE_KEY, '99');
    expect(readMazeSelection(storage)).toBe(0);
  });

  it('keeps reconstructed geometries honestly labeled', () => {
    expect(requirePlayableMaze(0).fidelity).toBe('documented-rule');
    expect(requirePlayableMaze(1).fidelity).toBe('documented-concept');
    for (const id of [2, 3, 4, 5] as const) {
      expect(requirePlayableMaze(id).fidelity).toBe('reconstruction');
      expect(requirePlayableMaze(id).fidelityNote).toMatch(/Reconstructed/);
    }
  });
});
