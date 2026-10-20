type ContextFactory = () => AudioContext | null;

function createContext(): AudioContext | null {
  const AudioContextConstructor = window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : null;
}

export class RetroAudio {
  private context: AudioContext | null = null;
  private enabled = true;
  private primed = false;

  constructor(private readonly contextFactory: ContextFactory = createContext) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  unlock(): void {
    if (!this.enabled) return;
    try {
      if (this.context?.state === 'closed') {
        this.context = null;
        this.primed = false;
      }
      const context = this.context ?? (this.context = this.contextFactory());
      if (!context) return;

      if (!this.primed) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        gain.gain.setValueAtTime(0, context.currentTime);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.005);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        this.primed = true;
      }

      if (context.state !== 'running') {
        void context.resume().catch(() => undefined);
      }
    } catch {
      // Audio is optional; gameplay remains available if a browser blocks it.
    }
  }

  play(frequency: number, duration = 0.045): void {
    const context = this.context;
    if (!this.enabled || !context || context.state !== 'running') return;

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const started = context.currentTime;
      const length = Math.max(0.015, Math.min(0.3, duration));
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, started);
      gain.gain.setValueAtTime(0.0001, started);
      gain.gain.linearRampToValueAtTime(0.032, started + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, started + length);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(started);
      oscillator.stop(started + length + 0.005);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {
      // Devices without a usable audio output should still be able to play.
    }
  }

  preview(): void {
    this.unlock();
    const context = this.context;
    if (!context || !this.enabled) return;
    if (context.state === 'running') {
      this.play(660, 0.07);
    } else {
      void context.resume().then(() => this.play(660, 0.07)).catch(() => undefined);
    }
  }

  dispose(): void {
    const context = this.context;
    this.context = null;
    this.primed = false;
    if (context && context.state !== 'closed') {
      void context.close().catch(() => undefined);
    }
  }
}
