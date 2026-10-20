import { describe, expect, it } from 'vitest';
import { SnakeIIEngine, type Cell } from './SnakeIIEngine';
import { cellKey, getWallCells, MAZE_IDS, requirePlayableMaze } from './MazeDefinitions';

function arrange(game: SnakeIIEngine, head: Cell, tail: Cell[] = []): void {
  game.snake = [head, ...tail];
  game.food = { x: 19, y: 8 };
  game.bonus = null;
  game.dead = false;
}

describe('Snake II — real engine & collision tests', () => {
  it('crosses all four edges without changing direction in No Maze', () => {
    const right = new SnakeIIEngine(3, 0);
    arrange(right, { x: 20, y: 5 }, [{ x: 19, y: 5 }]);
    expect(right.step()).toBe('move');
    expect(right.snake[0]).toEqual({ x: 0, y: 5 });
    expect(right.direction).toBe('right');

    const up = new SnakeIIEngine(3, 0);
    up.setDirection('up');
    arrange(up, { x: 10, y: 0 });
    expect(up.step()).toBe('move');
    expect(up.snake[0]).toEqual({ x: 10, y: 9 });

    const down = new SnakeIIEngine(3, 0);
    down.setDirection('down');
    arrange(down, { x: 10, y: 9 });
    expect(down.step()).toBe('move');
    expect(down.snake[0]).toEqual({ x: 10, y: 0 });

    const left = new SnakeIIEngine(3, 0);
    left.direction = 'up';
    left.setDirection('left');
    arrange(left, { x: 0, y: 5 });
    expect(left.step()).toBe('move');
    expect(left.snake[0]).toEqual({ x: 20, y: 5 });
  });

  it('collides with Maze 1 on each of its four sides', () => {
    const right = new SnakeIIEngine(3, 1);
    arrange(right, { x: 19, y: 5 });
    expect(right.step()).toBe('dead');

    const top = new SnakeIIEngine(3, 1);
    top.setDirection('up');
    arrange(top, { x: 10, y: 1 });
    expect(top.step()).toBe('dead');

    const bottom = new SnakeIIEngine(3, 1);
    bottom.setDirection('down');
    arrange(bottom, { x: 10, y: 8 });
    expect(bottom.step()).toBe('dead');

    const left = new SnakeIIEngine(3, 1);
    left.direction = 'up';
    left.setDirection('left');
    arrange(left, { x: 1, y: 5 });
    expect(left.step()).toBe('dead');
  });

  it('runs every selected map and uses its actual walls for collisions', () => {
    for (const id of MAZE_IDS) {
      const game = new SnakeIIEngine(3, id);
      expect(game.maze).toBe(id);
      expect(game.mazeDefinition).toBe(requirePlayableMaze(id));
      expect(game.walls).toBe(game.mazeDefinition.walls);
      for (const wall of getWallCells(game.mazeDefinition)) {
        expect(game.hasWall(wall)).toBe(true);
      }
    }
  });

  it('dies hitting interior obstacles in Maze 2–5', () => {
    for (const [id, head, direction] of [
      [2, { x: 6, y: 5 }, 'up'],
      [3, { x: 4, y: 4 }, 'up'],
      [4, { x: 9, y: 3 }, 'right'],
      [5, { x: 7, y: 4 }, 'up'],
    ] as const) {
      const game = new SnakeIIEngine(3, id);
      if (direction !== 'right') game.setDirection(direction);
      arrange(game, head);
      expect(game.step(), `Maze ${id} should hit its partition`).toBe('dead');
    }
  });

  it('can traverse open passages for Maze 2–5', () => {
    for (const [id, head, direction, end] of [
      [2, { x: 6, y: 5 }, 'right', { x: 7, y: 5 }],
      [3, { x: 10, y: 5 }, 'right', { x: 11, y: 5 }],
      [4, { x: 9, y: 2 }, 'right', { x: 10, y: 2 }],
      [5, { x: 9, y: 3 }, 'down', { x: 9, y: 4 }],
    ] as const) {
      const game = new SnakeIIEngine(3, id);
      if (game.hasWall(head)) {

        throw new Error(`Passage starts in a wall: maze ${id}`);
      }
      if (direction !== 'right') game.setDirection(direction);
      arrange(game, head);
      expect(game.step(), `Maze ${id} passage`).toBe('move');
      expect(game.snake[0]).toEqual(end);
    }
  });

  it('never generates normal or bonus food in a wall or snake cell', () => {
    for (const id of MAZE_IDS) {
      const game = new SnakeIIEngine(3, id);
      for (let attempt = 0; attempt < 25; attempt++) {
        game.reset();
        expect(game.food).not.toBeNull();
        expect(game.hasWall(game.food!)).toBe(false);
        expect(game.snake.map(cellKey)).not.toContain(cellKey(game.food!));
        const candidates = game.getFoodCandidates();
        if (candidates.length) {
          game.bonus = candidates[0];
          expect(game.hasWall(game.bonus)).toBe(false);
          expect(game.bonus).not.toEqual(game.food);
        }
      }
    }
  });

  it('moves into a vacated tail cell, but cannot grow into its own tail', () => {
    const game = new SnakeIIEngine(3, 0);
    arrange(game, { x: 4, y: 4 }, [
      { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 4 },
    ]);
    expect(game.step()).toBe('move');
    expect(game.snake[0]).toEqual({ x: 5, y: 4 });

    const grow = new SnakeIIEngine(3, 0);
    arrange(grow, { x: 4, y: 4 }, [
      { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 4 },
    ]);
    grow.food = { x: 5, y: 4 };
    expect(grow.step()).toBe('dead');
  });

  it('keeps Level speed independent from selected maze and renderer dimensions', () => {
    const game = new SnakeIIEngine(6, 0);
    const baseline = game.delayMs;
    for (const id of MAZE_IDS) {
      game.selectMaze(id);
      expect(game.delayMs).toBe(baseline);
    }
    game.level = 9;
    expect(game.delayMs).toBeLessThan(baseline);
  });

  it('adds normal food score and shows bonus after 5 regular foods', () => {
    const game = new SnakeIIEngine(4, 0);
    for (let index = 0; index < 5; index++) {
      const head = game.snake[0];
      game.food = { x: head.x + 1, y: head.y };
      expect(game.step()).toBe('eat');
    }
    expect(game.score).toBe(20);
    expect(game.eaten).toBe(5);
    expect(game.snake.length).toBe(8);
    expect(game.bonus).not.toBeNull();
    expect(game.bonusTicks).toBeGreaterThan(0);
    expect(game.hasWall(game.bonus!)).toBe(false);
  });

  it('awards 3 × Level for a bonus without growing', () => {
    const game = new SnakeIIEngine(4, 0);
    const before = game.snake.length;
    const head = game.snake[0];
    game.food = { x: 18, y: 8 };
    game.bonus = { x: head.x + 1, y: head.y };
    game.bonusTicks = 10;
    expect(game.step()).toBe('bonus');
    expect(game.score).toBe(12);
    expect(game.snake.length).toBe(before);
    expect(game.bonus).toBeNull();
  });

  it('handles a filled board without retrying food placement forever', () => {
    const game = new SnakeIIEngine(3, 1);
    const maze = requirePlayableMaze(1);
    game.snake = [];
    for (let y = 1; y < 9; y++) for (let x = 1; x < 20; x++) {
      if (!maze.walls.has(`${x},${y}`)) game.snake.push({ x, y });
    }
    expect(game.getFoodCandidates()).toHaveLength(0);
  });

  it('supports 90-degree star/hash relative turns', () => {
    const game = new SnakeIIEngine(3, 0);
    game.turn('left');
    expect(game.step()).toBe('move');
    expect(game.direction).toBe('up');
    game.turn('right');
    expect(game.step()).toBe('move');
    expect(game.direction).toBe('right');
  });
});
