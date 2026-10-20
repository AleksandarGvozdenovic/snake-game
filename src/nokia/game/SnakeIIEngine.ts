import {
  applyEdgeRule, cellKey, inside,
  isMazeId, reachableEmptyCells, requirePlayableMaze,
  BOARD_HEIGHT, BOARD_WIDTH,
  type Cell, type MazeId, type PlayableMazeDefinition,
} from './MazeDefinitions';
import { getSweptHeadWallImpact, type LcdPoint } from './MazeWallPixels';

export type { Cell, MazeId } from './MazeDefinitions';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type StepResult = 'move' | 'eat' | 'bonus' | 'dead' | 'grace';
export type DeathReason = 'wall' | 'self' | 'boundary' | 'board-full';

const VECTORS: Readonly<Record<Direction, Cell>> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};
const same = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

export class SnakeIIEngine {
  readonly width = BOARD_WIDTH;
  readonly height = BOARD_HEIGHT;

  snake: Cell[] = [];
  food: Cell | null = null;
  bonus: Cell | null = null;
  bonusTicks = 0;
  score = 0;
  eaten = 0;
  dead = false;
  deathReason: DeathReason | null = null;

  // Enabled by the UI; engine tests opt in explicitly.
  cornerGraceEnabled = false;

  cornerGracePending = false;

  wallImpact: LcdPoint | null = null;
  wallImpactHeadOrigin: LcdPoint | null = null;
  wallImpactMouthOpen = false;
  direction: Direction = 'right';

  private selectedMaze: MazeId;
  private definition: PlayableMazeDefinition;
  private nextDirection: Direction = 'right';
  private inputQueued = false;
  private mouthTicks = 0;
  private digest: number[] = [];

  constructor(public level = 3, maze: MazeId = 0) {
    this.definition = requirePlayableMaze(maze);
    this.selectedMaze = maze;
    this.reset();
  }

  get maze(): MazeId { return this.selectedMaze; }
  set maze(id: MazeId) { this.selectMaze(id); }
  get mazeDefinition(): PlayableMazeDefinition { return this.definition; }

  get walls(): ReadonlySet<string> { return this.definition.walls; }

  selectMaze(id: MazeId): void {
    if (!isMazeId(id)) throw new Error(`Unknown Maze ID: ${id}`);
    const next = requirePlayableMaze(id);
    this.selectedMaze = id;
    this.definition = next;
    this.reset();
  }

  get digestion(): readonly number[] { return this.digest; }

  get mouthOpen(): boolean {
    if (this.dead || !this.snake.length) return false;
    if (this.mouthTicks > 0) return true;
    const head = this.snake[0];
    const vector = VECTORS[this.direction];
    for (let distance = 1; distance <= 2; distance++) {
      const next = applyEdgeRule({
        x: head.x + vector.x * distance,
        y: head.y + vector.y * distance,
      }, this.definition);
      if (!next || this.hasWall(next)) return false;
      if ((this.food && same(next, this.food)) ||
          (this.bonus && same(next, this.bonus))) return true;
    }
    return false;
  }

  get delayMs(): number {
    return Math.max(95, 335 - (this.level - 1) * 29);
  }

  reset(): void {
    this.score = 0;
    this.eaten = 0;
    this.dead = false;
    this.deathReason = null;
    this.cornerGracePending = false;
    this.wallImpact = null;
    this.wallImpactHeadOrigin = null;
    this.wallImpactMouthOpen = false;
    this.direction = 'right';
    this.nextDirection = 'right';
    this.inputQueued = false;
    this.mouthTicks = 0;
    this.digest = [];
    this.bonus = null;
    this.food = null;
    this.bonusTicks = 0;
    this.snake = this.definition.initialSnake.map(({ x, y }) => ({ x, y }));
    this.checkInitialSnake();
    this.food = this.randomEmptyCell();
    if (!this.food) {
      this.dead = true;
      this.deathReason = 'board-full';
    }
  }

