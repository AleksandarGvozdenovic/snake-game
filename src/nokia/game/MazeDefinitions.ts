export type MazeId = 0 | 1 | 2 | 3 | 4 | 5;
export type EdgeMode = 'wrap' | 'solid';
export type Cell = Readonly<{ x: number; y: number }>;
export type MazeFidelity = 'documented-rule' | 'documented-concept' | 'reconstruction';

export const BOARD_WIDTH = 21;
export const BOARD_HEIGHT = 10;
export const MAZE_IDS: readonly MazeId[] = [0, 1, 2, 3, 4, 5];
export const MAZE_STORAGE_KEY = 'nokia-snake-ii-maze';

export interface MazeDefinition {
  readonly id: MazeId;
  readonly name: string;
  readonly description: string;
  readonly fidelity: MazeFidelity;
  readonly fidelityNote: string;
  readonly edgeMode: EdgeMode;
  readonly walls: ReadonlySet<string>;
  readonly initialSnake: readonly Cell[];
}

export type PlayableMazeDefinition = MazeDefinition;

export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

export function inside(cell: Cell): boolean {
  return Number.isInteger(cell.x) && Number.isInteger(cell.y) &&
    cell.x >= 0 && cell.x < BOARD_WIDTH && cell.y >= 0 && cell.y < BOARD_HEIGHT;
}

export function isMazeId(value: number): value is MazeId {
  return Number.isInteger(value) && value >= 0 && value <= 5;
}

const START: readonly Cell[] = [
  { x: 6, y: 5 }, { x: 5, y: 5 }, { x: 4, y: 5 },
];
const ROOMS_START: readonly Cell[] = [
  { x: 6, y: 3 }, { x: 5, y: 3 }, { x: 4, y: 3 },
];

const ROWS: Readonly<Record<MazeId, readonly string[]>> = {
  0: [
    '.....................',
    '.....................',
    '.....................',
    '.....................',
    '.....................',
    '.....................',
    '.....................',
    '.....................',
    '.....................',
    '.....................',
  ],
  1: [
    '#####################',
    '#...................#',
    '#...................#',
    '#...................#',
    '#...................#',
    '#...................#',
    '#...................#',
    '#...................#',
    '#...................#',
    '#####################',
  ],

  2: [
    '#####################',
    '#...................#',
    '#.....#.............#',
    '#.....#.............#',
    '#.....#.............#',
    '#.............#.....#',
    '#.............#.....#',
    '#.............#.....#',
    '#...................#',
    '#####################',
  ],

  3: [
    '#####################',
    '#.........#.........#',
    '#.........#.........#',
    '#.#######.#.........#',
    '#.........#.........#',
    '#...................#',
    '#........#..#######.#',
    '#........#..........#',
    '#........#..........#',
    '#####################',
  ],

  4: [
    '#####################',
    '#.........#.........#',
    '#...................#',
    '#.........#.........#',
    '#.........#.........#',
    '####.###########.####',
    '#.........#.........#',
    '#...................#',
    '#.........#.........#',
    '#####################',
  ],

  5: [
    '#####################',
    '#...#.......#.......#',
    '#...#...#...#...#...#',
    '#...#####.#######...#',
    '#...#...#...#...#...#',
    '#...........#.......#',
    '###.###.#.#####.###.#',
    '#...#...#...#...#...#',
    '#.......#.......#...#',
    '#####################',
  ],
};

