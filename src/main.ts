import './styles/nokia-lcd.css';

import { LCD_WIDTH, LcdFramebuffer } from './nokia/lcd/LcdFramebuffer';

import { LcdCanvasRenderer } from './nokia/lcd/LcdCanvasRenderer';
import { RetroAudio } from './nokia/audio/RetroAudio';

import { SnakeIIEngine, type Direction } from './nokia/game/SnakeIIEngine';

import { getMazeDefinition, MAZE_IDS, getWallCells, readMazeSelection, saveMazeSelection } from './nokia/game/MazeDefinitions';

import { mountHowToPlay, shouldPauseForGuide } from './nokia/ui/HowToPlay';

import { drawSnakeSprites, drawFoodSprite, drawBonusSprite, drawWallSprite } from './nokia/game/SnakeSpriteRenderer';

import { getWallPixelMask } from './nokia/game/MazeWallPixels';
import { drawPixelText, pixelTextPoints } from './nokia/lcd/PixelFont';
import { GAME_OVER_ANIMATION_MS, GAME_OVER_SCATTER_END_MS, createDeathParticles, drawDeathParticles } from './nokia/game/GameOverAnimation';

function requireElement<T extends HTMLElement>(id: string): T {

  const node = document.getElementById(id);

  if (!node) throw new Error(`Missing HTML element #${id}`);

  return node as T;

}

const viewport = requireElement<HTMLElement>('lcd-viewport');
const stage = requireElement<HTMLElement>('lcd-stage');

const canvas = requireElement<HTMLCanvasElement>('lcd');

const status = requireElement<HTMLElement>('status');

const modeButton = requireElement<HTMLButtonElement>('display-mode');


const framebuffer = new LcdFramebuffer();

const renderer = new LcdCanvasRenderer(canvas, viewport, framebuffer);

const game = new SnakeIIEngine();

game.cornerGraceEnabled = true;

try { game.maze = readMazeSelection(localStorage); } catch {  }

type Page = 'menu' | 'level' | 'maze' | 'settings' | 'top' | 'pause' | 'over' | 'game';

type MenuItem = { text: string; select: () => void };

let page: Page = 'menu';

let selection = 0;

let timer: number | undefined;
let deathAnimationFrame: number | undefined;
let deathAnimationActive = false;

const CORNER_GRACE_MS = 150;
let cornerGraceTimeout: number | undefined;
let cornerGraceDeadline = 0;
let cornerGraceRemaining = 0;

const audio = new RetroAudio();
let sound = true;

let remaster = false;

let best = 0;

let hasPausedGame = false;

try { const speed = Number(localStorage.getItem('nokia-snake-ii-level')); if (Number.isInteger(speed) && speed >= 1 && speed <= 9) game.level = speed; } catch {}

try { best = Number(localStorage.getItem('nokia-snake-ii-best') || '0') || 0; } catch {  }

const panel = document.createElement('div');

panel.className = 'nokia-panel';

panel.innerHTML = `

  <div class="nokia-title-area">

    <div class="nokia-title-crop">

      <img id="nokia-title-img" alt="Original Snake II artwork" draggable="false" />

    </div>

  </div>

  <div class="nokia-menu-area">

    <div id="nokia-page-info" class="nokia-page-info" aria-live="polite"></div>

    <div id="nokia-menu-items" class="nokia-menu-items"></div>

  </div>`;

viewport.appendChild(panel);

const titleImage = panel.querySelector<HTMLImageElement>('#nokia-title-img')!;

const infoNode = panel.querySelector<HTMLElement>('#nokia-page-info')!;

const menuNode = panel.querySelector<HTMLElement>('#nokia-menu-items')!;

titleImage.src = `${import.meta.env.BASE_URL}nokia/snake-ii-title-sheet.png`;

titleImage.addEventListener('error', () => {

  status.textContent = 'Title image could not be loaded.';

  panel.classList.add('no-title');

});

const touch = document.createElement('div');

touch.className = 'snake-touch-controls';

touch.innerHTML = `

  <button type="button" data-dir="up" aria-label="Up">▲</button>

  <div>

    <button type="button" data-dir="left" aria-label="Left">◀</button>

    <button type="button" data-action="pause" aria-label="Pause">Ⅱ</button>

    <button type="button" data-dir="right" aria-label="Right">▶</button>

  </div>

  <button type="button" data-dir="down" aria-label="Down">▼</button>`;