  private checkInitialSnake(): void {
    const occupied = new Set<string>();
    for (const cell of this.snake) {
      const key = cellKey(cell);
      if (!inside(cell) || this.walls.has(key) || occupied.has(key)) {
        throw new Error(`Invalid initial snake for ${this.definition.name} at ${key}`);
      }
      occupied.add(key);
    }
    for (let i = 1; i < this.snake.length; i++) {
      const a = this.snake[i - 1];
      const b = this.snake[i];
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) {
        throw new Error('Initial snake segments are not adjacent');
      }
    }
  }

  // Queue the latest valid perpendicular input until the next movement tick.
  setDirection(requested: Direction): void {
    if (this.dead) return;

    if (requested === this.direction) return;

    const current = VECTORS[this.direction];
    const wanted = VECTORS[requested];

    if (current.x + wanted.x === 0 && current.y + wanted.y === 0) return;

    if (this.inputQueued && requested === this.nextDirection) return;

    this.nextDirection = requested;
    this.inputQueued = true;
  }

  turn(relative: 'left' | 'right'): void {
    const sequence: readonly Direction[] = ['up', 'right', 'down', 'left'];
    const index = sequence.indexOf(this.direction);
    this.setDirection(sequence[(index + (relative === 'right' ? 1 : 3)) % 4]);
  }

  tryCornerGraceTurn(): StepResult | null {
    if (!this.cornerGracePending || this.dead || !this.inputQueued) return null;
    if (this.nextDirection === this.direction) return null;
    const facing = VECTORS[this.direction];
    const wanted = VECTORS[this.nextDirection];
    if (facing.x + wanted.x === 0 && facing.y + wanted.y === 0) return null;

    const head = this.snake[0];
    const target = applyEdgeRule({
      x: head.x + wanted.x,
      y: head.y + wanted.y,
    }, this.definition);
    if (!target || this.hasWall(target)) return null;
    const eating = this.food !== null && same(target, this.food);
    const body = eating ? this.snake : this.snake.slice(0, -1);
    if (body.some((segment) => same(segment, target))) return null;
    if (getSweptHeadWallImpact(this.walls, head, this.nextDirection,
        this.mouthOpen || eating || (this.bonus !== null && same(target, this.bonus)))) {
      return null;
    }

    this.cornerGracePending = false;
    return this.step();
  }

  expireCornerGrace(): boolean {
    if (!this.cornerGracePending || this.dead) return false;
    this.cornerGracePending = false;
    this.nextDirection = this.direction;
    this.inputQueued = false;
    this.wallImpact = null;
    this.wallImpactHeadOrigin = null;
    this.wallImpactMouthOpen = false;
    this.dead = true;
    this.deathReason = 'wall';
    return true;
  }

  step(): StepResult {
    if (this.dead) return 'dead';
    if (this.cornerGracePending) return 'grace';
    const previousDirection = this.direction;
    this.direction = this.nextDirection;
    this.inputQueued = false;
    const head = this.snake[0];
    const delta = VECTORS[this.direction];
    const next = applyEdgeRule(
      { x: head.x + delta.x, y: head.y + delta.y }, this.definition,
    );

    if (!next) {
      this.direction = previousDirection;
      this.dead = true;
      this.deathReason = 'boundary';
      return 'dead';
    }
    const eating = this.food !== null && same(next, this.food);
    const bonusEating = this.bonus !== null && same(next, this.bonus);

    const openingMouth = this.mouthOpen || eating || bonusEating;
    const impact = getSweptHeadWallImpact(
      this.walls, head, this.direction, openingMouth,
    );
    if (impact && this.cornerGraceEnabled) {

      this.cornerGracePending = true;
      this.direction = previousDirection;
      this.nextDirection = previousDirection;
      this.inputQueued = false;
      this.wallImpact = null;
      this.wallImpactHeadOrigin = null;
      this.wallImpactMouthOpen = false;
      return 'grace';
    }
    if (impact) {
      this.wallImpact = { x: impact.x, y: impact.y };
      this.wallImpactHeadOrigin = { x: impact.originX, y: impact.originY };
      this.wallImpactMouthOpen = openingMouth;

      this.direction = previousDirection;
      this.dead = true;
      this.deathReason = 'wall';
      return 'dead';
    }
    const bodyToCheck = eating ? this.snake : this.snake.slice(0, -1);
    if (bodyToCheck.some((segment) => same(segment, next))) {
      this.dead = true;
      this.deathReason = 'self';
      return 'dead';
    }

    this.snake.unshift(next);
    if (!eating) this.snake.pop();
    this.mouthTicks = Math.max(0, this.mouthTicks - 1);
    this.digest = this.digest.map((index) => index + 1)
      .filter((index) => index < this.snake.length);

    if (eating) {
      this.score += this.level;
      this.eaten++;
      this.mouthTicks = 1;
      this.digest.push(0);

      this.food = null;
      this.food = this.randomEmptyCell();
      if (this.eaten % 5 === 0) {
        this.bonus = this.randomEmptyCell();
        this.bonusTicks = this.bonus ? 22 : 0;
      }
    }
    if (bonusEating) {
      this.mouthTicks = 1;
      this.digest.push(0);
      this.score += this.level * 3;
      this.bonus = null;
      this.bonusTicks = 0;
    } else if (this.bonus) {
      this.bonusTicks--;
      if (this.bonusTicks <= 0) {
        this.bonusTicks = 0;
        this.bonus = null;
      }
    }

    if (!this.food) {

      this.dead = true;
      this.deathReason = 'board-full';
      return 'dead';
    }
    return eating ? 'eat' : bonusEating ? 'bonus' : 'move';
  }

  hasWall(cell: Cell): boolean {
    return this.walls.has(cellKey(cell));
  }

  getFoodCandidates(): readonly Cell[] {
    const forbidden = new Set<string>();
    if (this.food) forbidden.add(cellKey(this.food));
    if (this.bonus) forbidden.add(cellKey(this.bonus));
    return reachableEmptyCells(this.definition, this.snake, forbidden);
  }

  private randomEmptyCell(): Cell | null {
    const candidates = this.getFoodCandidates();
    return candidates.length
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : null;
  }
}