function parseWalls(rows: readonly string[]): ReadonlySet<string> {
  if (rows.length !== BOARD_HEIGHT) throw new Error('Wrong maze height');
  const walls = new Set<string>();
  rows.forEach((row, y) => {
    if (row.length !== BOARD_WIDTH || /[^.#]/.test(row)) {
      throw new Error(`Wrong maze row ${y}: ${row}`);
    }
    for (let x = 0; x < BOARD_WIDTH; x++) {
      if (row[x] === '#') walls.add(`${x},${y}`);
    }
  });
  return walls;
}

const NOTES = {
  verified: 'Wraparound follows the documented Snake II rule.',
  concept: 'Outer-wall layout adapted to this board.',
  recon: 'Reconstructed layout; exact original wall coordinates are unverified. Outer edges are solid.',
} as const;

const definitions: Readonly<Record<MazeId, MazeDefinition>> = {
  0: { id: 0, name: 'NO MAZE', description: 'Open field with wraparound at all four edges.',
    fidelity: 'documented-rule', fidelityNote: NOTES.verified,
    edgeMode: 'wrap', walls: parseWalls(ROWS[0]), initialSnake: START },
  1: { id: 1, name: 'MAZE 1', description: 'Continuous outer wall with an open interior.',
    fidelity: 'documented-concept', fidelityNote: NOTES.concept,
    edgeMode: 'solid', walls: parseWalls(ROWS[1]), initialSnake: START },
  2: { id: 2, name: 'MAZE 2', description: 'Two inner pillars with passages.',
    fidelity: 'reconstruction', fidelityNote: NOTES.recon,
    edgeMode: 'solid', walls: parseWalls(ROWS[2]), initialSnake: START },
  3: { id: 3, name: 'MAZE 3', description: 'Horizontal and vertical partitions with corridors.',
    fidelity: 'reconstruction', fidelityNote: NOTES.recon,
    edgeMode: 'solid', walls: parseWalls(ROWS[3]), initialSnake: START },
  4: { id: 4, name: 'MAZE 4', description: 'Four connected areas with open passages.',
    fidelity: 'reconstruction', fidelityNote: NOTES.recon,
    edgeMode: 'solid', walls: parseWalls(ROWS[4]), initialSnake: ROOMS_START },
  5: { id: 5, name: 'MAZE 5', description: 'A dense, connected maze with narrow corridors.',
    fidelity: 'reconstruction', fidelityNote: NOTES.recon,
    edgeMode: 'solid', walls: parseWalls(ROWS[5]), initialSnake: START },
};

export function getMazeDefinition(id: MazeId): MazeDefinition {
  return definitions[id];
}

export function requirePlayableMaze(id: MazeId): MazeDefinition {
  if (!isMazeId(id)) throw new Error(`Unknown Maze ID: ${id}`);
  return definitions[id];
}

export function isWall(maze: MazeDefinition, cell: Cell): boolean {
  return maze.walls.has(cellKey(cell));
}

export function applyEdgeRule(cell: Cell, maze: MazeDefinition): Cell | null {
  if (maze.edgeMode === 'wrap') {
    return {
      x: ((cell.x % BOARD_WIDTH) + BOARD_WIDTH) % BOARD_WIDTH,
      y: ((cell.y % BOARD_HEIGHT) + BOARD_HEIGHT) % BOARD_HEIGHT,
    };
  }
  return inside(cell) ? cell : null;
}

export const resolveNextPosition = applyEdgeRule;

const STEPS: readonly Cell[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 },
  { x: 0, y: 1 }, { x: 0, y: -1 },
];

export function reachableEmptyCells(
  maze: MazeDefinition,
  snake: readonly Cell[],
  forbidden: ReadonlySet<string> = new Set<string>(),
): Cell[] {
  if (!snake.length || !inside(snake[0]) || isWall(maze, snake[0])) return [];
  const occupied = new Set(snake.slice(1).map(cellKey));
  const visited = new Set<string>([cellKey(snake[0])]);
  const queue: Cell[] = [snake[0]];
  const candidates: Cell[] = [];

  for (let i = 0; i < queue.length; i++) {
    const from = queue[i];
    for (const step of STEPS) {
      const next = applyEdgeRule({ x: from.x + step.x, y: from.y + step.y }, maze);
      if (!next) continue;
      const key = cellKey(next);
      if (visited.has(key) || maze.walls.has(key) || occupied.has(key)) continue;
      visited.add(key);
      queue.push(next);
      if (!forbidden.has(key)) candidates.push(next);
    }
  }
  return candidates;
}

export const getFreeFoodPositions = reachableEmptyCells;

export function getWallCells(maze: MazeDefinition): readonly Cell[] {
  return Array.from(maze.walls, (key) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });
}

export function validateMazeDefinition(maze: MazeDefinition): string[] {
  const errors: string[] = [];
  const occupied = new Set<string>();
  for (let i = 0; i < maze.initialSnake.length; i++) {
    const cell = maze.initialSnake[i];
    if (!inside(cell) || isWall(maze, cell) || occupied.has(cellKey(cell))) {
      errors.push(`Unsafe starting snake at ${cellKey(cell)}`);
    }
    if (i > 0) {
      const prev = maze.initialSnake[i - 1];
      if (Math.abs(prev.x - cell.x) + Math.abs(prev.y - cell.y) !== 1) {
        errors.push('Disconnected starting segments');
      }
    }
    occupied.add(cellKey(cell));
  }
  const next = applyEdgeRule({ x: maze.initialSnake[0].x + 1, y: maze.initialSnake[0].y }, maze);
  if (!next || maze.walls.has(cellKey(next))) errors.push('First step is blocked');
  for (const key of maze.walls) {
    const [x, y] = key.split(',').map(Number);
    if (!inside({ x, y })) errors.push(`Wall outside board: ${key}`);
  }
  const reachable = new Set(reachableEmptyCells(maze, [maze.initialSnake[0]]).map(cellKey));
  reachable.add(cellKey(maze.initialSnake[0]));
  let free = 0;
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const key = `${x},${y}`;
      if (!maze.walls.has(key)) {
        free++;
        if (!reachable.has(key)) errors.push(`Isolated free cell: ${key}`);
      }
    }
  }
  if (free <= maze.initialSnake.length) errors.push('No space to place food');
  return errors;
}

export type MazeStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function readMazeSelection(storage: MazeStorage): MazeId {
  try {
    const raw = storage.getItem(MAZE_STORAGE_KEY);
    const parsed = raw === null ? 0 : Number(raw);
    return isMazeId(parsed) ? parsed : 0;
  } catch { return 0; }
}
export function saveMazeSelection(storage: MazeStorage, id: MazeId): void {
  if (!isMazeId(id)) throw new Error('Invalid maze selection');
  try { storage.setItem(MAZE_STORAGE_KEY, String(id)); } catch {  }
}