stage.after(touch);

function textPixels(message: string, x: number, y: number): void {
  drawPixelText(framebuffer, message, x, y);
}

function drawGame(includeSnake = true): void {

  framebuffer.clear();

  textPixels(`SCORE:${game.score}`, 1, 1);

  textPixels(`L${game.level}`, 71, 1);

  framebuffer.fillRect(0, 7, LCD_WIDTH, 1);

  renderer.setWallPixelMask(getWallPixelMask(game.mazeDefinition.walls));

  for (const wall of getWallCells(game.mazeDefinition)) {

    drawWallSprite(framebuffer, wall, game.mazeDefinition.walls);

  }

  if (game.food) drawFoodSprite(framebuffer, game.food);

  if (game.bonus) drawBonusSprite(framebuffer, game.bonus);

  if (includeSnake) drawSnakeSprites(framebuffer, game);

  renderer.render();

}

function drawGameOverScreen(): void {
  framebuffer.clear();
  renderer.setWallPixelMask(null);
  framebuffer.fillRect(12, 2, 60, 1);
  textPixels('GAME OVER', 24, 5);
  framebuffer.fillRect(12, 12, 60, 1);
  textPixels(`SCORE:${game.score}`, 10, 15);
  textPixels(`BEST:${Math.max(best, game.score)}`, 10, 23);
  textPixels(`${selection === 0 ? '>' : ' '}REPLAY`, 22, 32);
  textPixels(`${selection === 1 ? '>' : ' '}MENU`, 25, 40);
  renderer.render();
}

function beep(frequency = 480, length = 0.045): void {
  audio.play(frequency, length);
}

function unlockAudio(): void {
  audio.unlock();
}

function cancelDeathAnimation(): void {
  if (deathAnimationFrame !== undefined) {
    window.cancelAnimationFrame(deathAnimationFrame);
    deathAnimationFrame = undefined;
  }
  deathAnimationActive = false;
}

function cancelCornerGraceTimeout(preserveRemaining = false): void {
  if (cornerGraceTimeout !== undefined) {
    window.clearTimeout(cornerGraceTimeout);
    cornerGraceTimeout = undefined;
    if (preserveRemaining) {
      cornerGraceRemaining = Math.max(0, cornerGraceDeadline - performance.now());
    }
  }
  cornerGraceDeadline = 0;
  if (!preserveRemaining) cornerGraceRemaining = 0;
}

function startCornerGraceTimeout(): void {
  cancelCornerGraceTimeout();
  cornerGraceRemaining = CORNER_GRACE_MS;
  scheduleCornerGraceTimeout();
}

function scheduleCornerGraceTimeout(): void {
  if (!game.cornerGracePending || page !== 'game') return;
  cornerGraceDeadline = performance.now() + cornerGraceRemaining;
  cornerGraceTimeout = window.setTimeout(() => {
    cornerGraceTimeout = undefined;
    cornerGraceRemaining = 0;
    cornerGraceDeadline = 0;
    if (page === 'game' && game.expireCornerGrace()) {
      finishGame();
    }
  }, cornerGraceRemaining);
}

function requestDirection(requested: Direction): void {
  if (page !== 'game' || game.dead) return;

  if (game.cornerGracePending && cornerGraceTimeout !== undefined &&
      performance.now() > cornerGraceDeadline) {
    cancelCornerGraceTimeout();
    if (game.expireCornerGrace()) finishGame();
    return;
  }
  game.setDirection(requested);
  if (!game.cornerGracePending) return;
  const result = game.tryCornerGraceTurn();
  if (result === null) return;
  cancelCornerGraceTimeout();
  handleStepResult(result);

}

function stopClock(): void {

  if (timer !== undefined) window.clearInterval(timer);

  timer = undefined;

}

function saveBest(): void {

  if (game.score <= best) return;

  best = game.score;

  try { localStorage.setItem('nokia-snake-ii-best', String(best)); } catch {  }

}

