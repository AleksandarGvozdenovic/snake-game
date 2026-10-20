import { describe, expect, it, vi } from 'vitest';
import { RetroAudio } from './RetroAudio';

function setup() {
  const oscillator = {
    type: 'sine',
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const context = {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => ({ ...oscillator })),
    createGain: vi.fn(() => gain),
    resume: vi.fn(() => { context.state = 'running'; return Promise.resolve(); }),
    close: vi.fn(() => { context.state = 'closed'; return Promise.resolve(); }),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  const audio = new RetroAudio(factory);
  return { audio, factory, context, gain };
}

describe('RetroAudio', () => {
  it('does not create an audio context before the first user gesture', () => {
    const { audio, factory } = setup();
    audio.play(650);
    expect(factory).not.toHaveBeenCalled();
  });

  it('unlocks once and reuses the same context across multiple sounds', () => {
    const { audio, factory, context } = setup();
    audio.unlock();
    audio.unlock();
    audio.play(650);
    audio.play(900, 0.08);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('respects Sound Off', () => {
    const { audio, context } = setup();
    audio.unlock();
    audio.setEnabled(false);
    audio.play(650);
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    audio.setEnabled(true);
    audio.play(650);
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('resumes sound after an interruption on the next interaction', () => {
    const { audio, context } = setup();
    audio.unlock();
    context.state = 'suspended';
    audio.play(650);
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
    audio.unlock();
    expect(context.resume).toHaveBeenCalledTimes(2);
    audio.play(650);
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
  });

  it('closes a single context on disposal', () => {
    const { audio, context } = setup();
    audio.unlock();
    audio.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
