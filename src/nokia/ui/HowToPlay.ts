import './how-to-play.css';
import {
  BOARD_HEIGHT, BOARD_WIDTH, getMazeDefinition, getWallCells, MAZE_IDS,
  type MazeDefinition,
} from '../game/MazeDefinitions';

export function shouldPauseForGuide(page: string): boolean {
  return page === 'game';
}

interface GuideOptions { onBeforeOpen: () => void }
export interface GuideController { open(): void; isOpen(): boolean; dispose(): void }

export function drawMazePreview(canvas: HTMLCanvasElement, maze: MazeDefinition): void {
  const cellSize = 5;
  canvas.width = BOARD_WIDTH * cellSize;
  canvas.height = BOARD_HEIGHT * cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#b5c982';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#233518';
  for (const cell of getWallCells(maze)) {
    ctx.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize);
  }
}

const ENGLISH_MAZE_DESCRIPTIONS: Readonly<Record<MazeDefinition['id'], string>> = {
  0: 'Open playfield; wrap around all four edges.',
  1: 'Continuous outer wall with an open interior.',
  2: 'Two inner vertical pillars with passages.',
  3: 'Horizontal and vertical partitions with corridors.',
  4: 'Four connected areas with open passages.',
  5: 'A dense but connected network of walls and passages.',
};

export function mountHowToPlay(options: GuideOptions): GuideController {
  const header = document.querySelector<HTMLElement>('.app-heading');
  if (!header) throw new Error('Missing .app-heading for HOW TO PLAY');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'howto-trigger';
  trigger.textContent = 'ⓘ HOW TO PLAY';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');
  header.appendChild(trigger);

  const dialog = document.createElement('dialog');
  dialog.className = 'snake-howto-dialog';
  dialog.setAttribute('aria-labelledby', 'snake-howto-heading');
  dialog.innerHTML = `
    <div class="howto-shell">
      <header class="howto-header">
        <div>
          <p class="howto-eyebrow">NOKIA 3310 · SNAKE II</p>
          <h2 id="snake-howto-heading">HOW TO PLAY SNAKE II</h2>
          <p class="howto-subtitle">Game instructions and maze overview</p>
        </div>
        <button type="button" class="howto-close" aria-label="Close instructions">✕</button>
      </header>
      <div class="howto-scroll">
        <section><h3>Objective</h3>
          <p>Guide your snake, collect food, and beat your high score. Regular food makes your snake grow. Hitting your own body or a wall ends the game.</p>
        </section>
        <section><h3>Controls</h3>
          <div class="howto-two-col">
            <p><strong>Desktop</strong><br>↑ / 8 — up<br>↓ / 2 — down<br>← / 4 — left<br>→ / 6 — right<br>W A S D — alternative controls<br>* — turn 90° left<br># — turn 90° right<br>P / C / Esc — pause</p>
            <p><strong>Mobile</strong><br>Use the arrow buttons below the LCD screen or swipe across the playfield. In fullscreen, swipe to turn and use Pause next to Score.<br><br><strong>Resume</strong><br>Select Continue in the pause menu to resume. Closing this guide does not automatically resume the game.</p>
          </div>
        </section>
        <section><h3>Speed levels (1–9)</h3>
          <p>Choose your speed in the Level menu before starting. Level 1 is the slowest and Level 9 is the fastest. Speed does not increase as you eat. Regular food awards points equal to your selected level.</p>
        </section>
        <section><h3>Six maze options</h3>
          <p><strong>No Maze:</strong> no walls; the snake wraps around to the opposite edge.</p>
          <p><strong>Maze 1:</strong> one continuous outer wall; hitting it ends the game.</p>
          <p><strong>Maze 2:</strong> two interior pillars with passages.</p>
          <p><strong>Maze 3:</strong> horizontal and vertical partitions form corridors.</p>
          <p><strong>Maze 4:</strong> four connected areas with narrow passages.</p>
          <p><strong>Maze 5:</strong> the most complex network of walls and turns.</p>
        </section>
        <section aria-labelledby="howto-maze-heading">
          <h3 id="howto-maze-heading">Maze previews</h3>
          <p>These mini-maps use exactly the same walls as the game. Dark = wall; light = open path.</p>
          <div class="howto-maze-grid"></div>
        </section>
        <section><h3>Food and bonus bugs</h3>
          <p>Regular food makes your snake grow. After five regular pickups, a time-limited bonus bug appears. In this remake, the bonus awards three times as many points as regular food and does not make the snake grow.</p>
          <p class="howto-note">The fixed ×3 bonus multiplier is specific to this remake; the original Nokia game used time-dependent bonus scoring.</p>
        </section>
        <section><h3>Scoring and high score</h3>
          <p>Regular food: Level × 1 point. Bonus: Level × 3 points in this remake. Your high score is saved locally in your browser.</p>
        </section>
        <section><h3>Tips for a high score</h3>
          <ol>
            <li>Turn early when approaching a wall.</li>
            <li>Watch your tail and leave yourself an escape route.</li>
            <li>Use a zigzag pattern as your snake grows.</li>
            <li>Master the slower speed levels first.</li>
            <li>In mazes, plan your route before turning.</li>
            <li>Do not risk getting trapped just to collect a bonus bug.</li>
          </ol>
        </section>
        <section><h3>Pause</h3>
          <p>Press P, C, or Esc. Pausing preserves your snake’s position, score, and food. Opening this guide during a game automatically pauses it; select Continue to resume.</p>
        </section>
      </div>
    </div>`;
  document.body.appendChild(dialog);

  const grid = dialog.querySelector<HTMLElement>('.howto-maze-grid')!;
  for (const id of MAZE_IDS) {
    const maze = getMazeDefinition(id);
    const card = document.createElement('article');
    card.className = 'howto-maze-card';
    const heading = document.createElement('h4');
    heading.textContent = maze.name;
    const canvas = document.createElement('canvas');
    canvas.className = 'howto-map-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${maze.name}: preview of the actual maze walls`);
    const description = document.createElement('p');
    description.textContent = ENGLISH_MAZE_DESCRIPTIONS[maze.id];
    card.append(heading, canvas, description);
    grid.appendChild(card);
    drawMazePreview(canvas, maze);
  }

  const closeButton = dialog.querySelector<HTMLButtonElement>('.howto-close')!;
  let disposed = false;
  let returnFocus: HTMLElement | null = null;

  const close = (): void => {
    if (!dialog.open) return;
    dialog.close();
    trigger.setAttribute('aria-expanded', 'false');
    (returnFocus?.isConnected ? returnFocus : trigger).focus();
    returnFocus = null;
  };
  const open = (): void => {
    if (disposed || dialog.open) return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;
    options.onBeforeOpen();

    MAZE_IDS.forEach((id, index) => {
      const canvas = grid.children[index]?.querySelector('canvas');
      if (canvas) drawMazePreview(canvas, getMazeDefinition(id));
    });
    dialog.showModal();
    trigger.setAttribute('aria-expanded', 'true');
    closeButton.focus();
  };
  const cancel = (event: Event): void => { event.preventDefault(); close(); };
  const outside = (event: MouseEvent): void => {
    if (event.target === dialog) close();
  };
  trigger.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', cancel);
  dialog.addEventListener('click', outside);
  return {
    open,
    isOpen: () => dialog.open,
    dispose: () => {
      disposed = true;
      trigger.removeEventListener('click', open);
      closeButton.removeEventListener('click', close);
      dialog.removeEventListener('cancel', cancel);
      dialog.removeEventListener('click', outside);
      if (dialog.open) dialog.close();
      trigger.remove();
      dialog.remove();
    },
  };
}