function finishGame(): void {
  stopClock();
  cancelCornerGraceTimeout();
  saveBest();
  hasPausedGame = false;
  beep(160, 0.13);
  cancelDeathAnimation();

  const snakeFrame = new LcdFramebuffer();
  drawSnakeSprites(snakeFrame, game);
  const particles = createDeathParticles(
    snakeFrame.snapshot(),
    pixelTextPoints('GAME OVER', 24, 5),
  );
  const started = performance.now();
  deathAnimationActive = true;

  const animate = (now: number): void => {
    if (page !== 'game' || !deathAnimationActive) return;
    const elapsed = Math.max(0, now - started);
    if (elapsed >= GAME_OVER_ANIMATION_MS) {
      openPage('over');
      return;
    }

    if (elapsed < GAME_OVER_SCATTER_END_MS) drawGame(false);
    else {
      framebuffer.clear();
      renderer.setWallPixelMask(null);
    }
    drawDeathParticles(framebuffer, particles, elapsed, game.deathReason);
    renderer.render();
    deathAnimationFrame = window.requestAnimationFrame(animate);
  };
  drawGame();
  deathAnimationFrame = window.requestAnimationFrame(animate);
}

function handleStepResult(result: ReturnType<SnakeIIEngine['step']>): void {
  if (result === 'grace') {

    drawGame();
    startCornerGraceTimeout();
    return;
  }
  if (result === 'eat') beep(650);
  if (result === 'bonus') beep(900, 0.08);
  if (result === 'dead') {
    finishGame();
    return;
  }
  drawGame();
}

function startClock(): void {
  stopClock();
  if (game.dead) return;
  timer = window.setInterval(() => {

    if (game.cornerGracePending) return;
    handleStepResult(game.step());
  }, game.delayMs);
}

function newGame(): void {
  cancelDeathAnimation();
  cancelCornerGraceTimeout();

  hasPausedGame = false;

  game.reset();

  page = 'game';

  panel.hidden = true;

  canvas.style.display = 'block';

  touch.classList.add('active');



  renderer.resize();

  drawGame();

  startClock();

}

function resumeGame(): void {
  cancelDeathAnimation();

  page = 'game';

  panel.hidden = true;

  canvas.style.display = 'block';

  touch.classList.add('active');


  renderer.resize();

  drawGame();

  startClock();
  if (game.cornerGracePending) scheduleCornerGraceTimeout();

}

function pauseGame(): void {

  if (page !== 'game' || game.dead) return;

  stopClock();
  cancelCornerGraceTimeout(true);

  hasPausedGame = true;

  openPage('pause');

}

function quitGame(): void {

  stopClock();
  cancelCornerGraceTimeout();

  saveBest();

  openPage('menu');

}

function menuEntries(): MenuItem[] {

  if (page === 'menu') return [

    ...(hasPausedGame && !game.dead

      ? [{ text: 'Continue', select: resumeGame }] : []),

    { text: 'New Game', select: newGame },

    { text: 'Level', select: () => openPage('level') },

    { text: 'Maze', select: () => openPage('maze') },

    { text: 'Top Score', select: () => openPage('top') },

    { text: 'Instructions', select: () => howToPlay.open() },

    { text: 'Settings', select: () => openPage('settings') },

  ];

  if (page === 'level') return [

    ...Array.from({ length: 9 }, (_, i) => ({

      text: `${game.level === i + 1 ? '◆ ' : ''}Level ${i + 1}`,

      select: () => { game.level = i + 1; try { localStorage.setItem('nokia-snake-ii-level', String(game.level)); } catch {} openPage('menu'); },

    })),

    { text: 'Back', select: () => openPage('menu') },

  ];

  if (page === 'settings') return [

    { text: `Maze: ${game.maze === 0 ? 'None' : game.maze}`, select: () => openPage('maze') },

    { text: `Sound: ${sound ? 'On' : 'Off'}`, select: () => {
      sound = !sound;
      audio.setEnabled(sound);
      if (sound) audio.preview();
      refreshMenu();
    } },

    { text: 'Back', select: () => openPage('menu') },

  ];

  if (page === 'maze') return [

    ...MAZE_IDS.map((id) => {

      const definition = getMazeDefinition(id);

      return {

        text: `${game.maze === id ? '◆ ' : ''}${definition.name}`,

        select: () => {

          game.maze = id;

          try { saveMazeSelection(localStorage, id); } catch {  }

          openPage('menu');


        },

      };

    }),

    { text: 'Back', select: () => openPage('menu') },

  ];

  if (page === 'top') return [{ text: 'Back', select: () => openPage('menu') }];

  if (page === 'pause') return [

    { text: 'Continue', select: resumeGame },

    { text: 'New Game', select: newGame },

    { text: 'Main Menu', select: quitGame },

  ];

  if (page === 'over') return [

    { text: 'New Game', select: newGame },

    { text: 'Main Menu', select: quitGame },

  ];

  return [];

}

function menuDescription(): string {

  if (page === 'menu') return '';

  if (page === 'level') return `SELECT SPEED · ${game.level}/9`;

  if (page === 'settings') return 'SETTINGS';

  if (page === 'maze') return 'SELECT MAZE';

  if (page === 'top') return `TOP SCORE: ${best}`;

  if (page === 'pause') return `PAUSED · SCORE ${game.score}`;

  if (page === 'over') return `GAME OVER · SCORE ${game.score}`;

  return '';

}

let items: MenuItem[] = [];

function refreshMenu(): void {

  items = menuEntries();

  selection = Math.min(selection, items.length - 1);

  infoNode.textContent = menuDescription();

  menuNode.replaceChildren();

  items.forEach((item, index) => {

    const button = document.createElement('button');

    button.type = 'button';

    button.className = 'nokia-option';

    button.setAttribute('aria-current', index === selection ? 'true' : 'false');

    button.textContent = item.text;

    button.addEventListener('click', () => {

      selection = index;

      item.select();

    });

    menuNode.appendChild(button);

  });

  const active = menuNode.children[selection] as HTMLElement | undefined;

  active?.scrollIntoView({ block: 'nearest' });
  if (page === 'over') drawGameOverScreen();

}

function openPage(next: Page): void {
  cancelDeathAnimation();
  if (next !== 'pause') cancelCornerGraceTimeout();
  page = next;
  selection = 0;
  const lcdGameOver = next === 'over';
  panel.hidden = lcdGameOver;
  canvas.style.display = lcdGameOver ? 'block' : 'none';
  touch.classList.toggle('active', lcdGameOver);
  panel.classList.toggle('inner-page', next !== 'menu');
  refreshMenu();
  status.textContent = '';
}

function handleKeyDown(event: KeyboardEvent): void {

  if (howToPlay.isOpen()) return;

  const key = event.key.toLowerCase();

  const controlled = ['arrowup','arrowdown','arrowleft','arrowright',' ','enter','escape','backspace','2','4','6','8','w','a','s','d','p','c','*','#'];

  if (controlled.includes(key)) event.preventDefault();


  if (event.repeat && page !== 'game') return;

  if (page === 'game') {
    if (game.dead) {
      if (deathAnimationActive && ['enter', ' ', 'escape'].includes(key)) openPage('over');
      return;
    }

    const directions: Record<string, Direction> = {

      arrowup: 'up', w: 'up', '8': 'up',

      arrowdown: 'down', s: 'down', '2': 'down',

      arrowleft: 'left', a: 'left', '4': 'left',

      arrowright: 'right', d: 'right', '6': 'right',

    };

    if (directions[key]) requestDirection(directions[key]);

    else if (key === '*') {
      const dirs: Direction[] = ['up', 'right', 'down', 'left'];
      requestDirection(dirs[(dirs.indexOf(game.direction) + 3) % 4]);
    }
    else if (key === '#') {
      const dirs: Direction[] = ['up', 'right', 'down', 'left'];
      requestDirection(dirs[(dirs.indexOf(game.direction) + 1) % 4]);
    }

    else if (['p','c','escape',' '].includes(key)) pauseGame();

    return;

  }

  if (key === 'arrowdown' || key === '2' || (page === 'over' && key === 'arrowright')) {

    selection = (selection + 1) % items.length;

    refreshMenu();

  } else if (key === 'arrowup' || key === '8' || (page === 'over' && key === 'arrowleft')) {

    selection = (selection - 1 + items.length) % items.length;

    refreshMenu();

  } else if (key === 'enter' || key === ' ') {

    items[selection]?.select();

  } else if (key === 'escape' || key === 'backspace') {

    if (page === 'pause') resumeGame();

    else if (page === 'maze') openPage('menu');

    else if (page !== 'menu') openPage('menu');

  }

}

function onTouchClick(event: MouseEvent): void {

  const target = event.target as HTMLElement;

  const button = target.closest<HTMLButtonElement>('button');

  if (!button) return;

  if (page === 'over') {
    if (button.dataset.action === 'pause') { items[selection]?.select(); return; }
    if (button.dataset.dir) {
      selection = (selection + 1) % items.length;
      refreshMenu();
    }
    return;
  }
  if (button.dataset.action === 'pause') { pauseGame(); return; }

  if (page === 'game' && button.dataset.dir) requestDirection(button.dataset.dir as Direction);

}

function onLcdClick(event: MouseEvent): void {
  if (page === 'game' && game.dead && deathAnimationActive) {
    openPage('over');
    return;
  }
  if (page !== 'over') return;
  if (performance.now() < suppressClickUntil) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.height <= 0) return;
  const logicalY = ((event.clientY - rect.top) / rect.height) * 48;
  if (logicalY >= 30 && logicalY <= 39) { items[0]?.select(); }
  else if (logicalY > 39) { items[1]?.select(); }
}

let suppressClickUntil = 0;

let startX = 0;

let startY = 0;

function onTouchStart(event: TouchEvent): void {

  if (page !== 'game') return;

  startX = event.changedTouches[0].clientX;

  startY = event.changedTouches[0].clientY;

}

function onTouchEnd(event: TouchEvent): void {

  if (page !== 'game') return;
  if (game.dead && deathAnimationActive) {
    suppressClickUntil = performance.now() + 650;
    openPage('over');
    return;
  }

  const dx = event.changedTouches[0].clientX - startX;

  const dy = event.changedTouches[0].clientY - startY;

  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;

  requestDirection(Math.abs(dx) > Math.abs(dy)

    ? dx > 0 ? 'right' : 'left'

    : dy > 0 ? 'down' : 'up');

}

function updateMode(): void {

  document.body.classList.toggle('remaster', remaster);

  modeButton.textContent = remaster ? 'CLASSIC DISPLAY' : 'REMASTER DISPLAY';

  modeButton.setAttribute('aria-pressed', String(remaster));

}

function onModeClick(): void { remaster = !remaster; updateMode(); }

const howToPlay = mountHowToPlay({

  onBeforeOpen: () => { if (shouldPauseForGuide(page)) pauseGame(); },

});

const landscapeMedia = window.matchMedia('(orientation: landscape)');
function onOrientationChange(): void {
  if (page === 'game' && !game.dead) pauseGame();
  window.requestAnimationFrame(() => renderer.resize());
}
function onVisibilityChange(): void {
  if (document.hidden && page === 'game' && !game.dead) pauseGame();
}
landscapeMedia.addEventListener('change', onOrientationChange);
document.addEventListener('visibilitychange', onVisibilityChange);

// User-initiated input is required to enable sound on iOS and other browsers.
window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
window.addEventListener('touchstart', unlockAudio, { capture: true, passive: true });
window.addEventListener('keydown', unlockAudio, { capture: true });
window.addEventListener('keydown', handleKeyDown);

modeButton.addEventListener('click', onModeClick);


touch.addEventListener('click', onTouchClick);
canvas.addEventListener('click', onLcdClick);

canvas.addEventListener('touchstart', onTouchStart, { passive: true });

canvas.addEventListener('touchend', onTouchEnd, { passive: true });

updateMode();

openPage('menu');

if (import.meta.hot) {

  import.meta.hot.dispose(() => {

    stopClock();
    cancelCornerGraceTimeout();
    cancelDeathAnimation();

    window.removeEventListener('pointerdown', unlockAudio, true);
    window.removeEventListener('touchstart', unlockAudio, true);
    window.removeEventListener('keydown', unlockAudio, true);
    window.removeEventListener('keydown', handleKeyDown);
    audio.dispose();
    landscapeMedia.removeEventListener('change', onOrientationChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);

    modeButton.removeEventListener('click', onModeClick);

    touch.removeEventListener('click', onTouchClick);
    canvas.removeEventListener('click', onLcdClick);

    canvas.removeEventListener('touchstart', onTouchStart);

    canvas.removeEventListener('touchend', onTouchEnd);

    touch.remove();

    panel.remove();

    howToPlay.dispose();

    renderer.dispose();

    canvas.style.display = '';

  });

}
